// ─────────────────────────────────────────────────────────────────────
// HTOTP Engine — Unit Tests
// ─────────────────────────────────────────────────────────────────────

// Mock env before requiring the module
process.env.HTOTP_MASTER_KEY = 'a'.repeat(64);
process.env.OTP_DIGITS = '6';
process.env.TOTP_TIME_STEP = '30';

const {
    generateNonce,
    constructSalt,
    deriveKey,
    dynamicTruncate,
    generateHtotpCode,
    verifyHtotpCode,
    computeTimeStep,
    buildTxContext,
} = require('../utils/helper/htotp.helper');

describe('HTOTP Helper', () => {

    // ─── generateNonce ───
    describe('generateNonce', () => {
        test('should generate a 20-character string', () => {
            const nonce = generateNonce();
            expect(nonce).toHaveLength(20);
        });

        test('should only contain alphanumeric characters', () => {
            const nonce = generateNonce();
            expect(nonce).toMatch(/^[a-zA-Z0-9]+$/);
        });

        test('should generate unique nonces', () => {
            const nonces = new Set();
            for (let i = 0; i < 100; i++) {
                nonces.add(generateNonce());
            }
            // All 100 should be unique (collision probability is negligible)
            expect(nonces.size).toBe(100);
        });
    });

    // ─── constructSalt ───
    describe('constructSalt', () => {
        const nonce = 'aB3kL9xmPq7RtW2nYsZv';

        test('SMS mode: mobileNumber + nonce', () => {
            const salt = constructSalt('SMS', '9876543210', null, nonce);
            expect(salt).toBe('9876543210aB3kL9xmPq7RtW2nYsZv');
        });

        test('EMAIL mode: email + nonce', () => {
            const salt = constructSalt('EMAIL', null, 'user@bank.com', nonce);
            expect(salt).toBe('user@bank.comaB3kL9xmPq7RtW2nYsZv');
        });

        test('DUAL mode: email + mobileNumber + nonce', () => {
            const salt = constructSalt('DUAL', '9876543210', 'user@bank.com', nonce);
            expect(salt).toBe('user@bank.com9876543210aB3kL9xmPq7RtW2nYsZv');
        });

        test('default channel should behave like SMS', () => {
            const salt = constructSalt('UNKNOWN', '9876543210', null, nonce);
            expect(salt).toBe('9876543210aB3kL9xmPq7RtW2nYsZv');
        });
    });

    // ─── deriveKey ───
    describe('deriveKey', () => {
        test('should return a 32-byte Buffer', () => {
            const key = deriveKey('9876543210testNonce12345');
            expect(Buffer.isBuffer(key)).toBe(true);
            expect(key.length).toBe(32);
        });

        test('should be deterministic for same input', () => {
            const key1 = deriveKey('same-salt-input');
            const key2 = deriveKey('same-salt-input');
            expect(key1.equals(key2)).toBe(true);
        });

        test('should produce different keys for different salts', () => {
            const key1 = deriveKey('salt-one');
            const key2 = deriveKey('salt-two');
            expect(key1.equals(key2)).toBe(false);
        });
    });

    // ─── dynamicTruncate ───
    describe('dynamicTruncate', () => {
        test('should return a non-negative 31-bit integer', () => {
            const key = deriveKey('test-salt');
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha256', key).update('test-message').digest();
            const result = dynamicTruncate(hmac);

            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(Math.pow(2, 31));
        });

        test('should be deterministic for same HMAC input', () => {
            const crypto = require('crypto');
            const key = deriveKey('test-salt');
            const hmac1 = crypto.createHmac('sha256', key).update('same-msg').digest();
            const hmac2 = crypto.createHmac('sha256', key).update('same-msg').digest();
            expect(dynamicTruncate(hmac1)).toBe(dynamicTruncate(hmac2));
        });
    });

    // ─── generateHtotpCode ───
    describe('generateHtotpCode', () => {
        const derivedKey = deriveKey('9876543210testNonce12345');
        const timeStep = 57483749;
        const nonce = 'aB3kL9xmPq7RtW2nYsZv';
        const txContext = 'LOGIN:OTP_VERIFICATION';

        test('should return a 6-digit string', () => {
            const otp = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 6);
            expect(otp).toMatch(/^\d{6}$/);
        });

        test('should return an 8-digit string when digits=8', () => {
            const otp = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 8);
            expect(otp).toMatch(/^\d{8}$/);
        });

        test('should be deterministic for same inputs', () => {
            const otp1 = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 6);
            const otp2 = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 6);
            expect(otp1).toBe(otp2);
        });

        test('different nonce should produce different OTP', () => {
            const otp1 = generateHtotpCode(derivedKey, timeStep, 'nonceAAAAAAAAAAAAAAAA', txContext, 6);
            const otp2 = generateHtotpCode(derivedKey, timeStep, 'nonceBBBBBBBBBBBBBBBB', txContext, 6);
            expect(otp1).not.toBe(otp2);
        });

        test('different txContext should produce different OTP', () => {
            const otp1 = generateHtotpCode(derivedKey, timeStep, nonce, 'LOGIN:OTP_VERIFICATION', 6);
            const otp2 = generateHtotpCode(derivedKey, timeStep, nonce, 'TRANSFER:FUND_TRANSFER', 6);
            expect(otp1).not.toBe(otp2);
        });

        test('different timeStep should produce different OTP', () => {
            const otp1 = generateHtotpCode(derivedKey, 57483749, nonce, txContext, 6);
            const otp2 = generateHtotpCode(derivedKey, 57483750, nonce, txContext, 6);
            expect(otp1).not.toBe(otp2);
        });
    });

    // ─── verifyHtotpCode ───
    describe('verifyHtotpCode', () => {
        const derivedKey = deriveKey('9876543210verifyNonce1234');
        const timeStep = 57483749;
        const nonce = 'verifyNonce123456789a';
        const txContext = 'LOGIN:OTP_VERIFICATION';

        test('should return true for correct OTP', () => {
            const otp = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 6);
            const result = verifyHtotpCode(derivedKey, timeStep, nonce, txContext, otp, 6);
            expect(result).toBe(true);
        });

        test('should return false for incorrect OTP', () => {
            const result = verifyHtotpCode(derivedKey, timeStep, nonce, txContext, '000000', 6);
            expect(result).toBe(false);
        });

        test('should return false for wrong txContext', () => {
            const otp = generateHtotpCode(derivedKey, timeStep, nonce, txContext, 6);
            const result = verifyHtotpCode(derivedKey, timeStep, nonce, 'TRANSFER:FUND', otp, 6);
            expect(result).toBe(false);
        });
    });

    // ─── computeTimeStep ───
    describe('computeTimeStep', () => {
        test('should return an integer', () => {
            const step = computeTimeStep();
            expect(Number.isInteger(step)).toBe(true);
        });

        test('should compute correctly from a known timestamp', () => {
            // 1716500010000ms = 1716500010s → floor(1716500010 / 30) = 57216667
            const step = computeTimeStep(1716500010000);
            expect(step).toBe(57216667);
        });

        test('timestamps within same 30s window should return same step', () => {
            // Both 1716500010s and 1716500020s → floor(x/30) = 57216667
            const step1 = computeTimeStep(1716500010000);
            const step2 = computeTimeStep(1716500020000); // +10 seconds, same window
            expect(step1).toBe(step2);
        });

        test('timestamps in different 30s windows should return different steps', () => {
            // 1716500010s → step 57216667, 1716500040s → step 57216668
            const step1 = computeTimeStep(1716500010000);
            const step2 = computeTimeStep(1716500040000); // +30 seconds
            expect(step2).toBe(step1 + 1);
        });
    });

    // ─── buildTxContext ───
    describe('buildTxContext', () => {
        test('should concatenate feature and operation', () => {
            expect(buildTxContext('LOGIN', 'OTP_VERIFICATION')).toBe('LOGIN:OTP_VERIFICATION');
        });

        test('should uppercase the result', () => {
            expect(buildTxContext('login', 'otp_verification')).toBe('LOGIN:OTP_VERIFICATION');
        });

        test('should include extra params when provided', () => {
            expect(buildTxContext('TRANSFER', 'FUND_TRANSFER', '500:ACC123')).toBe('TRANSFER:FUND_TRANSFER:500:ACC123');
        });
    });
});
