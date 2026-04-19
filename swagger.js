const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OTP Service API',
      version: '2.0.0',
      description: 'Truly stateless TOTP-based OTP service — zero storage (no DB, no in-memory state). Uses HMAC-signed request tokens to carry state and session tokens as proof of validation.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
  },
  apis: ['./controller/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
