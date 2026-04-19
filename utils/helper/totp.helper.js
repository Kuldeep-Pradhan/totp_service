const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { TOTP_MASTER_KEY } = require('../config/env');

/**
 * Generates a deterministic TOTP secret from mobileNumber + params.
 * Same inputs always produce the same secret — no DB needed.
 */
const generateDeterministicSecret = (mobileNumber, params) => {
    const hmac = crypto.createHmac('sha256', TOTP_MASTER_KEY);
    hmac.update(`${mobileNumber}:${params}`);
    return hmac.digest('hex');
};

/**
 * Generates the current 6-digit TOTP code for the given secret.
 * step = 30s (standard TOTP window).
 */
const generateOtp = (secret) => {
    return speakeasy.totp({
        secret: secret,
        encoding: 'hex',
        step: 30,
        digits: 6,
    });
};

/**
 * Verifies a TOTP token against the secret.
 * @param {string} secret - hex-encoded TOTP secret
 * @param {string} token - 6-digit OTP submitted by user
 * @param {number} validitySeconds - how long the OTP should be valid (in seconds)
 * @returns {boolean} true if token is valid within the window
 */
const verifyOtp = (secret, token, validitySeconds) => {
    // Window = number of 30s steps to check before/after current step.
    // This ensures any code generated within the validity period is accepted.
    const windowSize = Math.ceil(validitySeconds / 30) + 1;

    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'hex',
        token: String(token),
        step: 30,
        window: windowSize,
    });
};

module.exports = { generateDeterministicSecret, generateOtp, verifyOtp };
