const crypto = require('crypto');
const { HTOTP_MASTER_KEY, otp_length, TOTP_TIME_STEP } = require('../config/env');

// ─────────────────────────────────────────────────────────────────────
// HTOTP (Hybrid Time-Nonce OTP) — Core Cryptographic Engine
// Combines HOTP (RFC 4226) + TOTP (RFC 6238) + HKDF (RFC 5869)
// + Transaction Binding + Per-Request Key Derivation
// ─────────────────────────────────────────────────────────────────────

const HTOTP_INFO = 'HTOTP-v1';
const NONCE_LENGTH = 20;
const NONCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a cryptographically secure 20-character alphanumeric nonce.
 * Used as per-request entropy in the HKDF salt.
 * @returns {string} 20-char alphanumeric random string
 */
function generateNonce() {
    const bytes = crypto.randomBytes(NONCE_LENGTH);
    let nonce = '';
    for (let i = 0; i < NONCE_LENGTH; i++) {
        nonce += NONCE_CHARSET[bytes[i] % NONCE_CHARSET.length];
    }
    return nonce;
}

/**
 * Constructs the HKDF salt based on the channel mode.
 * - SMS:  mobileNumber + nonce
 * - EMAIL: email + nonce
 * - DUAL: email + mobileNumber + nonce
 * @param {string} channel - 'SMS', 'EMAIL', or 'DUAL'
 * @param {string|null} mobileNumber - User's mobile number
 * @param {string|null} email - User's email address
 * @param {string} nonce - 20-char random alphanumeric string
 * @returns {string} Constructed salt string
 */
function constructSalt(channel, mobileNumber, email, nonce) {
    switch (channel) {
        case 'EMAIL':
            return `${email}${nonce}`;
        case 'DUAL':
            return `${email}${mobileNumber}${nonce}`;
        case 'SMS':
        default:
            return `${mobileNumber}${nonce}`;
    }
}

/**
 * Derives a per-request cryptographic key using HKDF-SHA256.
 * Each request gets a unique derived key because the nonce in the salt changes.
 * Even if this derived key leaks, the master key remains safe (HKDF is one-way).
 * @param {string} salt - Constructed salt (mobile/email + nonce)
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(salt) {
    const derived = crypto.hkdfSync(
        'sha256',
        Buffer.from(HTOTP_MASTER_KEY, 'hex'),
        Buffer.from(salt),
        Buffer.from(HTOTP_INFO),
        32 // 256-bit derived key
    );
    return Buffer.from(derived);
}

/**
 * Dynamic Truncation — adapted from RFC 4226 Section 5.3 for SHA-256 (32 bytes).
 * Extracts a 31-bit unsigned integer from the HMAC result.
 * @param {Buffer} hmacResult - 32-byte HMAC-SHA256 output
 * @returns {number} 31-bit unsigned integer
 */
function dynamicTruncate(hmacResult) {
    // Use the last byte's low-order 4 bits as offset (0-15)
    // For SHA-256 (32 bytes), max offset is 28 (to read 4 bytes: offset+3 <= 31)
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;

    // Extract 4 bytes starting at offset, mask MSB to get 31-bit unsigned int
    const binCode =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    return binCode;
}

/**
 * Generates an HTOTP code using the hybrid formula:
 * OTP = DynamicTruncate(HMAC-SHA256(DerivedKey, TimeStep.Nonce.TxContext)) mod 10^digits
 *
 * @param {Buffer} derivedKey - HKDF-derived per-request key
 * @param {number} timeStep - floor(unixTimestamp / 30)
 * @param {string} nonce - 20-char random string
 * @param {string} txContext - Transaction context (e.g., "LOGIN:OTP_VERIFICATION")
 * @param {number} [digits] - Number of OTP digits (default from config)
 * @returns {string} Zero-padded OTP string
 */
function generateHtotpCode(derivedKey, timeStep, nonce, txContext, digits) {
    digits = digits || otp_length;

    // Assemble the message: TimeStep.Nonce.TxContext
    const message = `${timeStep}.${nonce}.${txContext}`;

    // HMAC-SHA256 with the derived key
    const hmacResult = crypto.createHmac('sha256', derivedKey)
        .update(message)
        .digest();

    // Dynamic truncation → 31-bit integer → modulo reduction
    const truncated = dynamicTruncate(hmacResult);
    const otp = truncated % Math.pow(10, digits);

    // Zero-pad to the required digit length
    return otp.toString().padStart(digits, '0');
}

/**
 * Verifies an HTOTP code using timing-safe comparison.
 * Recomputes the expected OTP and compares against the user-provided one.
 *
 * @param {Buffer} derivedKey - HKDF-derived per-request key
 * @param {number} timeStep - floor(originalTimestamp / 30) from the requestToken
 * @param {string} nonce - Nonce from the requestToken
 * @param {string} txContext - Transaction context from the requestToken
 * @param {string} userOtp - OTP submitted by the user
 * @param {number} [digits] - Number of OTP digits (default from config)
 * @returns {boolean} true if OTP matches
 */
function verifyHtotpCode(derivedKey, timeStep, nonce, txContext, userOtp, digits) {
    digits = digits || otp_length;

    const expectedOtp = generateHtotpCode(derivedKey, timeStep, nonce, txContext, digits);

    // Timing-safe comparison to prevent timing side-channel attacks
    const expectedBuf = Buffer.from(expectedOtp);
    const userBuf = Buffer.from(String(userOtp).padStart(digits, '0'));

    if (expectedBuf.length !== userBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, userBuf);
}

/**
 * Computes the TOTP time step from a Unix timestamp.
 * @param {number} [timestampMs] - Unix timestamp in milliseconds (default: now)
 * @returns {number} Time step integer
 */
function computeTimeStep(timestampMs) {
    const ts = timestampMs || Date.now();
    return Math.floor(ts / 1000 / TOTP_TIME_STEP);
}

/**
 * Builds the transaction context string from feature and operation.
 * @param {string} feature - Feature name (e.g., "LOGIN")
 * @param {string} operation - Operation name (e.g., "OTP_VERIFICATION")
 * @param {string} [extraParams] - Optional extra transaction parameters
 * @returns {string} Transaction context string
 */
function buildTxContext(feature, operation, extraParams) {
    let tx = `${feature}:${operation}`;
    if (extraParams) tx += `:${extraParams}`;
    return tx.toUpperCase();
}

module.exports = {
    generateNonce,
    constructSalt,
    deriveKey,
    dynamicTruncate,
    generateHtotpCode,
    verifyHtotpCode,
    computeTimeStep,
    buildTxContext,
};
