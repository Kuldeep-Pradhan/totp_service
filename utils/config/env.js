const environment = process.env;

module.exports = {
    env: environment.NODE_ENV || 'development',
    otp_length: parseInt(environment.OTP_DIGITS) || 6,
    TOTP_TIME_STEP: parseInt(environment.TOTP_TIME_STEP) || 30,
    MAX_OTP_ATTEMPTS: parseInt(environment.MAX_OTP_ATTEMPTS) || 3,
    OTP_VALIDITY_SECONDS: parseInt(environment.OTP_VALIDITY_SECONDS) || 120,
    // 3-Key Architecture
    HTOTP_MASTER_KEY: environment.HTOTP_MASTER_KEY || environment.TOTP_MASTER_KEY || 'htotp-default-master-key-change-in-production',
    HTOTP_TOKEN_SIGNING_KEY: environment.HTOTP_TOKEN_SIGNING_KEY || 'htotp-default-token-key-change-in-production',
    HTOTP_SESSION_SIGNING_KEY: environment.HTOTP_SESSION_SIGNING_KEY || 'htotp-default-session-key-change-in-production',
    // Notification Providers
    EMAIL_PROVIDER: environment.EMAIL_PROVIDER || 'mock',
    SMS_PROVIDER: environment.SMS_PROVIDER || 'mock',
    // Legacy (kept for backward compat)
    TOTP_MASTER_KEY: environment.TOTP_MASTER_KEY,
    REDIS_SECRET_NAME: environment.REDIS_SECRET_NAME,
};
