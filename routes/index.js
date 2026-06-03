const router = require('express').Router();

router.use('/otp-service/sms', require('./sms.routes'))
router.use("/otp-service/HbtChk", require("./heartbeat.routes"))

module.exports = router
