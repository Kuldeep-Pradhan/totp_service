const crypto = require('crypto');
const { TOTP_MASTER_KEY } = require('../config/env');

// Separate secrets for request tokens vs session tokens
const REQUEST_TOKEN_SECRET = TOTP_MASTER_KEY + ':request-token';
const SESSION_TOKEN_SECRET = TOTP_MASTER_KEY + ':session-token';

// ─── REQUEST TOKEN ───
// Embeds: identityKey, mobileNumber, email, params, bankCode, user_name, feature, operationPerformed, timestamp
// Signed with HMAC-SHA256 — tamper-proof, carries all state the server needs for resend/validate

function createRequestToken(data) {
    const payload = JSON.stringify({
        id: data.identityKey,
        mn: data.mobileNumber || '',
        em: data.email || '',
        p: data.params,
        bc: data.bankCode || '',
        un: data.user_name,
        f: data.feature,
        op: data.operationPerformed,
        ts: Date.now(),
    });
    const b64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', REQUEST_TOKEN_SECRET).update(b64).digest('hex');
    return `${b64}.${sig}`;
}

function verifyRequestToken(token) {
    if (!token || typeof token !== 'string') return null;

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const b64 = token.substring(0, dotIndex);
    const sig = token.substring(dotIndex + 1);

    const expectedSig = crypto.createHmac('sha256', REQUEST_TOKEN_SECRET).update(b64).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
        return {
            identityKey: payload.id,
            mobileNumber: payload.mn || null,
            email: payload.em || null,
            params: payload.p,
            bankCode: payload.bc || null,
            user_name: payload.un,
            feature: payload.f,
            operationPerformed: payload.op,
            timestamp: payload.ts,
        };
    } catch (e) {
        return null;
    }
}

// ─── SESSION TOKEN ───
// Issued after successful OTP validation — proof that the user verified their identity.
// The client presents this on subsequent requests; the server just verifies the HMAC signature.

function createSessionToken(data) {
    const payload = JSON.stringify({
        id: data.identityKey,
        mn: data.mobileNumber || '',
        em: data.email || '',
        p: data.params,
        bc: data.bankCode || '',
        ts: Date.now(),
    });
    const b64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(b64).digest('hex');
    return `${b64}.${sig}`;
}

function verifySessionToken(token, maxAgeMs = 5 * 60 * 1000) {
    if (!token || typeof token !== 'string') return null;

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const b64 = token.substring(0, dotIndex);
    const sig = token.substring(dotIndex + 1);

    const expectedSig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(b64).digest('hex');

    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
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
            timestamp: payload.ts,
        };
    } catch (e) {
        return null;
    }
}

module.exports = { createRequestToken, verifyRequestToken, createSessionToken, verifySessionToken };
