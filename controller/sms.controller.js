const BaseController = require("./BaseController");
const { requestOtpBl, resendOtpBl, validateOtpBl, verifySessionBl } = require("../services/BL/sms.bl");
const { apiCallTime } = require("../utils/helper/timestamps");

class SmsController extends BaseController {
    /**
     * @swagger
     * /NSDLMA/otp-service/request-otp:
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
     *               email:
     *                 type: string
     *                 example: "john_doe@example.com"
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
    requestOtp = async (req, res, next) => {
        let timestamp = apiCallTime();
        req.timestamp = timestamp;

        console.log(JSON.stringify(req.body), "requestOTP API request Body", timestamp);
        try {
            let result = await requestOtpBl(req, res);
            console.log("requestOTP API final response", timestamp);
            
            this.handleSuccess(res, { 
                otp: result.otp, 
                requestToken: result.requestToken 
            }, "OTP sent successfully.");
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    /**
     * @swagger
     * /NSDLMA/otp-service/resend-otp:
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
     *                 description: The token received from request-otp
     *               email:
     *                 type: string
     *                 description: Optional. Email override for notification
     *                 example: "john_doe@example.com"
     *               status:
     *                 type: string
     *                 description: Optional. Status override for notification
     *                 example: "SUCCESS"
     *               messageData:
     *                 type: object
     *                 example: { "template": "otp_sms" }
     *     responses:
     *       200:
     *         description: OTP resent successfully with new requestToken
     *       400:
     *         description: Invalid/expired token or validation error
     */
    resendOtp = async (req, res, next) => {
        let timestamp = apiCallTime();
        req.timestamp = timestamp;

        console.log(JSON.stringify({ requestToken: '***', messageData: req.body?.messageData }), "resendOTP API request Body", timestamp);

        try {
            let result = await resendOtpBl(req, res);
            console.log("resendOTP API final response", timestamp);
            
            this.handleSuccess(res, { 
                otp: result.otp, 
                requestToken: result.requestToken 
            }, "OTP resent successfully.");
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    /**
     * @swagger
     * /NSDLMA/otp-service/validate-otp:
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
     *                 description: The token received from request-otp or resend-otp
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
    validateOtp = async (req, res, next) => {
        let timestamp = apiCallTime();
        req.timestamp = timestamp;

        console.log(JSON.stringify({ requestToken: '***', otp: req.body?.otp }), "validateOTP API request Body", timestamp);

        try {
            let result = await validateOtpBl(req, res);
            console.log("validateOTP API final response", timestamp);
            
            this.handleSuccess(res, { 
                sessionToken: result.sessionToken 
            }, "OTP Validated successfully");
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    /**
     * @swagger
     * /NSDLMA/otp-service/verify-session:
     *   post:
     *     summary: Verify a Session Token
     *     description: |
     *       Verifies the sessionToken issued by validate-otp.
     *       Returns the decoded payload if valid and not expired.
     *     tags: [OTP]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [sessionToken]
     *             properties:
     *               sessionToken:
     *                 type: string
     *                 description: The HMAC-signed token received from validate-otp
     *     responses:
     *       200:
     *         description: Session token is valid
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
     *                   example: "Session verified successfully"
     *                 data:
     *                   type: object
     *                   properties:
     *                     identityKey:
     *                       type: string
     *                     mobileNumber:
     *                       type: string
     *                     email:
     *                       type: string
     *                     params:
     *                       type: string
     *                     bankCode:
     *                       type: string
     *                     timestamp:
     *                       type: integer
     *       400:
     *         description: Invalid/expired session token
     */
    verifySession = async (req, res, next) => {
        let timestamp = apiCallTime();
        req.timestamp = timestamp;

        console.log(JSON.stringify({ sessionToken: '***' }), "verifySession API request Body", timestamp);

        try {
            let result = await verifySessionBl(req, res);
            console.log("verifySession API final response", timestamp);
            
            this.handleSuccess(res, { data: result }, "Session verified successfully");
        } catch (error) {
            this.handleError(error, req, res);
        }
    }
}

module.exports = new SmsController();
