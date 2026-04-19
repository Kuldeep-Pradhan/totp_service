const { body } = require("express-validator")

// ─── validateOTP validator ───
// Optimized: only requestToken + otp needed (mobileNumber/params extracted from token)
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
            .matches(/^\d{6}$/)
            .withMessage("OTP must be a 6 digit number")
    ]
}

module.exports = { validateOtpValidation }
