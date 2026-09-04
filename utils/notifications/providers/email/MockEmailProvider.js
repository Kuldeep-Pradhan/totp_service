/**
 * Mock Email Provider — Console Logger
 * 
 * Prints a formatted email preview in the terminal.
 * Zero setup required — no SMTP credentials needed.
 */

async function send({ to, otp, purpose, subject }) {
    console.log(`\n┌──────────────────────────────────────────────────┐`);
    console.log(`│  📧 MOCK EMAIL (No real email sent)              │`);
    console.log(`├──────────────────────────────────────────────────┤`);
    console.log(`│  To:      ${(to || 'N/A').padEnd(38)}│`);
    console.log(`│  Subject: ${(subject || 'Your OTP Code').padEnd(38)}│`);
    console.log(`│  OTP:     ${String(otp).padEnd(38)}│`);
    console.log(`│  Purpose: ${(purpose || 'N/A').padEnd(38)}│`);
    console.log(`└──────────────────────────────────────────────────┘\n`);

    return {
        success: true,
        channel: 'EMAIL',
        provider: 'mock',
    };
}

module.exports = { send };
