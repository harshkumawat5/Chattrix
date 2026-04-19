const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { createAdapter } = require("@socket.io/redis-adapter");
const { register, unregister } = require("./registry");
const { registerSessionHandlers } = require("./handlers/session.handler");
const { registerSignalHandlers } = require("./handlers/signal.handler");

// ── ICE config — Azure TURN + Google STUN ────────────────────────
// Azure VM Coturn TURN server + Google STUN fallbacks

const getIceServers = () => {
  const stun = (process.env.STUN_SERVERS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302")
    .split(",")
    .map((url) => ({ urls: url.trim() }))
    .filter((s) => s.urls);

  const turnUrl = process.env.TURN_SERVER_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_PASSWORD;

  if (!turnUrl || !turnUser || !turnPass) {
    console.warn("[ICE] TURN credentials not set — using STUN only");
    return stun;
  }

  const turn = [
    {
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    },
  ];

  console.log(`[ICE] Using Azure TURN + ${stun.length} STUN servers`);
  return [...turn, ...stun];
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
const initSocket = (httpServer, redisClients) => {
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

  // ── Redis adapter for horizontal scaling (multiple server instances) ──
  if (redisClients) {
    io.adapter(createAdapter(redisClients.pub, redisClients.sub));
    console.log("[Socket.IO] Redis adapter attached — horizontal scaling enabled");
  }

  // warm up ICE config on startup
  const iceServers = getIceServers();

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

    // send ICE config — includes TURN credentials from Azure VM
    const iceServers = getIceServers();
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
