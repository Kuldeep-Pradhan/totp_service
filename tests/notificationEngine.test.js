const { send } = require('../utils/notifications/NotificationEngine');

describe('NotificationEngine (Mock Providers)', () => {
    let originalEnv;

    beforeAll(() => {
        originalEnv = { ...process.env };
        process.env.EMAIL_PROVIDER = 'mock';
        process.env.SMS_PROVIDER = 'mock';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should dispatch to MockSmsProvider for SMS channel', async () => {
        const result = await send({
            channel: 'SMS',
            mobileNumber: '9876543210',
            otp: '123456',
            purpose: 'TEST',
            userName: 'testuser'
        });

        expect(result.successCount).toBe(1);
        expect(result.results.length).toBe(1);
        expect(result.results[0].provider).toBe('mock');
        expect(result.results[0].channel).toBe('SMS');
        expect(result.smsDisclaimer).toBeDefined();
        expect(result.smsDisclaimer).toContain('testing purposes only');
    });

    it('should dispatch to MockEmailProvider for EMAIL channel', async () => {
        const result = await send({
            channel: 'EMAIL',
            email: 'test@example.com',
            otp: '123456',
            purpose: 'TEST',
            userName: 'testuser'
        });

        expect(result.successCount).toBe(1);
        expect(result.results.length).toBe(1);
        expect(result.results[0].provider).toBe('mock');
        expect(result.results[0].channel).toBe('EMAIL');
        expect(result.smsDisclaimer).toBeNull();
    });

    it('should dispatch to both providers for DUAL channel', async () => {
        const result = await send({
            channel: 'DUAL',
            mobileNumber: '9876543210',
            email: 'test@example.com',
            otp: '123456',
            purpose: 'TEST',
            userName: 'testuser'
        });

        expect(result.successCount).toBe(2);
        expect(result.results.length).toBe(2);
        const channels = result.results.map(r => r.channel);
        expect(channels).toContain('SMS');
        expect(channels).toContain('EMAIL');
        expect(result.smsDisclaimer).toBeDefined();
    });
});
