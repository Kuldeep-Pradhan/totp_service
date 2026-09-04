/**
 * NotificationEngine — Pluggable Multi-Channel Notification Facade
 * 
 * Dispatches OTP notifications to the appropriate provider based on
 * channel (SMS/EMAIL/DUAL) and environment configuration.
 * 
 * Architecture:
 *   - EMAIL_PROVIDER env → 'smtp' | 'mock' (default: 'mock')
 *   - SMS_PROVIDER env   → 'mock' (only mock supported currently)
 * 
 * Adding a new provider:
 *   1. Create a file in providers/<channel>/<Name>Provider.js
 *   2. Export an async `send({ to, otp, purpose })` function
 *   3. Register it in the provider map below
 */

const { SMS_DISCLAIMER } = require('./providers/sms/MockSmsProvider');

// ─── Provider Registry ───
function getEmailProvider() {
    const provider = (process.env.EMAIL_PROVIDER || 'mock').toLowerCase();

    switch (provider) {
        case 'smtp':
            return require('./providers/email/SmtpEmailProvider');
        case 'mock':
        default:
            return require('./providers/email/MockEmailProvider');
    }
}

function getSmsProvider() {
    // SMS provider is currently mock-only.
    // To integrate Twilio/Fast2SMS, create the provider and add a case here.
    return require('./providers/sms/MockSmsProvider');
}

// ─── Main Dispatch ───

/**
 * Send OTP notification via the configured providers.
 * 
 * @param {Object} options
 * @param {string} options.channel - 'SMS' | 'EMAIL' | 'DUAL'
 * @param {string} [options.mobileNumber] - Required for SMS/DUAL
 * @param {string} [options.email] - Required for EMAIL/DUAL
 * @param {string} options.otp - The OTP code to deliver
 * @param {string} [options.purpose] - e.g. 'LOGIN', 'PAYMENT'
 * @param {string} [options.userName] - User identifier for logging
 * @returns {Object} { results: [...], smsDisclaimer?: string }
 */
async function send({ channel, mobileNumber, email, otp, purpose, userName }) {
    const results = [];
    let smsDisclaimer = null;

    const upperChannel = (channel || 'SMS').toUpperCase();

    // ─── SMS Channel ───
    if (upperChannel === 'SMS' || upperChannel === 'DUAL') {
        try {
            const smsProvider = getSmsProvider();
            const smsResult = await smsProvider.send({
                to: mobileNumber,
                otp,
                purpose,
            });
            results.push(smsResult);

            // If using mock provider, attach the disclaimer
            if (smsResult.provider === 'mock') {
                smsDisclaimer = SMS_DISCLAIMER;
            }
        } catch (error) {
            console.error(`[NotificationEngine] SMS send failed:`, error.message);
            results.push({ success: false, channel: 'SMS', error: error.message });
        }
    }

    // ─── EMAIL Channel ───
    if (upperChannel === 'EMAIL' || upperChannel === 'DUAL') {
        try {
            const emailProvider = getEmailProvider();
            const emailResult = await emailProvider.send({
                to: email,
                otp,
                purpose,
                subject: `Your OTP Code — ${purpose || 'Verification'}`,
            });
            results.push(emailResult);
        } catch (error) {
            console.error(`[NotificationEngine] EMAIL send failed:`, error.message);
            results.push({ success: false, channel: 'EMAIL', error: error.message });
        }
    }

    // ─── Validate at least one channel succeeded ───
    const successCount = results.filter(r => r.success).length;

    return {
        results,
        successCount,
        smsDisclaimer,
    };
}

module.exports = { send };
