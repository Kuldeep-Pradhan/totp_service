const { validationResult } = require("express-validator");
const { ValidationError } = require("../../utils/handler/error");
const sendFailResponse = require("../helper/sendFailResponse");

module.exports = async (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const mappedErrors = result.array();
    let errorArr = [];
    let errObj = {}
    for (const element of mappedErrors) {
      let newErrObj = {
        param: element?.path,
        msg: element?.msg,
      };
      errorArr.push(newErrObj);
      errObj[`${element?.path}`] = element?.msg
    }
    let errorMsg = errorArr.reduce(
      (acc, cur) => `${acc}${acc ? ", " : ""}${cur.msg}`,
      ""
    );
    const error = new ValidationError(
      errorMsg,
      errObj,
      "ValidationError",
      errorMsg
    );
    console.log(JSON.stringify(error), "Validator error");
    await sendFailResponse(error, req, res);
  } else {
    next();
  }
};
