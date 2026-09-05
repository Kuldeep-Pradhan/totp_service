const environment = process.env;

const envConfig = {
    env: environment.NODE_ENV || 'development',
    otp_length: parseInt(environment.OTP_DIGITS) || 6,
    TOTP_TIME_STEP: parseInt(environment.TOTP_TIME_STEP) || 30,
    MAX_OTP_ATTEMPTS: parseInt(environment.MAX_OTP_ATTEMPTS) || 3,
    OTP_VALIDITY_SECONDS: parseInt(environment.OTP_VALIDITY_SECONDS) || 120,
    // 3-Key Architecture (Fallbacks are strictly 64-char / 32-byte valid hex strings)
    HTOTP_MASTER_KEY: environment.HTOTP_MASTER_KEY || environment.TOTP_MASTER_KEY || '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    HTOTP_TOKEN_SIGNING_KEY: environment.HTOTP_TOKEN_SIGNING_KEY || 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    HTOTP_SESSION_SIGNING_KEY: environment.HTOTP_SESSION_SIGNING_KEY || '9999999999abcdef9999999999abcdef9999999999abcdef9999999999abcdef',
    // Notification Providers
    EMAIL_PROVIDER: environment.EMAIL_PROVIDER || 'mock',
    SMS_PROVIDER: environment.SMS_PROVIDER || 'mock',
    // Legacy (kept for backward compat)
    TOTP_MASTER_KEY: environment.TOTP_MASTER_KEY,
    REDIS_SECRET_NAME: environment.REDIS_SECRET_NAME,
};

// ─── Startup Validation ───
const hexRegex = /^[0-9a-fA-F]+$/;

function validateHexKey(keyName, keyValue, requiredBytes = 32) {
    if (!keyValue || typeof keyValue !== 'string') {
        throw new Error(`[CRITICAL] ${keyName} is missing or invalid type.`);
    }
    if (!hexRegex.test(keyValue)) {
        throw new Error(`[CRITICAL] ${keyName} contains invalid non-hex characters. This causes silent buffer truncation!`);
    }
    if (keyValue.length < requiredBytes * 2) {
        throw new Error(`[CRITICAL] ${keyName} must be at least ${requiredBytes} bytes (${requiredBytes * 2} hex chars) long. Got ${keyValue.length} chars.`);
    }
}

// Validate all cryptographic keys fail-fast on startup
validateHexKey('HTOTP_MASTER_KEY', envConfig.HTOTP_MASTER_KEY, 32);
validateHexKey('HTOTP_TOKEN_SIGNING_KEY', envConfig.HTOTP_TOKEN_SIGNING_KEY, 32);
validateHexKey('HTOTP_SESSION_SIGNING_KEY', envConfig.HTOTP_SESSION_SIGNING_KEY, 32);

if (envConfig.env === 'production') {
    // Ensure we aren't using the dev fallback keys in prod
    const isFallback = [
        envConfig.HTOTP_MASTER_KEY,
        envConfig.HTOTP_TOKEN_SIGNING_KEY,
        envConfig.HTOTP_SESSION_SIGNING_KEY
    ].some(key => key.includes('1234567890abcdef') || key.includes('abcdef1234567890') || key.includes('9999999999abcdef'));
    
    if (isFallback) {
        throw new Error("[CRITICAL] Cannot use default fallback cryptographic keys in production!");
    }
}

module.exports = envConfig;
