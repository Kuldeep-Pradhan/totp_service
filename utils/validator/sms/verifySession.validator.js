const { body } = require("express-validator")

// ─── verifySession validator ───
// Only sessionToken is required — the server verifies signature + expiry
const verifySessionValidation = () => {
    return [
        body("sessionToken")
            .notEmpty()
            .withMessage("sessionToken is required")
            .bail({ level: "request" })
            .isString()
            .withMessage("sessionToken must be a string"),
    ]
}

module.exports = { verifySessionValidation }
