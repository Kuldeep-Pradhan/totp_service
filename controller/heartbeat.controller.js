const moment = require('moment-timezone')
const packageServiceData = require('../package.json')

/**
 * @swagger
 * /HbtChk:
 *   get:
 *     summary: Heartbeat check
 *     description: Returns the current timestamp, service name, and version to confirm the service is running.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is up
 */
const heartBeatCheck = (req, res) => {
    console.log(`incomingReqFromCheckhearbeat==> ${req.headers['user-agent']} has access root url`);
    const CT = moment().tz("Asia/Kolkata").format();

    let heartBeatObj = {
        "CurrentTimeStamp": CT,
        "ServiceName": (packageServiceData.name) ? packageServiceData.name : "N/A",
        "ServiceVersion": (packageServiceData.version) ? packageServiceData.version : "N/A",
    }

    console.log("checkHeartBeatResp==>", JSON.stringify(heartBeatObj));
    return res.status(200).json({ status: 0, message: "Service is Up!", data: heartBeatObj })
}

module.exports = { heartBeatCheck }
