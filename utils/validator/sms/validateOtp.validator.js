const { body } = require("express-validator")

// ─── validateOTP validator ───
// Optimized: only requestToken + otp needed (all context extracted from token)
const validateOtpValidation = () => {
    return [
        body("requestToken")
            .notEmpty()
            .withMessage("requestToken is required")
            .bail({ level: "request" })
            .isString()
            .withMessage("requestToken must be a string"),
        body("otp")
            .exists()
            .withMessage("OTP is required")
            .bail({ level: "request" })
            .notEmpty()
            .withMessage("Please provide a valid otp")
            .bail({ level: "request" })
            .matches(/^\d{6,8}$/)
            .withMessage("OTP must be a 6 to 8 digit number")
    ]
}

module.exports = { validateOtpValidation }
