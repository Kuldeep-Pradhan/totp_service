const NodeCache = require('node-cache');
const { getRedisClient, getIsRedisConnected } = require('../config/redis');

// ─── node-cache with auto-delete on expiry ───
// deleteOnExpire: true  → keys are removed the moment their TTL expires
// checkperiod: 30       → expired-key sweep runs every 30 seconds
const consumedTokens = new NodeCache({ stdTTL: 0, checkperiod: 30, deleteOnExpire: true });
const issuedRequests = new NodeCache({ stdTTL: 0, checkperiod: 30, deleteOnExpire: true });

// ─── Log when keys expire and get cleaned ───
consumedTokens.on('expired', (key, value) => {
    console.log(`[ConsumedTokens] Expired & cleared: ${key.substring(0, 16)}...`);
});

issuedRequests.on('expired', (key, value) => {
    console.log(`[IssuedRequests] Expired & cleared: ${key}`);
});

// ─── Consumed Tokens (replay prevention) ───

async function isConsumed(tokenSignature) {
    // 1. Check local fallback cache first (handles the split-brain edge case locally)
    if (consumedTokens.has(tokenSignature)) {
        // Opportunistic Sync: If Redis reconnected, push state to Redis and clear local
        if (getIsRedisConnected()) {
            const ttlMs = consumedTokens.getTtl(tokenSignature);
            if (ttlMs) {
                const ttlSeconds = Math.max(1, Math.floor((ttlMs - Date.now()) / 1000));
                await getRedisClient().set(`consumed:${tokenSignature}`, 'true', 'EX', ttlSeconds).catch(() => {});
            }
            consumedTokens.del(tokenSignature);
        }
        return true;
    }

    // 2. Then check Redis
    if (getIsRedisConnected()) {
        try {
            const result = await getRedisClient().get(`consumed:${tokenSignature}`);
            return result !== null;
        } catch (error) {
            console.error(`[Redis] Error getting consumed token: ${error.message}`);
        }
    }
    return false;
}

async function markAsConsumed(tokenSignature, ttlSeconds) {
    if (getIsRedisConnected()) {
        try {
            await getRedisClient().set(`consumed:${tokenSignature}`, 'true', 'EX', ttlSeconds);
            return;
        } catch (error) {
            console.error(`[Redis] Error setting consumed token: ${error.message}`);
        }
    }
    // Fallback to node-cache
    consumedTokens.set(tokenSignature, true, ttlSeconds);
}

function getTokenSignature(token) {
    if (!token || typeof token !== 'string') return null;
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;
    return token.substring(dotIndex + 1);
}

// ─── Issued Requests (duplicate request prevention) ───

async function isRequestIssued(mobileNumber, params) {
    const localKey = `${mobileNumber}:${params}`;
    const redisKey = `issued:${localKey}`;

    // 1. Check local fallback cache first (handles the split-brain edge case locally)
    if (issuedRequests.has(localKey)) {
        // Opportunistic Sync: If Redis reconnected, push state to Redis and clear local
        if (getIsRedisConnected()) {
            const ttlMs = issuedRequests.getTtl(localKey);
            if (ttlMs) {
                const ttlSeconds = Math.max(1, Math.floor((ttlMs - Date.now()) / 1000));
                await getRedisClient().set(redisKey, 'true', 'EX', ttlSeconds).catch(() => {});
            }
            issuedRequests.del(localKey);
        }
        return true;
    }

    // 2. Then check Redis
    if (getIsRedisConnected()) {
        try {
            const result = await getRedisClient().get(redisKey);
            return result !== null;
        } catch (error) {
            console.error(`[Redis] Error getting issued request: ${error.message}`);
        }
    }
    return false;
}

async function markRequestIssued(mobileNumber, params, ttlSeconds) {
    const key = `issued:${mobileNumber}:${params}`;
    if (getIsRedisConnected()) {
        try {
            await getRedisClient().set(key, 'true', 'EX', ttlSeconds);
            return;
        } catch (error) {
            console.error(`[Redis] Error setting issued request: ${error.message}`);
        }
    }
    // Fallback to node-cache
    issuedRequests.set(`${mobileNumber}:${params}`, true, ttlSeconds);
}

async function clearIssuedRequest(mobileNumber, params) {
    const key = `issued:${mobileNumber}:${params}`;
    if (getIsRedisConnected()) {
        try {
            await getRedisClient().del(key);
            return;
        } catch (error) {
            console.error(`[Redis] Error deleting issued request: ${error.message}`);
        }
    }
    // Fallback to node-cache
    issuedRequests.del(`${mobileNumber}:${params}`);
}

module.exports = {
    isConsumed, markAsConsumed, getTokenSignature,
    isRequestIssued, markRequestIssued, clearIssuedRequest,
};
