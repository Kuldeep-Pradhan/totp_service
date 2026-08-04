const speakeasy = require('speakeasy');
const {
    generateDeterministicSecret,
    generateOtp,
    verifyOtp,
} = require('../utils/helper/totp.helper');

// Mock TOTP_MASTER_KEY for tests
jest.mock('../utils/config/env', () => ({
    TOTP_MASTER_KEY: 'test-master-key-12345'
}));

describe('TOTP Helper Utilities', () => {
    describe('generateDeterministicSecret', () => {
        it('should generate a deterministic secret for the same inputs', () => {
            const secret1 = generateDeterministicSecret('1234567890', 'login');
            const secret2 = generateDeterministicSecret('1234567890', 'login');
            expect(secret1).toBe(secret2);
        });

        it('should generate different secrets for different mobile numbers', () => {
            const secret1 = generateDeterministicSecret('1234567890', 'login');
            const secret2 = generateDeterministicSecret('0987654321', 'login');
            expect(secret1).not.toBe(secret2);
        });

        it('should generate different secrets for different params', () => {
            const secret1 = generateDeterministicSecret('1234567890', 'login');
            const secret2 = generateDeterministicSecret('1234567890', 'verify');
            expect(secret1).not.toBe(secret2);
        });
    });

    describe('generateOtp', () => {
        it('should generate a 6-digit OTP code', () => {
            const secret = generateDeterministicSecret('1234567890', 'login');
            const otp = generateOtp(secret);
            
            expect(typeof otp).toBe('string');
            expect(otp.length).toBe(6);
            expect(/^\d{6}$/.test(otp)).toBe(true);
        });
    });

    describe('verifyOtp', () => {
        it('should return true for a valid OTP within the validity window', () => {
            const secret = generateDeterministicSecret('1234567890', 'login');
            const validOtp = generateOtp(secret);
            
            const isValid = verifyOtp(secret, validOtp, 300); // 5 mins validity
            expect(isValid).toBe(true);
        });

        it('should return false for an invalid OTP', () => {
            const secret = generateDeterministicSecret('1234567890', 'login');
            const wrongSecret = generateDeterministicSecret('9999999999', 'login');
            const wrongOtp = generateOtp(wrongSecret);
            
            const isWrongOtpValid = verifyOtp(secret, wrongOtp, 300);
            expect(isWrongOtpValid).toBe(false);
        });

        it('should handle numeric tokens by casting them internally', () => {
            const secret = generateDeterministicSecret('1234567890', 'login');
            const validOtpStr = generateOtp(secret);
            const validOtpNum = parseInt(validOtpStr, 10);
            
            const result = verifyOtp(secret, validOtpNum, 300);
            if (validOtpStr.length === String(validOtpNum).length) {
                expect(result).toBe(true);
            }
        });
    });
});
