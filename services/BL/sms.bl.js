const { ValidationError } = require("../../utils/handler/error");
const { generateDeterministicSecret, generateOtp, verifyOtp } = require("../../utils/helper/totp.helper");
const { createRequestToken, verifyRequestToken, createSessionToken } = require("../../utils/helper/hmac.helper");
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
        let { mobileNumber, params, messageData, feature, operationPerformed, user_name } = req.body;
        let bankCode = req.body?.bankCode;
        const validitySeconds = getOtpValiditySeconds(bankCode);

        // ─── Duplicate check: same mobileNumber + params must not be reused ───
        if (isRequestIssued(mobileNumber, params)) {
            throw new ValidationError(
                "OTP already requested for this mobileNumber + params",
                {},
                "Validation Error",
                "OTP already sent for this mobile number with the same params. Use a unique params value or resend the existing OTP."
            );
        }

        // Generate deterministic secret from mobileNumber + params
        const secret = generateDeterministicSecret(mobileNumber, params);

        // Generate current TOTP code
        const otp = generateOtp(secret);

        // Create signed request token — embeds all state the server needs later
        const requestToken = createRequestToken({
            mobileNumber, params, bankCode, user_name, feature, operationPerformed,
        });

        // Mark this mobileNumber + params combo as issued (auto-expires with OTP validity)
        markRequestIssued(mobileNumber, params, validitySeconds);

        console.log(`OTP generated for ${mobileNumber} with params ${params}`, timestamp);

        // Set OTP in messageData for notification
        messageData.otp = otp;

        // Send SMS via notification API (non-blocking)
        await sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData }, timestamp);

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
        let { requestToken, messageData } = req.body;

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

        const { mobileNumber, params, bankCode, user_name, feature, operationPerformed } = tokenData;

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
        const secret = generateDeterministicSecret(mobileNumber, params);
        const otp = generateOtp(secret);

        // Issue NEW request token (resets the validity timer)
        const newRequestToken = createRequestToken({
            mobileNumber, params, bankCode, user_name, feature, operationPerformed,
        });

        console.log(`OTP resent for ${mobileNumber} with params ${params}`, timestamp);

        // Set OTP in messageData for notification
        messageData.otp = otp;

        // Send SMS via notification API (non-blocking)
        await sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData }, timestamp);

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

        const { mobileNumber, params, bankCode } = tokenData;

        // ─── Replay prevention: check if this token was already validated ───
        const tokenSig = getTokenSignature(requestToken);
        if (isConsumed(tokenSig)) {
            throw new ValidationError(
                "OTP already validated",
                { mobileNumber },
                "Validation error",
                "This OTP has already been validated. Please request a new OTP."
            );
        }

        // ─── Expiry check ───
        const validitySeconds = getOtpValiditySeconds(bankCode);
        const elapsed = (Date.now() - tokenData.timestamp) / 1000;
        if (elapsed > validitySeconds) {
            console.log(
                `OTP expired for ${mobileNumber} params ${params}. Elapsed: ${elapsed.toFixed(1)}s, Validity: ${validitySeconds}s`,
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
            markAsConsumed(tokenSig, validitySeconds);
            clearIssuedRequest(mobileNumber, params);
            const sessionToken = createSessionToken({ mobileNumber, params, bankCode });
            return { sessionToken };
        }

        // ─── TOTP verification ───
        const secret = generateDeterministicSecret(mobileNumber, params);
        const verified = verifyOtp(secret, otp, validitySeconds);

        if (!verified) {
            throw new ValidationError(
                "OTP does not match",
                {},
                "Validation error",
                "Invalid OTP"
            );
        }

        console.log(`OTP validated for ${mobileNumber} params ${params}`, timestamp);

        // Mark token as consumed — prevents replay
        markAsConsumed(tokenSig, validitySeconds);
        clearIssuedRequest(mobileNumber, params);

        // Issue session token — proof of successful validation
        const sessionToken = createSessionToken({ mobileNumber, params, bankCode });
        return { sessionToken };
    } catch (error) {
        console.log(JSON.stringify(error), "validateOTPBl error", timestamp);
        throw error;
    }
};

// ─── Notification helper (non-blocking) ───
async function sendNotification({ user_name, feature, operationPerformed, mobileNumber, messageData }, timestamp) {
    if (!Send_Notification_URL) {
        console.log("Send_Notification_URL not configured, skipping notification call", timestamp);
        return;
    }
    try {
        const axiosRequestBody = {
            user_name,
            feature: feature.toUpperCase(),
            operation_performed: operationPerformed.toUpperCase(),
            status: "SUCCESS",
            status_code: "0",
            notification_data: {
                mobile_number: mobileNumber,
                email: "",
                WhatsappMobile: "",
                params: messageData,
            },
        };
        console.log(JSON.stringify(axiosRequestBody), "Notification Request Body", timestamp);
        await notificationDashboardAxiosCall(axiosRequestBody, timestamp);
    } catch (error) {
        console.log("Notification API call failed (non-blocking):", error.message, timestamp);
    }
}


module.exports = { requestOtpBl, resendOtpBl, validateOtpBl };
