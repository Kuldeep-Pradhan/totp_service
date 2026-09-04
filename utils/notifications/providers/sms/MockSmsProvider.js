/**
 * Mock SMS Provider — Console Logger
 * 
 * ⚠️ DEVELOPMENT MODE ONLY
 * This provider does NOT send real SMS messages.
 * It logs the OTP to the console for testing purposes.
 * 
 * In production, integrate a real SMS gateway (Twilio, Fast2SMS, etc.)
 * by creating a new provider implementing the same interface.
 */

const SMS_DISCLAIMER = "⚠️ SMS provider is not integrated. OTP is included in the API response for testing purposes only. In production, the OTP will be delivered via SMS and will NOT appear in the response.";

async function send({ to, otp, purpose }) {
    console.log(`\n┌──────────────────────────────────────────────────┐`);
    console.log(`│  📱 MOCK SMS (No real SMS sent)                  │`);
    console.log(`├──────────────────────────────────────────────────┤`);
    console.log(`│  To:      ${(to || 'N/A').padEnd(38)}│`);
    console.log(`│  OTP:     ${String(otp).padEnd(38)}│`);
    console.log(`│  Purpose: ${(purpose || 'N/A').padEnd(38)}│`);
    console.log(`└──────────────────────────────────────────────────┘\n`);

    return {
        success: true,
        channel: 'SMS',
        provider: 'mock',
        disclaimer: SMS_DISCLAIMER,
    };
}

module.exports = { send, SMS_DISCLAIMER };
