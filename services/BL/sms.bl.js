const { ValidationError } = require("../../utils/handler/error");
const { generateDeterministicSecret, generateOtp, verifyOtp } = require("../../utils/helper/totp.helper");
const { createRequestToken, verifyRequestToken, createSessionToken, verifySessionToken } = require("../../utils/helper/hmac.helper");
const { isConsumed, markAsConsumed, getTokenSignature, isRequestIssued, markRequestIssued, clearIssuedRequest } = require("../../utils/helper/consumedTokens");
const { getOtpValiditySeconds } = require("../../utils/config/otpConfig");
const { notificationDashboardAxiosCall } = require("../../utils/middlewares/axiosCall");
const { Send_Notification_URL } = require("../../utils/config/env");

// ─────────────────────────────────────────────────────────────────────
// Stateless TOTP — state is embedded in HMAC-signed requestTokens.
// Only minimal state: consumed token signatures to prevent replay.
// ─────────────────────────────────────────────────────────────────────

// ─── REQUEST OTP ───
const requestOtpBl = async (req, res) => {
    let timestamp = req.timestamp;
    try {
        let { mobileNumber, params, messageData, feature, operationPerformed, user_name, email, status } = req.body;
        let bankCode = req.body?.bankCode;
        const validitySeconds = getOtpValiditySeconds(bankCode);

        // Normalize: treat empty strings as undefined
        mobileNumber = mobileNumber && mobileNumber.trim() ? mobileNumber.trim() : null;
        email = email && email.trim() ? email.trim() : null;

        // ─── Build identityKey from available channels ───
        const identityKey = buildIdentityKey(mobileNumber, email);

        // ─── Duplicate check: independently lock each provided channel ───
        if (mobileNumber && await isRequestIssued(mobileNumber, params)) {
            throw new ValidationError(
                "OTP already requested for this mobileNumber + params",
                {},
                "Validation Error",
                "OTP already sent for this mobile number with the same params. Use a unique params value or resend the existing OTP."
            );
        }
        if (email && await isRequestIssued(email, params)) {
            throw new ValidationError(
                "OTP already requested for this email + params",
                {},
                "Validation Error",
                "OTP already sent for this email with the same params. Use a unique params value or resend the existing OTP."
            );
        }

        // Generate deterministic secret from identityKey + params
        const secret = generateDeterministicSecret(identityKey, params);

        // Generate current TOTP code
        const otp = generateOtp(secret);

        // Create signed request token — embeds all state the server needs later
        const requestToken = createRequestToken({
            identityKey, mobileNumber, email, params, bankCode, user_name, feature, operationPerformed,
        });

        // Mark each provided channel as issued (auto-expires with OTP validity)
        if (mobileNumber) await markRequestIssued(mobileNumber, params, validitySeconds);
        if (email) await markRequestIssued(email, params, validitySeconds);

        console.log(`OTP generated for ${identityKey} with params ${params}`, timestamp);

        // Set OTP in messageData for notification
        messageData.otp = otp;

        // Send notification — blocks until delivery confirmed, throws on failure
        // (Redis key is already saved above, so user must retry with new params on failure)
        await sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData, email, status }, timestamp);

        return { otp, requestToken };
    } catch (error) {
        console.log(JSON.stringify(error), "requestOTPBl error", timestamp);
        throw error;
    }
};

// ─── RESEND OTP ───
const resendOtpBl = async (req, res) => {
    let timestamp = req.timestamp;
    try {
        let { requestToken, messageData, status } = req.body;

        // Verify and decode the request token
        const tokenData = verifyRequestToken(requestToken);
        if (!tokenData) {
            throw new ValidationError(
                "Invalid or tampered request token",
                {},
                "Validation Error",
                "Invalid request token. Please request a new OTP."
            );
        }

        const { identityKey, mobileNumber, email, params, bankCode, user_name, feature, operationPerformed } = tokenData;

        // ─── Replay prevention: block resend if this session was already validated ───
        const sessionKey = `${identityKey}:${params}`;
        if (await isConsumed(sessionKey)) {
            throw new ValidationError(
                "Request token already consumed",
                {},
                "Validation Error",
                "This OTP has already been validated. Please request a new OTP."
            );
        }

        // Check if the original request token has expired
        const validitySeconds = getOtpValiditySeconds(bankCode);
        const elapsed = (Date.now() - tokenData.timestamp) / 1000;
        if (elapsed > validitySeconds) {
            throw new ValidationError(
                "Request token has expired",
                { elapsedSeconds: Math.floor(elapsed), validitySeconds },
                "Validation error",
                "OTP request has expired. Please request a new OTP."
            );
        }

        // Re-derive TOTP secret and generate fresh code
        const secret = generateDeterministicSecret(identityKey, params);
        const otp = generateOtp(secret);

        // Issue NEW request token (resets the validity timer)
        const newRequestToken = createRequestToken({
            identityKey, mobileNumber, email, params, bankCode, user_name, feature, operationPerformed,
        });

        console.log(`OTP resent for ${identityKey} with params ${params}`, timestamp);

        // Set OTP in messageData for notification
        messageData.otp = otp;

        // Send notification — blocks until delivery confirmed, throws on failure
        await sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData, email, status }, timestamp);

        return { otp, requestToken: newRequestToken };
    } catch (error) {
        console.log(JSON.stringify(error), "resendOTPBl error", timestamp);
        throw error;
    }
};

// ─── VALIDATE OTP ───
const validateOtpBl = async (req, res) => {
    let timestamp = req.timestamp;
    try {
        let { requestToken, otp } = req.body;

        // Verify and decode the request token
        const tokenData = verifyRequestToken(requestToken);
        if (!tokenData) {
            throw new ValidationError(
                "Invalid or tampered request token",
                {},
                "Validation Error",
                "Invalid request token. Please request a new OTP."
            );
        }

        const { identityKey, mobileNumber, email, params, bankCode } = tokenData;

        // ─── Replay prevention: check if this session was already validated ───
        const sessionKey = `${identityKey}:${params}`;
        if (await isConsumed(sessionKey)) {
            throw new ValidationError(
                "OTP already validated",
                { identityKey },
                "Validation error",
                "This OTP has already been validated. Please request a new OTP."
            );
        }

        // ─── Expiry check ───
        const validitySeconds = getOtpValiditySeconds(bankCode);
        const elapsed = (Date.now() - tokenData.timestamp) / 1000;
        if (elapsed > validitySeconds) {
            console.log(
                `OTP expired for ${identityKey} params ${params}. Elapsed: ${elapsed.toFixed(1)}s, Validity: ${validitySeconds}s`,
                timestamp
            );
            throw new ValidationError(
                "OTP has expired",
                { elapsedSeconds: Math.floor(elapsed), validitySeconds },
                "Validation error",
                "OTP has expired. Please request a new OTP."
            );
        }

        // ─── Dev-mode bypass: accept '000000' ───
        if (process.env.NODE_ENV === 'development' && otp === '000000') {
            console.log("Dev mode: bypass OTP accepted (000000)", timestamp);
            await markAsConsumed(sessionKey, validitySeconds);
            if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
            if (email) await clearIssuedRequest(email, params);
            const sessionToken = createSessionToken({ identityKey, mobileNumber, email, params, bankCode });
            return { sessionToken };
        }

        // ─── TOTP verification ───
        const secret = generateDeterministicSecret(identityKey, params);
        const verified = verifyOtp(secret, otp, validitySeconds);

        if (!verified) {
            throw new ValidationError(
                "OTP does not match",
                {},
                "Validation error",
                "Invalid OTP"
            );
        }

        console.log(`OTP validated for ${identityKey} params ${params}`, timestamp);

        // Mark session as consumed — prevents replay of ANY token for this session
        await markAsConsumed(sessionKey, validitySeconds);
        if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
        if (email) await clearIssuedRequest(email, params);

        // Issue session token — proof of successful validation
        const sessionToken = createSessionToken({ identityKey, mobileNumber, email, params, bankCode });
        return { sessionToken };
    } catch (error) {
        console.log(JSON.stringify(error), "validateOTPBl error", timestamp);
        throw error;
    }
};

// ─── Helper: Build identity key from available channels ───
// Only includes non-empty values. Never includes empty strings.
function buildIdentityKey(mobileNumber, email) {
    const parts = [];
    if (mobileNumber) parts.push(mobileNumber);
    if (email) parts.push(email);
    return parts.join(':');
}

// ─── Notification helper (blocking — throws on failure) ───
// The Redis key is already saved before this is called, so on failure the user
// must retry with new params. This is intentional to prevent OTP spam.
async function sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData, email, status }, timestamp) {
    if (!Send_Notification_URL) {
        console.log("Send_Notification_URL not configured, skipping notification call", timestamp);
        return;
    }

    const axiosRequestBody = {
        user_name,
        feature: feature.toUpperCase(),
        operation_performed: operationPerformed.toUpperCase(),
        status: status || "SUCCESS",
        status_code: "0",
        notification_data: {
            mobile_number: mobileNumber || "",
            email: email || "",
            WhatsappMobile: "",
            params: messageData,
        },
    };
    console.log(JSON.stringify(axiosRequestBody), "Notification Request Body", timestamp);

    // Call notification API — let axios errors propagate (no try-catch here)
    const sendArray = await notificationDashboardAxiosCall(axiosRequestBody, timestamp);

    // ─── Validate sendArray response ───
    if (!sendArray || !Array.isArray(sendArray) || sendArray.length === 0) {
        console.log("Notification API returned empty or invalid sendArray", timestamp);
        throw new ValidationError(
            "Notification delivery failed",
            { sendArray },
            "Notification Error",
            "Failed to deliver OTP notification. Please retry with new params.",
            500
        );
    }

    // Build a map of which channels we expected to succeed
    const failedChannels = [];

    for (const entry of sendArray) {
        const channel = entry.type || entry.channel || "unknown";
        if (entry.send_status !== true && entry.send_status !== "true") {
            failedChannels.push(channel);
        }
    }

    if (failedChannels.length > 0) {
        console.log(`Notification send_status failed for channels: ${failedChannels.join(", ")}`, timestamp);
        throw new ValidationError(
            "OTP notification delivery failed",
            { failedChannels, sendArray },
            "Notification Error",
            `Failed to deliver OTP via: ${failedChannels.join(", ")}. Please retry with new params.`,
            500
        );
    }

    console.log("Notification delivered successfully for all channels", timestamp);
}

// ─── VERIFY SESSION ───
const verifySessionBl = async (req, res) => {
    let timestamp = req.timestamp;
    try {
        let { sessionToken } = req.body;

        const sessionData = verifySessionToken(sessionToken);
        if (!sessionData) {
            throw new ValidationError(
                "Invalid or expired session token",
                {},
                "Validation Error",
                "Session token is invalid or has expired."
            );
        }

        console.log(`Session verified for ${sessionData.identityKey} params ${sessionData.params}`, timestamp);

        return {
            identityKey: sessionData.identityKey,
            mobileNumber: sessionData.mobileNumber,
            email: sessionData.email,
            params: sessionData.params,
            bankCode: sessionData.bankCode,
            timestamp: sessionData.timestamp,
        };
    } catch (error) {
        console.log(JSON.stringify(error), "verifySessionBl error", timestamp);
        throw error;
    }
};


module.exports = { requestOtpBl, resendOtpBl, validateOtpBl, verifySessionBl };
