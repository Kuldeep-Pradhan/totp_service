// ─── Bank-code specific OTP validity configuration (in seconds) ───
// Add/modify entries here to set custom OTP validity per bank code.
const OTP_VALIDITY_CONFIG = {
    IDBI: 300,    // 5 minutes
    SBI: 180,     // 3 minutes
    HDFC: 300,    // 5 minutes
    // Add more bank codes as needed...
};

// Default validity when no bankCode is provided or bankCode is not in the config
const DEFAULT_OTP_VALIDITY = 120; // 2 minutes

/**
 * Returns OTP validity in seconds for a given bankCode.
 * Falls back to DEFAULT_OTP_VALIDITY (2 min) if bankCode is absent or not configured.
 */
const getOtpValiditySeconds = (bankCode) => {
    if (!bankCode) return DEFAULT_OTP_VALIDITY;
    return OTP_VALIDITY_CONFIG[bankCode.toUpperCase()] || DEFAULT_OTP_VALIDITY;
};

module.exports = { OTP_VALIDITY_CONFIG, DEFAULT_OTP_VALIDITY, getOtpValiditySeconds };
