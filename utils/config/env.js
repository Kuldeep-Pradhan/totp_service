const environment = process.env;

module.exports = {
    env: environment.NODE_ENV || 'development',
    Send_Notification_URL: environment.Send_Notification_URL,
    otp_length: 6,
    TOTP_MASTER_KEY: environment.TOTP_MASTER_KEY || 'otp-service-default-master-key-change-in-production',
};
