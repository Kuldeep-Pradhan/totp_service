const router = require("express").Router();
const { heartBeatCheck } = require("../controller/heartbeat.controller");

router.get("/", heartBeatCheck);

module.exports = router;
