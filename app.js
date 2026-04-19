const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const app = express();

const activeEnv = (process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';
require('dotenv').config({ path: `./environment/.env.${activeEnv}` });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/", require("./routes"));

app.use((req, res, next) => {
    res.status(400).send("Invalid API request");
});

const SERVER = process.env.SERVER || "http://localhost"
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Application is running at ${SERVER}:${PORT}`);
    console.log(`Swagger UI → ${SERVER}:${PORT}/api-docs`);
});

module.exports = app;
