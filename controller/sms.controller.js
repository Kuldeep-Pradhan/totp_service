const { requestOtpBl, resendOtpBl, validateOtpBl } = require("../services/BL/sms.bl");
const sendFailResponse = require("../utils/helper/sendFailResponse");
const { apiCallTime } = require("../utils/helper/timestamps");
const { env } = require('../utils/config/env');

/**
 * @swagger
 * /sms/requestOTP:
 *   post:
 *     summary: Request a new OTP
 *     description: |
 *       Generates a TOTP-based OTP for the given mobileNumber + params combination.
 *       Returns a signed `requestToken` that the client must present for resend/validate.
 *       **No server-side storage** — all state is in the token.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_name, mobileNumber, params, feature, operationPerformed, messageData]
 *             properties:
 *               user_name:
 *                 type: string
 *                 example: "john_doe"
 *               mobileNumber:
 *                 type: string
 *                 example: "9876543210"
 *               params:
 *                 type: string
 *                 example: "txn123456abcd"
 *                 description: Unique identifier per OTP request for the same mobile number (10-150 alphanumeric chars)
 *               bankCode:
 *                 type: string
 *                 example: "IDBI"
 *                 description: Optional. Controls OTP validity duration (default 2 min)
 *               feature:
 *                 type: string
 *                 example: "LOGIN"
 *               operationPerformed:
 *                 type: string
 *                 example: "OTP_VERIFICATION"
 *               messageData:
 *                 type: object
 *                 example: { "template": "otp_sms" }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 displayMessage:
 *                   type: string
 *                 requestToken:
 *                   type: string
 *                   description: HMAC-signed token — pass this to resend/validate
 *       400:
 *         description: Validation error
 */
const requestOtp = async (req, res, next) => {
    let timestamp = apiCallTime();
    req.timestamp = timestamp;

    console.log(JSON.stringify(req.body), "requestOTP API request Body", timestamp);
    try {
        let result = await requestOtpBl(req, res);
        const response = (env === 'development') ? {
            status: 0,
            success: true,
            displayMessage: `OTP sent successfully. ${result.otp} is your OTP`,
            err_type: "",
            message: `OTP sent successfully. ${result.otp} is your OTP`,
            requestToken: result.requestToken,
            errorObj: {},
            errorCode: ""
        } : {
            status: 0,
            success: true,
            displayMessage: `OTP sent successfully.`,
            err_type: "",
            message: `OTP sent successfully.`,
            requestToken: result.requestToken,
            errorObj: {},
            errorCode: ""
        };
        console.log("requestOTP API final response", timestamp);
        res.status(200).send(response);
    } catch (error) {
        sendFailResponse(error, req, res);
    }
}

/**
 * @swagger
 * /sms/resendOTP:
 *   post:
 *     summary: Resend OTP
 *     description: |
 *       Resends OTP using the `requestToken` from the original request.
 *       Extracts mobileNumber, params, bankCode from the token — no need to resend them.
 *       Returns a **new** `requestToken` with a reset validity timer.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestToken, messageData]
 *             properties:
 *               requestToken:
 *                 type: string
 *                 description: The token received from requestOTP
 *               messageData:
 *                 type: object
 *                 example: { "template": "otp_sms" }
 *     responses:
 *       200:
 *         description: OTP resent successfully with new requestToken
 *       400:
 *         description: Invalid/expired token or validation error
 */
const resendOtp = async (req, res, next) => {
    let timestamp = apiCallTime();
    req.timestamp = timestamp;

    console.log(JSON.stringify({ requestToken: '***', messageData: req.body?.messageData }), "resendOTP API request Body", timestamp);

    try {
        let result = await resendOtpBl(req, res);
        const response = (env === 'development') ? {
            status: 0,
            success: true,
            displayMessage: `OTP resent successfully. ${result.otp} is your OTP`,
            err_type: "",
            message: `OTP resent successfully. ${result.otp} is your OTP`,
            requestToken: result.requestToken,
            errorObj: {},
            errorCode: ""
        } : {
            status: 0,
            success: true,
            displayMessage: `OTP resent successfully.`,
            err_type: "",
            message: `OTP resent successfully.`,
            requestToken: result.requestToken,
            errorObj: {},
            errorCode: ""
        }
        console.log("resendOTP API final response", timestamp);
        res.status(200).send(response);
    } catch (error) {
        sendFailResponse(error, req, res);
    }
}

/**
 * @swagger
 * /sms/validateOTP:
 *   post:
 *     summary: Validate an OTP
 *     description: |
 *       Validates the OTP against the TOTP secret derived from the `requestToken`.
 *       On success, returns a `sessionToken` — HMAC-signed proof of validation.
 *       **No server state is checked or stored.**
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestToken, otp]
 *             properties:
 *               requestToken:
 *                 type: string
 *                 description: The token received from requestOTP or resendOTP
 *               otp:
 *                 type: string
 *                 example: "482910"
 *     responses:
 *       200:
 *         description: OTP validated — sessionToken issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 displayMessage:
 *                   type: string
 *                   example: "OTP Validated successfully"
 *                 sessionToken:
 *                   type: string
 *                   description: HMAC-signed proof of successful validation
 *       400:
 *         description: Invalid/expired OTP or token
 */
const validateOtp = async (req, res, next) => {
    let timestamp = apiCallTime();
    req.timestamp = timestamp;

    console.log(JSON.stringify({ requestToken: '***', otp: req.body?.otp }), "validateOTP API request Body", timestamp);

    try {
        let result = await validateOtpBl(req, res);
        const response = {
            status: 0,
            success: true,
            displayMessage: "OTP Validated successfully",
            err_type: "",
            message: "OTP Validated successfully",
            sessionToken: result.sessionToken,
            errorObj: {},
            errorCode: ""
        }
        console.log("validateOTP API final response", timestamp);
        res.status(200).send(response);
    } catch (error) {
        sendFailResponse(error, req, res);
    }
}

module.exports = { requestOtp, resendOtp, validateOtp }
