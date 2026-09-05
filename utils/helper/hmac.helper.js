const crypto = require('crypto');
const { HTOTP_MASTER_KEY, HTOTP_TOKEN_SIGNING_KEY, HTOTP_SESSION_SIGNING_KEY, MAX_OTP_ATTEMPTS } = require('../config/env');

// ─────────────────────────────────────────────────────────────────────
// HTOTP Token Management — 3-Key Architecture
//
// KEY 1: HTOTP_MASTER_KEY        → Used by htotp.helper.js for HKDF/OTP
// KEY 2: HTOTP_TOKEN_SIGNING_KEY → Used here for requestToken HMAC
// KEY 3: HTOTP_SESSION_SIGNING_KEY → Used here for sessionToken HMAC
//
// Compromise of any ONE key does NOT break the other two.
// ─────────────────────────────────────────────────────────────────────

// ─── REQUEST TOKEN ───
// Embeds: version, channel, mobile, email, nonce, txContext, timestamp,
//         expiry, attempts, bankCode, userName, fingerprint

/**
 * Creates an HMAC-SHA256 signed requestToken containing all HTOTP state.
 * @param {Object} data - Token payload data
 * @param {string} data.channel - 'SMS', 'EMAIL', or 'DUAL'
 * @param {string|null} data.mobileNumber - User's mobile number
 * @param {string|null} data.email - User's email
 * @param {string} data.nonce - 20-char random string
 * @param {string} data.txContext - Transaction context
 * @param {string} data.params - Unique request identifier
 * @param {string} data.bankCode - Bank code
 * @param {string} data.userName - Username
 * @param {string} data.feature - Feature name
 * @param {string} data.operationPerformed - Operation name
 * @param {string} data.fingerprint - Channel binding fingerprint
 * @param {number} data.validitySeconds - Token validity in seconds
 * @param {number} [data.attempts] - Max validation attempts
 * @returns {string} Signed token: base64url(payload).hex(signature)
 */
function createRequestToken(data) {
    const now = Date.now();
    const payload = JSON.stringify({
        v: 'HTOTP-v1',
        ch: data.channel || 'SMS',
        mn: data.mobileNumber || '',
        em: data.email || '',
        n: data.nonce,
        tx: data.txContext,
        p: data.params,
        bc: data.bankCode || '',
        un: data.userName,
        f: data.feature,
        op: data.operationPerformed,
        fp: data.fingerprint || '',
        ts: now,
        exp: now + (data.validitySeconds * 1000),
        att: data.attempts !== undefined ? data.attempts : MAX_OTP_ATTEMPTS,
    });
    const b64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', HTOTP_TOKEN_SIGNING_KEY).update(b64).digest('hex');
    return `${b64}.${sig}`;
}

/**
 * Verifies a requestToken's HMAC signature and returns the decoded payload.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {string} token - The requestToken string
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyRequestToken(token) {
    if (!token || typeof token !== 'string') return null;

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const b64 = token.substring(0, dotIndex);
    const sig = token.substring(dotIndex + 1);

    const expectedSig = crypto.createHmac('sha256', HTOTP_TOKEN_SIGNING_KEY).update(b64).digest('hex');

    // Timing-safe comparison
    if (sig.length !== expectedSig.length) return null;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            return null;
        }
    } catch (e) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
        return {
            version: payload.v,
            channel: payload.ch,
            mobileNumber: payload.mn || null,
            email: payload.em || null,
            nonce: payload.n,
            txContext: payload.tx,
            params: payload.p,
            bankCode: payload.bc || null,
            userName: payload.un,
            feature: payload.f,
            operationPerformed: payload.op,
            fingerprint: payload.fp || null,
            timestamp: payload.ts,
            expiry: payload.exp,
            attempts: payload.att,
        };
    } catch (e) {
        return null;
    }
}


// ─── SESSION TOKEN ───
// Issued after successful OTP validation — proof of verification.

/**
 * Creates a signed sessionToken after successful OTP validation.
 * @param {Object} data - Session payload
 * @returns {string} Signed session token
 */
function createSessionToken(data) {
    const payload = JSON.stringify({
        v: 'HTOTP-v1',
        id: data.identityKey,
        mn: data.mobileNumber || '',
        em: data.email || '',
        p: data.params,
        bc: data.bankCode || '',
        tx: data.txContext || '',
        ts: Date.now(),
    });
    const b64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', HTOTP_SESSION_SIGNING_KEY).update(b64).digest('hex');
    return `${b64}.${sig}`;
}

/**
 * Verifies a sessionToken's HMAC signature and checks expiry.
 * @param {string} token - The sessionToken string
 * @param {number} [maxAgeMs=300000] - Maximum age in ms (default 5 min)
 * @returns {Object|null} Decoded session data or null if invalid/expired
 */
function verifySessionToken(token, maxAgeMs = 5 * 60 * 1000) {
    if (!token || typeof token !== 'string') return null;

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const b64 = token.substring(0, dotIndex);
    const sig = token.substring(dotIndex + 1);

    const expectedSig = crypto.createHmac('sha256', HTOTP_SESSION_SIGNING_KEY).update(b64).digest('hex');

    if (sig.length !== expectedSig.length) return null;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            return null;
        }
    } catch (e) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
        const age = Date.now() - payload.ts;
        if (age > maxAgeMs) return null;

        return {
            identityKey: payload.id,
            mobileNumber: payload.mn || null,
            email: payload.em || null,
            params: payload.p,
            bankCode: payload.bc || null,
            txContext: payload.tx || null,
            timestamp: payload.ts,
        };
    } catch (e) {
        return null;
    }
}

module.exports = { createRequestToken, verifyRequestToken, createSessionToken, verifySessionToken };
