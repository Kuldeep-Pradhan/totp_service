const { body } = require("express-validator");

// ─── requestOTP validator ───
// Full body: mobileNumber, params, user_name, feature, operationPerformed, messageData, bankCode (optional)
const requestOtpValidation = () => {
    return [
        body("user_name")
            .notEmpty()
            .withMessage("user_name is required")
            .bail({ level: "request" })
            .not()
            .custom((value) => {
                return value.toLowerCase() === "null";
            })
            .withMessage("Please enter a valid user name"),
        body("feature")
            .notEmpty()
            .withMessage("Feature name should not be Empty")
            .bail({ level: "request" })
            .not()
            .custom((value) => {
                return value.toLowerCase() === "null";
            })
            .withMessage("Please enter a valid feature name"),
        body("operationPerformed")
            .notEmpty()
            .withMessage("Operation Performed should not be Empty")
            .bail({ level: "request" })
            .not()
            .custom((value) => {
                return value.toLowerCase() === "null";
            })
            .withMessage("Please enter a valid operation performed"),
        body().custom((value, { req }) => {
            const hasMobile = req.body.mobileNumber && req.body.mobileNumber.trim() !== '';
            const hasEmail = req.body.email && req.body.email.trim() !== '';
            if (!hasMobile && !hasEmail) {
                throw new Error("Either mobileNumber or email is required");
            }
            return true;
        }),
        body("mobileNumber")
            .optional({ checkFalsy: true })
            .matches(/^[6-9]\d{9}$/)
            .withMessage("Please provide a valid mobile number"),
        body("bankCode")
            .optional()
            .exists()
            .withMessage("bankCode is required")
            .bail({ level: "request" })
            .notEmpty()
            .withMessage("bank code should not be Empty")
            .bail({ level: "request" })
            .not()
            .custom((value) => {
                return value.toLowerCase() === "null";
            })
            .withMessage("Please enter a valid bankCode"),
        body("params")
            .notEmpty()
            .withMessage("Params should not be Empty")
            .bail({ level: "request" })
            .not()
            .custom((value) => {
                return value.toLowerCase() === "null";
            })
            .withMessage("Please enter a valid params")
            .bail({ level: "request" })
            .matches(/^[a-zA-Z0-9]+$/)
            .withMessage("Params should only contain alphanumeric characters")
            .bail({ level: "request" })
            .trim()
            .isLength({ min: 10, max: 150 })
            .withMessage("Prams length must be min 10 and max 150 char long "),
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

// ─── resendOTP validator ───
// Optimized: only requestToken + messageData needed (everything else is in the token)
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
