const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const smsController = require("../controller/sms.controller");
const {
  requestOtpValidation,
  resendOtpValidation,
} = require("../utils/validator/sms/requestAndResendOtp.validator");
const { validateOtpValidation } = require("../utils/validator/sms/validateOtp.validator");
const validationResult = require("../utils/validator/validationResult");

// ─── Rate limiters (per IP) ───
const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // max 20 OTP requests per window
  message: { success: false, status: -1, displayMessage: "Too many OTP requests. Please try again later.", err_type: "RateLimitError", errorCode: "RATE0001" },
});

const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                  // max 10 resends per window
  message: { success: false, status: -1, displayMessage: "Too many resend attempts. Please try again later.", err_type: "RateLimitError", errorCode: "RATE0001" },
});

const validateOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                  // max 10 validation attempts per window (prevents brute-force)
  message: { success: false, status: -1, displayMessage: "Too many validation attempts. Please try again later.", err_type: "RateLimitError", errorCode: "RATE0001" },
});

router.post(
  "/requestOTP",
  requestOtpLimiter,
  requestOtpValidation(),
  validationResult,
  smsController.requestOtp
);

router.post(
  "/resendOTP",
  resendOtpLimiter,
  resendOtpValidation(),
  validationResult,
  smsController.resendOtp
)

router.post(
  "/validateOTP",
  validateOtpLimiter,
  validateOtpValidation(),
  validationResult,
  smsController.validateOtp
)

module.exports = router;
