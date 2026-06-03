class BaseError extends Error {
    constructor(message, errObj, name, displayMessage, statusCode, status, errorCode) {
        super(message)

        Object.setPrototypeOf(this, new.target.prototype)
        this.message = message
        this.name = name
        this.statusCode = statusCode
        this.errObj = errObj
        this.statusCode = statusCode
        this.displayMessage = displayMessage
        this.status = status
        this.errorCode = errorCode 
        Error.captureStackTrace(this)
    }
}

module.exports = BaseError
