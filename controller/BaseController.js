const { env } = require('../utils/config/env');
const sendFailResponse = require('../utils/helper/sendFailResponse');

class BaseController {
    /**
     * Send a successful response
     * @param {Object} res - Express response object
     * @param {Object} data - Data to include in the response
     * @param {string} displayMessage - Message for the client
     * @param {number} statusCode - HTTP status code
     */
    handleSuccess(res, data = {}, displayMessage = 'Success', statusCode = 200) {
        const response = {
            status: 0,
            success: true,
            displayMessage,
            err_type: "",
            message: displayMessage,
            ...data,
            errorObj: {},
            errorCode: ""
        };

        if (env === 'development' && data.otp) {
            response.displayMessage = `${displayMessage} ${data.otp} is your OTP`;
            response.message = response.displayMessage;
        }

        res.status(statusCode).send(response);
    }

    /**
     * Handle errors and send failure response
     * @param {Error} error - The error object
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    handleError(error, req, res) {
        sendFailResponse(error, req, res);
    }
}

module.exports = BaseController;
