const crypto = require('crypto');

/**
 * Creates a SHA-256 fingerprint from the client's request properties.
 * Used for channel binding — ties the OTP token to the originating client.
 * @param {Object} req - Express request object
 * @returns {string} Hex-encoded SHA-256 hash of client properties
 */
function createFingerprint(req) {
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const origin = req.headers['origin'] || req.headers['referer'] || 'unknown';

    const data = `${clientIP}|${userAgent}|${origin}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verifies that the current request's fingerprint matches the stored one.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {Object} req - Express request object
 * @param {string} storedFingerprint - Hex fingerprint from the requestToken
 * @returns {boolean} true if fingerprints match
 */
function verifyFingerprint(req, storedFingerprint) {
    if (!storedFingerprint) return true; // Graceful fallback if no fingerprint stored

    const currentFingerprint = createFingerprint(req);

    try {
        const currentBuf = Buffer.from(currentFingerprint, 'hex');
        const storedBuf = Buffer.from(storedFingerprint, 'hex');

        if (currentBuf.length !== storedBuf.length) return false;
        return crypto.timingSafeEqual(currentBuf, storedBuf);
    } catch (e) {
        return false;
    }
}

module.exports = { createFingerprint, verifyFingerprint };
