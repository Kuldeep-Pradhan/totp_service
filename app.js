const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const path = require("path");
const app = express();

const activeEnv = (process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';
require('dotenv').config({ path: `./environment/.env.${activeEnv}` });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1); // Trust first proxy for rate limiting (X-Forwarded-For)
app.use(helmet({
    contentSecurityPolicy: false
}));

// Serve static documentation portal
app.use("/docs", express.static(path.join(__dirname, "totp-api-docs")));

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
const otpRoutes = require("./routes");
app.use("/api/v1/otp", otpRoutes);     // Modern standardized prefix

app.use((req, res, next) => {
    res.status(400).send("Invalid API request");
});

const { initRedis } = require('./utils/config/redis');

const SERVER = process.env.SERVER || "http://localhost"
const PORT = process.env.PORT || 8080;

(async () => {
    // Initialize Redis connection before accepting requests
    await initRedis();

    app.listen(PORT, () => {
        console.log(`Application is running at ${SERVER}:${PORT}`);
        console.log(`Swagger UI → ${SERVER}:${PORT}/api-docs`);
        console.log(`API Documentation Portal → ${SERVER}:${PORT}/docs`);
    });
})();
module.exports = app;
