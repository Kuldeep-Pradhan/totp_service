const { getRedisClient, getIsRedisConnected } = require('../config/redis');

function ensureRedis() {
    if (!getIsRedisConnected()) {
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

// ─── Consumed Tokens (replay prevention) ───

async function isConsumed(tokenSignature) {
    ensureRedis();
    try {
        const result = await getRedisClient().get(`consumed:${tokenSignature}`);
        return result !== null;
    } catch (error) {
        console.error(`[Redis] Error getting consumed token: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

async function markAsConsumed(tokenSignature, ttlSeconds) {
    ensureRedis();
    try {
        await getRedisClient().set(`consumed:${tokenSignature}`, 'true', 'EX', ttlSeconds);
    } catch (error) {
        console.error(`[Redis] Error setting consumed token: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

function getTokenSignature(token) {
    if (!token || typeof token !== 'string') return null;
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;
    return token.substring(dotIndex + 1);
}

// ─── Issued Requests (duplicate request prevention) ───

async function acquireRequestLock(mobileNumber, params, ttlSeconds) {
    ensureRedis();
    const redisKey = `issued:${mobileNumber}:${params}`;
    try {
        const result = await getRedisClient().set(redisKey, 'true', 'EX', ttlSeconds, 'NX');
        return result === 'OK'; 
    } catch (error) {
        console.error(`[Redis] Error acquiring lock: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

async function clearIssuedRequest(mobileNumber, params) {
    ensureRedis();
    const key = `issued:${mobileNumber}:${params}`;
    try {
        await getRedisClient().del(key);
    } catch (error) {
        console.error(`[Redis] Error deleting issued request: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

// ─── Failed Attempts (rate limiting per token) ───

async function incrementFailedAttempts(nonce, ttlSeconds) {
    ensureRedis();
    const key = `attempts:${nonce}`;
    try {
        const current = await getRedisClient().incr(key);
        if (current === 1) {
            await getRedisClient().expire(key, ttlSeconds);
        }
        return current;
    } catch (error) {
        console.error(`[Redis] Error incrementing attempts: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

async function getFailedAttempts(nonce) {
    ensureRedis();
    const key = `attempts:${nonce}`;
    try {
        const current = await getRedisClient().get(key);
        return current ? parseInt(current, 10) : 0;
    } catch (error) {
        console.error(`[Redis] Error getting attempts: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

// ─── Identity Rate Limiting (Prevent SMS Bombing) ───

async function checkIdentityRateLimit(identifier, maxRequests = 3, windowSeconds = 300) {
    ensureRedis();
    const key = `ratelimit:${identifier}`;
    try {
        const current = await getRedisClient().incr(key);
        if (current === 1) {
            await getRedisClient().expire(key, windowSeconds);
        }
        return current <= maxRequests;
    } catch (error) {
        console.error(`[Redis] Error checking rate limit: ${error.message}`);
        throw new Error("Redis is unavailable. Security mechanisms cannot operate securely.");
    }
}

module.exports = {
    isConsumed, markAsConsumed, getTokenSignature,
    acquireRequestLock, clearIssuedRequest,
    incrementFailedAttempts, getFailedAttempts,
    checkIdentityRateLimit
};
