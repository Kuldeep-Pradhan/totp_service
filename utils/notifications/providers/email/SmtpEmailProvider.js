/**
 * SMTP Email Provider — Nodemailer
 * 
 * Sends real emails via any SMTP server (Gmail, Brevo, Outlook, etc.)
 * 
 * Required environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('[SmtpEmailProvider] Missing SMTP configuration. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT) || 587,
        secure: parseInt(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    return transporter;
}

async function send({ to, otp, purpose, subject }) {
    const transport = getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    const info = await transport.sendMail({
        from: `"HTOTP Service" <${fromAddress}>`,
        to,
        subject: subject || `Your OTP Code: ${purpose || 'Verification'}`,
        text: `Your One-Time Password is: ${otp}\n\nThis code will expire in 2 minutes.\nDo not share this code with anyone.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">🔐 Your OTP Code</h2>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; background: #f1f5f9; padding: 12px 24px; border-radius: 8px;">${otp}</span>
                </div>
                <p style="color: #64748b; text-align: center; font-size: 14px;">
                    This code will expire in <strong>2 minutes</strong>.<br/>
                    Do not share this code with anyone.
                </p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Purpose: ${purpose || 'Verification'} | Powered by HTOTP Engine
                </p>
            </div>
        `,
    });

    console.log(`[SmtpEmailProvider] Email sent to ${to} | messageId=${info.messageId}`);

    return {
        success: true,
        channel: 'EMAIL',
        provider: 'smtp',
        messageId: info.messageId,
    };
}

module.exports = { send };
