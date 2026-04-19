const { default: axios } = require("axios");
let http = require("http");
const { Send_Notification_URL } = require("../config/env");
const { AxiosError } = require("../handler/error");
const { default: axiosRetry } = require("axios-retry");
let httpAgent = new http.Agent({ keepAlive: true });

axiosRetry(axios, {
  retries: 3,
  shouldResetTimeout: true,
  retryCondition: (error) => {
    switch (error.code) {
      case "ECONNREFUSED":
      case "ECONNABORTED":
      case "ECONNRESET":
      case "ETIMEDOUT": {
        return true;
      }
      default: {
        return false;
      }
    }
  },
  onRetry: (retryCount) => {
    console.log("retry count: ", retryCount);
  },
});

const notificationDashboardAxiosCall = async (axiosRequestBody, timestamp) => {
  let otpSentResp;
  try {
    await axios(Send_Notification_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: axiosRequestBody,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      httpAgent: httpAgent,
    })
      .then((response) => {
        console.log(
          `${JSON.stringify(response?.data)} SMS sent successful response`,
          timestamp
        );
        otpSentResp = response?.data.sendArray;
      })
      .catch((error) => {
        if (error.response) {
          console.log(
            JSON.stringify(error.response.data),
            `Notification Dashboard api error in axios response`,
            timestamp
          );
        } else if (error.request) {
          console.log(
            error.request,
            `Notification Dashboard api error in axios request`,
            timestamp
          );
        } else {
          console.log(
            JSON.stringify(error?.message),
            `Notification Dashboard api error in axios`,
            timestamp
          );
        }

        console.log(JSON.stringify(error), "Axios Error", timestamp);
        let axiosErrorObj = Object.assign(
          {},
          error?.config,
          error?.response,
          error?.request
        );

        let errorObject = {
          errorCode: error.code,
          url: axiosErrorObj.url,
          method: axiosErrorObj.method,
          data: axiosErrorObj?.config?.data,
          message: error?.stack,
        };
        throw new AxiosError(
          axiosErrorObj?.data?.message,
          errorObject,
          error.name,
          error.message,
          error?.response?.status
        );
      });
    return otpSentResp;
  } catch (error) {
    console.log(
      JSON.stringify(error),
      "notificationDashboardAxiosCall Error",
      timestamp
    );
    throw error;
  }
};

module.exports = { notificationDashboardAxiosCall };
