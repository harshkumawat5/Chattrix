const { createClient } = require("redis");

let pubClient = null;
let subClient = null;
let isConnected = false;

/**
 * Connect to Upstash Redis (or any Redis).
 * Returns { pub, sub } clients for Socket.IO adapter.
 * If UPSTASH_REDIS_URL is not set, returns null (graceful fallback — single-instance mode).
 */
const connectRedis = async () => {
  const url = process.env.UPSTASH_REDIS_URL;

  if (!url) {
    console.warn("[Redis] UPSTASH_REDIS_URL not set — running single-instance mode (no horizontal scaling)");
    return null;
  }

  try {
    pubClient = createClient({ url });
    subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("[Redis pub] Error:", err.message));
    subClient.on("error", (err) => console.error("[Redis sub] Error:", err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    isConnected = true;
    console.log("[Redis] Connected to Upstash Redis");

    return { pub: pubClient, sub: subClient };
  } catch (err) {
    console.error("[Redis] Failed to connect:", err.message, "— falling back to single-instance mode");
    return null;
  }
};

const getRedisClient = () => pubClient;
const isRedisConnected = () => isConnected;

const disconnectRedis = async () => {
  try {
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
  } catch { /* silent */ }
  pubClient = null;
  subClient = null;
  isConnected = false;
};

module.exports = { connectRedis, getRedisClient, isRedisConnected, disconnectRedis };

