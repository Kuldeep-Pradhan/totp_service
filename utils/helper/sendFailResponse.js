module.exports = (error, req, res) => {
  error.statusCode = error.statusCode || 500;
  let response = {
    success: false,
    status: error.status,
    displayMessage:
      error.displayMessage || "Sorry! we could not process your request now",
    err_type: error.name,
    message: error.message,
    description: error.description,
    errorObj: error?.errObj || {},
    errorCode: error?.errorCode
  };
  res.status(error.statusCode).send(response);
};
