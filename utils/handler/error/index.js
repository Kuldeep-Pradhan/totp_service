const BaseError = require("./baseError");

class ValidationError extends BaseError {
    constructor(
    message,
    errObj = {},
    name = "ValidationError",
    displayMessage = "Request validation failed",
    statusCode = 400,
    status = -1,
    errorCode = "VALERR0001"
  ) {
    super(message, errObj, name, displayMessage, statusCode, status, errorCode);

    if (this.message == "") {
      this.message = "Validation Failed";
    }
    this.errObj = errObj;
  }
}

class NotFoundError extends BaseError {
  constructor(
    message,
    errObj = {},
    name = "Not Found",
    displayMessage = "Data not found",
    statusCode = 404,
    status = 1,
    errorCode = "NFERR0001" 
  ) {
    super(message, errObj, name, displayMessage, statusCode, status, errorCode);
  }
}

class AxiosError extends BaseError {
  constructor(
    message,
    errObj = {},
    name = "Axios error",
    displayMessage,
    statusCode,
    errorCode = "AXERR0001" 
  ) {
    super(message, errObj, name, displayMessage, statusCode, errorCode);
  }
}

module.exports = { ValidationError, NotFoundError, AxiosError };
