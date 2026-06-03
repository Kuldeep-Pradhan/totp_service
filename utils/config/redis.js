const Redis = require('ioredis');
const { getRedisSecret } = require('./secrets');

let redisClient = null;
let isRedisConnected = false;

async function initRedis() {
    try {
        const secret = await getRedisSecret();
        if (!secret) {
            console.log("[Redis] No secret found or failed to fetch. Running without Redis (fallback mode).");
            return;
        }

        const redisOptions = {
            host: secret.ip,
            port: parseInt(secret.port) || 6379,
            password: secret.password,
            username: secret.username,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };

        // Add TLS configuration if certificates are provided in the secret
        if (secret.tls || secret.ca || secret.key) {
            redisOptions.tls = {};
            
            // Format certificates in case they contain escaped literal '\n' characters from JSON
            if (secret.ca) redisOptions.tls.ca = secret.ca.replace(/\\n/g, '\n');
            if (secret.key) redisOptions.tls.key = secret.key.replace(/\\n/g, '\n');
            if (secret.tls) redisOptions.tls.cert = secret.tls.replace(/\\n/g, '\n');
            
            // For self-signed certificates or specific environments
            redisOptions.tls.rejectUnauthorized = false;
        }

        redisClient = new Redis(redisOptions);

        redisClient.on('connect', () => {
            console.log(`[Redis] Connected to Redis at ${redisOptions.host}:${redisOptions.port}`);
            isRedisConnected = true;
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
            isRedisConnected = false;
        });

        redisClient.on('close', () => {
            console.log('[Redis] Connection closed.');
            isRedisConnected = false;
        });

        redisClient.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
            isRedisConnected = false;
        });

    } catch (error) {
        console.error('[Redis] Initialization failed:', error.message);
    }
}

function getRedisClient() {
    return redisClient;
}

function getIsRedisConnected() {
    return isRedisConnected;
}

module.exports = {
    initRedis,
    getRedisClient,
    getIsRedisConnected
};
