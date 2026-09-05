const BaseError = require('../handler/error/baseError');

module.exports = (error, req, res) => {
  if (error instanceof BaseError) {
    return res.status(error.statusCode || 400).send({
      success: false,
      status: error.status,
      displayMessage: error.displayMessage || "Sorry! we could not process your request now",
      err_type: error.name,
      message: error.message,
      description: error.description,
      errorObj: error.errObj || {},
      errorCode: error.errorCode
    });
  }

  // Handle unexpected system errors safely (Prevent information disclosure)
  console.error("[CRITICAL SYSTEM ERROR]", error);
  
  return res.status(500).send({
    success: false,
    status: -1,
    displayMessage: "An unexpected internal server error occurred",
    err_type: "InternalServerError",
    message: "Internal Server Error",
    errorObj: {},
    errorCode: "SYS0001"
  });
};
