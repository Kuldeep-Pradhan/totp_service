const { ValidationError } = require("../../utils/handler/error");
const { generateNonce, constructSalt, deriveKey, generateHtotpCode, verifyHtotpCode, computeTimeStep, buildTxContext } = require("../../utils/helper/htotp.helper");
const { createRequestToken, verifyRequestToken, createSessionToken, verifySessionToken } = require("../../utils/helper/hmac.helper");
const { createFingerprint, verifyFingerprint } = require("../../utils/helper/channelBinding.helper");
const { isConsumed, markAsConsumed, acquireRequestLock, clearIssuedRequest, incrementFailedAttempts, getFailedAttempts } = require("../../utils/helper/consumedTokens");
const { OTP_VALIDITY_SECONDS } = require("../../utils/config/env");
const { send: sendNotification } = require("../../utils/notifications/NotificationEngine");
// ─────────────────────────────────────────────────────────────────────
// HTOTP v2 — Hybrid Time-Nonce OTP Business Logic
//
// Algorithm: HKDF-SHA256(MasterKey, salt) → DerivedKey
//            HMAC-SHA256(DerivedKey, TimeStep.Nonce.TxContext) → OTP
//
// Features:
//   ✅ Per-request key derivation (HKDF)
//   ✅ Transaction binding (TxContext in HMAC)
//   ✅ Replay protection (random nonce per request)
//   ✅ Channel binding (client IP + UA fingerprint)
//   ✅ Stateless rate limiting (attempts counter in token)
//   ✅ Nonce blacklist (replay-after-validation prevention)
// ─────────────────────────────────────────────────────────────────────

// ─── REQUEST OTP ───
const requestOtpBl = async (req, res) => {
    let timestamp = req.timestamp;
    try {
        let { mobileNumber, params, messageData, feature, operationPerformed, user_name, email, status } = req.body;
        let channel = req.body?.channel || 'SMS';
        let bankCode = req.body?.bankCode;
        const validitySeconds = OTP_VALIDITY_SECONDS;

        // Normalize: treat empty strings as null
        mobileNumber = mobileNumber && mobileNumber.trim() ? mobileNumber.trim() : null;
        email = email && email.trim() ? email.trim() : null;

        // ─── Determine channel from available data if not explicitly set ───
        if (!req.body.channel) {
            if (mobileNumber && email) channel = 'DUAL';
            else if (email) channel = 'EMAIL';
            else channel = 'SMS';
        }

        // ─── Build identity key from available channels ───
        const identityKey = buildIdentityKey(mobileNumber, email);

        // ─── Duplicate check: independently lock each provided channel (atomic) ───
        const requestedChannels = [];
        if (mobileNumber) requestedChannels.push({ id: mobileNumber, type: 'mobile number' });
        if (email) requestedChannels.push({ id: email, type: 'email' });

        const acquiredLocks = [];
        for (const channel of requestedChannels) {
            const locked = await acquireRequestLock(channel.id, params, validitySeconds);
            if (!locked) {
                // Clean code: Rollback previously acquired locks to prevent partial state
                if (acquiredLocks.length > 0) {
                    await Promise.all(acquiredLocks.map(id => clearIssuedRequest(id, params)));
                }
                throw new ValidationError(
                    `OTP already requested for this ${channel.type} + params`,
                    {},
                    "Validation Error",
                    `OTP already sent for this ${channel.type} with the same params. Use a unique params value or resend the existing OTP.`
                );
            }
            acquiredLocks.push(channel.id);
        }

        // ─── HTOTP Algorithm: Generate OTP ───
        // Step 1: Generate per-request nonce (20-char alphanumeric)
        const nonce = generateNonce();

        // Step 2: Construct salt based on channel mode
        const salt = constructSalt(channel, mobileNumber, email, nonce);

        // Step 3: Derive per-request key via HKDF-SHA256
        const derivedKey = deriveKey(salt);

        // Step 4: Compute time step
        const timeStep = computeTimeStep();

        // Step 5: Build transaction context
        const txContext = buildTxContext(feature, operationPerformed);

        // Step 6: Generate HTOTP code
        const otp = generateHtotpCode(derivedKey, timeStep, nonce, txContext);

        // Step 7: Create channel binding fingerprint
        const fingerprint = createFingerprint(req);

        // Step 8: Create signed request token (carries ALL state)
        const requestToken = createRequestToken({
            channel, mobileNumber, email, nonce, txContext, params,
            bankCode, userName: user_name, feature, operationPerformed,
            fingerprint, validitySeconds,
        });

        console.log(`[HTOTP] OTP generated for ${identityKey} | channel=${channel} | params=${params}`, timestamp);

        // Send notification — blocks until delivery confirmed
        const notifyResult = await sendNotification({ 
            channel, 
            mobileNumber, 
            email, 
            otp, 
            purpose: feature || operationPerformed,
            userName: user_name 
        });

        if (notifyResult.successCount === 0) {
            if (acquiredLocks.length > 0) {
                await Promise.all(acquiredLocks.map(id => clearIssuedRequest(id, params)));
            }
            throw new ValidationError(
                "OTP notification delivery failed",
                notifyResult.results,
                "Notification Error",
                "Failed to deliver OTP. Please try again.",
                500
            );
        }

        return { otp, requestToken, smsDisclaimer: notifyResult.smsDisclaimer };
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

        const { channel, mobileNumber, email, nonce: oldNonce, txContext, params, bankCode, userName, feature, operationPerformed } = tokenData;
        const identityKey = buildIdentityKey(mobileNumber, email);

        // ─── Replay prevention: block resend if this session was already validated ───
        if (await isConsumed(oldNonce)) {
            throw new ValidationError(
                "Request token already consumed",
                {},
                "Validation Error",
                "This OTP has already been validated. Please request a new OTP."
            );
        }

        // Check if the original request token has expired
        if (Date.now() > tokenData.expiry) {
            throw new ValidationError(
                "Request token has expired",
                {},
                "Validation error",
                "OTP request has expired. Please request a new OTP."
            );
        }

        // ─── HTOTP: Generate NEW nonce → NEW OTP (old OTP is dead) ───
        const newNonce = generateNonce();
        const validitySeconds = OTP_VALIDITY_SECONDS;

        // Burn the old nonce so the previous OTP is instantly dead
        await markAsConsumed(oldNonce, validitySeconds);

        const salt = constructSalt(channel, mobileNumber, email, newNonce);
        const derivedKey = deriveKey(salt);
        const timeStep = computeTimeStep();
        const otp = generateHtotpCode(derivedKey, timeStep, newNonce, txContext);

        // Create new fingerprint from current request
        const fingerprint = createFingerprint(req);

        // Issue NEW request token (new nonce, new timestamps, att reset to max)
        const newRequestToken = createRequestToken({
            channel, mobileNumber, email, nonce: newNonce, txContext, params,
            bankCode, userName, feature, operationPerformed,
            fingerprint, validitySeconds,
        });

        console.log(`[HTOTP] OTP resent for ${identityKey} | channel=${channel} | params=${params}`, timestamp);

        // Send notification
        const notifyResult = await sendNotification({ 
            channel, 
            mobileNumber, 
            email, 
            otp, 
            purpose: feature || operationPerformed,
            userName 
        });

        if (notifyResult.successCount === 0) {
            throw new ValidationError(
                "OTP notification delivery failed",
                notifyResult.results,
                "Notification Error",
                "Failed to deliver OTP. Please try again.",
                500
            );
        }

        return { otp, requestToken: newRequestToken, smsDisclaimer: notifyResult.smsDisclaimer };
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

        // Step 1: Verify token signature
        const tokenData = verifyRequestToken(requestToken);
        if (!tokenData) {
            throw new ValidationError(
                "Invalid or tampered request token",
                {},
                "Validation Error",
                "Invalid request token. Please request a new OTP."
            );
        }

        const { channel, mobileNumber, email, nonce, txContext, params, bankCode, userName, feature, fingerprint } = tokenData;
        const identityKey = buildIdentityKey(mobileNumber, email);

        // Step 2: Check if nonce was already consumed (replay-after-validation prevention)
        if (await isConsumed(nonce)) {
            throw new ValidationError(
                "OTP already validated",
                { identityKey },
                "Validation error",
                "This OTP has already been validated. Please request a new OTP."
            );
        }

        // Step 3: Check expiry
        if (Date.now() > tokenData.expiry) {
            console.log(`[HTOTP] Token expired for ${identityKey} params ${params}`, timestamp);
            throw new ValidationError(
                "OTP has expired",
                {},
                "Validation error",
                "OTP has expired. Please request a new OTP."
            );
        }

        // Step 4: Check attempts remaining (stateless rate limiting)
        const failedAttempts = await getFailedAttempts(nonce);
        if (failedAttempts >= tokenData.attempts) {
            const validitySeconds = OTP_VALIDITY_SECONDS;
            await markAsConsumed(nonce, validitySeconds);
            if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
            if (email) await clearIssuedRequest(email, params);

            throw new ValidationError(
                "Maximum OTP attempts exceeded",
                {},
                "Validation error",
                "Maximum validation attempts exceeded. Please request a new OTP."
            );
        }

        // Step 5: Verify channel binding fingerprint
        if (fingerprint && !verifyFingerprint(req, fingerprint)) {
            console.log(`[HTOTP] Channel binding mismatch for ${identityKey}`, timestamp);
            // Log the mismatch but don't hard-fail (IP/UA can change legitimately)
            // In strict mode, uncomment the throw below:
            // throw new ValidationError("Channel binding mismatch", {}, "Security Error", "Request origin mismatch. Please request a new OTP.");
        }

        // Step 6: Dev-mode bypass: accept '000000'
        if (process.env.NODE_ENV === 'development' && otp === '000000') {
            console.log("[HTOTP] Dev mode: bypass OTP accepted (000000)", timestamp);
            const validitySeconds = OTP_VALIDITY_SECONDS;
            await markAsConsumed(nonce, validitySeconds);
            if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
            if (email) await clearIssuedRequest(email, params);
            const sessionToken = createSessionToken({ identityKey, mobileNumber, email, params, bankCode, txContext });
            return { sessionToken };
        }

        // Step 7: Reconstruct the HTOTP and verify
        const salt = constructSalt(channel, mobileNumber, email, nonce);
        const derivedKey = deriveKey(salt);
        const timeStep = computeTimeStep(tokenData.timestamp); // Use ORIGINAL timestamp
        const verified = verifyHtotpCode(derivedKey, timeStep, nonce, txContext, otp);

        if (!verified) {
            // ─── Increment failed attempts in Redis ───
            const validitySeconds = OTP_VALIDITY_SECONDS;
            const currentFails = await incrementFailedAttempts(nonce, validitySeconds);
            const attemptsRemaining = tokenData.attempts - currentFails;

            if (attemptsRemaining <= 0) {
                await markAsConsumed(nonce, validitySeconds);
                if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
                if (email) await clearIssuedRequest(email, params);

                throw new ValidationError(
                    "Invalid OTP — no attempts remaining",
                    {},
                    "Validation error",
                    "Invalid OTP. Maximum attempts exceeded. Please request a new OTP."
                );
            }

            throw new ValidationError(
                "OTP does not match",
                {}, // Note: token is no longer returned in payload
                "Validation error",
                `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`,
                400,
                -1,
                "VALERR0002"
            );
        }

        console.log(`[HTOTP] OTP validated for ${identityKey} | params=${params}`, timestamp);

        // Step 8: Mark nonce as consumed — prevents replay of ANY token with this nonce
        const validitySeconds = OTP_VALIDITY_SECONDS;
        await markAsConsumed(nonce, validitySeconds);
        if (mobileNumber) await clearIssuedRequest(mobileNumber, params);
        if (email) await clearIssuedRequest(email, params);

        // Step 9: Issue session token — proof of successful validation
        const sessionToken = createSessionToken({ identityKey, mobileNumber, email, params, bankCode, txContext });
        return { sessionToken };
    } catch (error) {
        console.log(JSON.stringify(error), "validateOTPBl error", timestamp);
        throw error;
    }
};

// ─── Helper: Build identity key from available channels ───
function buildIdentityKey(mobileNumber, email) {
    const parts = [];
    if (mobileNumber) parts.push(mobileNumber);
    if (email) parts.push(email);
    return parts.join(':');
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

        console.log(`[HTOTP] Session verified for ${sessionData.identityKey} params ${sessionData.params}`, timestamp);

        return {
            identityKey: sessionData.identityKey,
            mobileNumber: sessionData.mobileNumber,
            email: sessionData.email,
            params: sessionData.params,
            bankCode: sessionData.bankCode,
            txContext: sessionData.txContext,
            timestamp: sessionData.timestamp,
        };
    } catch (error) {
        console.log(JSON.stringify(error), "verifySessionBl error", timestamp);
        throw error;
    }
};


module.exports = { requestOtpBl, resendOtpBl, validateOtpBl, verifySessionBl };
