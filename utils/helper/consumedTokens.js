const NodeCache = require('node-cache');

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

function isConsumed(tokenSignature) {
    return consumedTokens.has(tokenSignature);
}

function markAsConsumed(tokenSignature, ttlSeconds) {
    consumedTokens.set(tokenSignature, true, ttlSeconds);
}

function getTokenSignature(token) {
    if (!token || typeof token !== 'string') return null;
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;
    return token.substring(dotIndex + 1);
}

// ─── Issued Requests (duplicate request prevention) ───

function isRequestIssued(mobileNumber, params) {
    return issuedRequests.has(`${mobileNumber}:${params}`);
}

function markRequestIssued(mobileNumber, params, ttlSeconds) {
    issuedRequests.set(`${mobileNumber}:${params}`, true, ttlSeconds);
}

function clearIssuedRequest(mobileNumber, params) {
    issuedRequests.del(`${mobileNumber}:${params}`);
}

module.exports = {
    isConsumed, markAsConsumed, getTokenSignature,
    isRequestIssued, markRequestIssued, clearIssuedRequest,
};
