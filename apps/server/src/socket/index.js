const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const { register, unregister } = require("./registry");
const { registerSessionHandlers } = require("./handlers/session.handler");
const { registerSignalHandlers } = require("./handlers/signal.handler");

// ── ICE config — Metered TURN + Google STUN ──────────────────────
// Credentials fetched from Metered API on server side only.
// API key is NEVER sent to the client — only the resulting ice servers are.
// Cached for 12h since Metered credentials are valid for 24h.

let iceCache = { servers: null, fetchedAt: 0 };
const ICE_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const fallbackStun = () =>
  (process.env.STUN_SERVERS || "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => ({ urls: url.trim() }))
    .filter((s) => s.urls);

const getIceServers = async () => {
  const now = Date.now();

  // return cache if still fresh
  if (iceCache.servers && now - iceCache.fetchedAt < ICE_CACHE_TTL) {
    return iceCache.servers;
  }

  const appName = process.env.METERED_APP_NAME;
  const apiKey  = process.env.METERED_API_KEY;

  if (!appName || !apiKey) {
    console.warn("[ICE] METERED_APP_NAME or METERED_API_KEY not set — using STUN only");
    return fallbackStun();
  }

  try {
    const res = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { timeout: 5000 }
    );

    if (!res.ok) throw new Error(`Metered API returned ${res.status}`);

    const servers = await res.json();
    iceCache = { servers, fetchedAt: now };
    console.log(`[ICE] Fetched ${servers.length} ICE servers from Metered`);
    return servers;
  } catch (err) {
    console.error("[ICE] Failed to fetch Metered credentials:", err.message, "— falling back to STUN");
    return fallbackStun();
  }
};

// ── Connection rate limit ─────────────────────────────────────────
const connectionAttempts = new Map();

const isConnectionAllowed = (ip) => {
  const now = Date.now();
  const windowMs = Number(process.env.RATE_LIMIT_SOCKET_CONN_WINDOW_MS);
  const max      = Number(process.env.RATE_LIMIT_SOCKET_CONN_MAX);
  const entry    = connectionAttempts.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    connectionAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
};

// ── Message rate limit ────────────────────────────────────────────
const messageCounts = new Map();
// WebRTC signalling can burst quickly — don't throttle these
const signalingEvents = new Set(["offer", "answer", "ice-candidate"]);

const isMessageAllowed = (userId) => {
  const now     = Date.now();
  const windowMs = Number(process.env.RATE_LIMIT_SOCKET_MSG_WINDOW_MS);
  const max      = Number(process.env.RATE_LIMIT_SOCKET_MSG_MAX);
  const entry    = messageCounts.get(userId);

  if (!entry || now - entry.windowStart > windowMs) {
    messageCounts.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
};

// ── Init ──────────────────────────────────────────────────────────
const initSocket = (httpServer) => {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || "*").split(",").map((o) => o.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length === 1 && allowedOrigins[0] === "*"
        ? "*"
        : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // warm up ICE cache on startup so first connection is instant
  getIceServers().catch(() => {});

  // ── Connection rate limit ──────────────────────────────────────
  io.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!isConnectionAllowed(ip)) {
      return next(new Error("RATE_LIMIT: too many connection attempts, try again later"));
    }
    return next();
  });

  // ── JWT auth ───────────────────────────────────────────────────
  io.use((socket, next) => {
    const header = socket.handshake.auth?.token;
    if (!header?.startsWith("Bearer ")) {
      return next(new Error("AUTH_MISSING: Bearer token required"));
    }
    try {
      const payload = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
      socket.data.userId = payload.sub;
      return next();
    } catch {
      return next(new Error("AUTH_INVALID: invalid or expired token"));
    }
  });

  // ── Connection handler ─────────────────────────────────────────
  io.on("connection", async (socket) => {
    const { userId } = socket.data;

    register(userId, socket);

    // send ICE config — includes TURN credentials from Metered
    const iceServers = await getIceServers();
    socket.emit("ice-config", { iceServers });

    // ── Message rate limit ───────────────────────────────────────
    socket.use(([event], next) => {
      if (signalingEvents.has(event)) return next();
      if (!isMessageAllowed(userId)) {
        socket.emit("error", { message: "RATE_LIMIT: too many messages, slow down." });
        return;
      }
      return next();
    });

    registerSessionHandlers(io, socket);
    registerSignalHandlers(io, socket);

    socket.on("disconnect", () => {
      unregister(userId);
    });
  });

  return io;
};

module.exports = { initSocket };
