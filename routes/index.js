const router = require('express').Router();

router.use('/sms', require('./sms.routes'))
router.use("/HbtChk", require("./heartbeat.routes"))

module.exports = router
