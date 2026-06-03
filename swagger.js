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
        url: '{serverUrl}',
        description: 'Dynamic Server Environment',
        variables: {
          serverUrl: {
            default: 'http://localhost:8080',
            description: 'Enter the base URL for the API (Local, Staging, UAT, Prod)'
          }
        }
      },
      {
        url: 'http://localhost:8080',
        description: 'Local development server',
      },
      {
        url: 'https://staging-api.example.com',
        description: 'Staging server (Placeholder)',
      },
      {
        url: 'https://uat-api.example.com',
        description: 'UAT server (Placeholder)',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server (Placeholder)',
      }
    ],
  },
  apis: ['./controller/*.js', './routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

