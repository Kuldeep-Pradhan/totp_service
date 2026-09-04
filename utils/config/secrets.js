const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { REDIS_SECRET_NAME } = require('./env');

const client = new SecretManagerServiceClient();

/**
 * Fetch Redis connection details from Google Cloud Secret Manager
 * @returns {Promise<Object|null>} Parsed JSON object of redis details or null on failure
 */
async function getRedisSecret() {
    if (process.env.REDIS_LOCAL === 'true') {
        console.log("[Secrets] REDIS_LOCAL=true, skipping Secret Manager and using local Redis");
        return {
            host: "127.0.0.1",
            port: 6379,
        };
    }

    if (!REDIS_SECRET_NAME) {
        console.warn("[Secrets] REDIS_SECRET_NAME is not set in environment.");
        return null;
    }

    try {
        const [version] = await client.accessSecretVersion({
            name: REDIS_SECRET_NAME,
        });

        const payload = version.payload.data.toString('utf8');
        const secretJson = JSON.parse(payload);
        console.info(`[Secrets] Redis secret fetched successfully. ${JSON.stringify(secretJson)}`);
        return secretJson;
    } catch (error) {
        console.error(`[Secrets] Failed to fetch secret ${REDIS_SECRET_NAME}:`, error.message);
        return null;
    }
}

module.exports = {
    getRedisSecret
};
