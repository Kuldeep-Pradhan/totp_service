const { body } = require("express-validator");

// ─── requestOTP validator ───
const requestOtpValidation = () => {
    return [
        body("channel")
            .optional()
            .isIn(['SMS', 'EMAIL', 'DUAL'])
            .withMessage("channel must be one of: SMS, EMAIL, DUAL"),
        body("user_name").optional().isString(),
        body("feature").optional().isString(),
        body("operationPerformed").optional().isString(),
        body().custom((value, { req }) => {
            const channel = req.body.channel || 'SMS';
            const hasMobile = req.body.mobileNumber && req.body.mobileNumber.trim() !== '';
            const hasEmail = req.body.email && req.body.email.trim() !== '';

            if (channel === 'SMS' && !hasMobile) {
                throw new Error("mobileNumber is required for SMS channel");
            }
            if (channel === 'EMAIL' && !hasEmail) {
                throw new Error("email is required for EMAIL channel");
            }
            if (channel === 'DUAL') {
                if (!hasMobile) throw new Error("mobileNumber is required for DUAL channel");
                if (!hasEmail) throw new Error("email is required for DUAL channel");
            }
            if (!channel && !hasMobile && !hasEmail) {
                throw new Error("Either mobileNumber or email is required");
            }
            return true;
        }),
        body("mobileNumber")
            .optional({ checkFalsy: true })
            .matches(/^[6-9]\d{9}$/)
            .withMessage("Please provide a valid mobile number"),
        body("bankCode").optional().isString(),
        body("params")
            .notEmpty()
            .withMessage("Params is required (used for deduplication)")
            .bail({ level: "request" })
            .isString()
            .withMessage("Params must be a string")
            .trim()
            .matches(/^[a-zA-Z0-9]{30}$/)
            .withMessage("Params must be exactly 30 alphanumeric characters"),
        body("messageData").optional().isObject(),
        body("email")
            .optional({ checkFalsy: true })
            .isString()
            .withMessage("Email must be a string"),
        body("status").optional().isString(),
    ];
};

// ─── resendOTP validator ───
const resendOtpValidation = () => {
    return [
        body("requestToken")
            .notEmpty()
            .withMessage("requestToken is required")
            .bail({ level: "request" })
            .isString()
            .withMessage("requestToken must be a string"),
        body("messageData")
            .notEmpty()
            .withMessage("messageData should not be Empty")
            .bail({ level: "request" })
            .isObject()
            .withMessage("messageData should be an object"),
        body("email")
            .optional({ checkFalsy: true })
            .isString()
            .withMessage("Email must be a string"),
        body("status")
            .optional()
            .isString()
            .withMessage("Status must be a string"),
    ];
};

module.exports = { requestOtpValidation, resendOtpValidation };
