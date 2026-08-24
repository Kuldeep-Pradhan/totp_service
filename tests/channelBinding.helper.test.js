// ─────────────────────────────────────────────────────────────────────
// Channel Binding Helper — Unit Tests
// ─────────────────────────────────────────────────────────────────────

const { createFingerprint, verifyFingerprint } = require('../utils/helper/channelBinding.helper');

// Helper to create a mock Express request
function mockReq(overrides = {}) {
    return {
        ip: '192.168.1.100',
        connection: { remoteAddress: '192.168.1.100' },
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'origin': 'https://bank.example.com',
            ...overrides.headers,
        },
        ...overrides,
    };
}

describe('Channel Binding Helper', () => {

    // ─── createFingerprint ───
    describe('createFingerprint', () => {
        test('should return a 64-char hex string (SHA-256)', () => {
            const fp = createFingerprint(mockReq());
            expect(fp).toMatch(/^[a-f0-9]{64}$/);
        });

        test('should be deterministic for same request properties', () => {
            const req = mockReq();
            const fp1 = createFingerprint(req);
            const fp2 = createFingerprint(req);
            expect(fp1).toBe(fp2);
        });

        test('should differ when IP changes', () => {
            const fp1 = createFingerprint(mockReq({ ip: '10.0.0.1' }));
            const fp2 = createFingerprint(mockReq({ ip: '10.0.0.2' }));
            expect(fp1).not.toBe(fp2);
        });

        test('should differ when User-Agent changes', () => {
            const fp1 = createFingerprint(mockReq({ headers: { 'user-agent': 'Chrome' } }));
            const fp2 = createFingerprint(mockReq({ headers: { 'user-agent': 'Firefox' } }));
            expect(fp1).not.toBe(fp2);
        });

        test('should handle missing headers gracefully', () => {
            const req = { ip: '10.0.0.1', headers: {} };
            const fp = createFingerprint(req);
            expect(fp).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    // ─── verifyFingerprint ───
    describe('verifyFingerprint', () => {
        test('should return true when fingerprints match', () => {
            const req = mockReq();
            const fp = createFingerprint(req);
            expect(verifyFingerprint(req, fp)).toBe(true);
        });

        test('should return false when fingerprints differ', () => {
            const req1 = mockReq({ ip: '10.0.0.1' });
            const fp = createFingerprint(req1);

            const req2 = mockReq({ ip: '10.0.0.2' });
            expect(verifyFingerprint(req2, fp)).toBe(false);
        });

        test('should return true when storedFingerprint is null (graceful fallback)', () => {
            const req = mockReq();
            expect(verifyFingerprint(req, null)).toBe(true);
        });

        test('should return true when storedFingerprint is undefined', () => {
            const req = mockReq();
            expect(verifyFingerprint(req, undefined)).toBe(true);
        });

        test('should return false for malformed fingerprint', () => {
            const req = mockReq();
            expect(verifyFingerprint(req, 'not-a-valid-hex-fingerprint')).toBe(false);
        });
    });
});
