const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { register, unregister } = require("./registry");
const { registerSessionHandlers } = require("./handlers/session.handler");
const { registerSignalHandlers } = require("./handlers/signal.handler");

// Parsed from comma-separated STUN/TURN env vars.
// TURN is required for many NAT combinations where STUN-only fails.
const buildIceServers = () => {
  const stunServers = (process.env.STUN_SERVERS || "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));

  const turnUrls = (process.env.TURN_SERVERS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!turnUrls.length) return stunServers;

  const username = process.env.TURN_USERNAME || "";
  const credential = process.env.TURN_CREDENTIAL || "";

  if (!username || !credential) return stunServers;

  return [
    ...stunServers,
    {
      urls: turnUrls,
      username,
      credential,
    },
  ];
};

// Connection attempts per IP
const connectionAttempts = new Map();

const isConnectionAllowed = (ip) => {
  const now = Date.now();
  const windowMs = Number(process.env.RATE_LIMIT_SOCKET_CONN_WINDOW_MS);
  const max = Number(process.env.RATE_LIMIT_SOCKET_CONN_MAX);
  const entry = connectionAttempts.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    connectionAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count += 1;
  return true;
};

// Message rate per user
const messageCounts = new Map();
const signalingEvents = new Set(["offer", "answer", "ice-candidate"]);

const isMessageAllowed = (userId) => {
  const now = Date.now();
  const windowMs = Number(process.env.RATE_LIMIT_SOCKET_MSG_WINDOW_MS);
  const max = Number(process.env.RATE_LIMIT_SOCKET_MSG_MAX);
  const entry = messageCounts.get(userId);

  if (!entry || now - entry.windowStart > windowMs) {
    messageCounts.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count += 1;
  return true;
};

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

  // ── Connection rate limit ────────────────────────────────────
  io.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!isConnectionAllowed(ip)) {
      return next(new Error("RATE_LIMIT: too many connection attempts, try again later"));
    }
    return next();
  });

  // ── Auth middleware ──────────────────────────────────────────
  // Client must pass JWT: io({ auth: { token: "Bearer <accessToken>" } })
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

  io.on("connection", (socket) => {
    const { userId } = socket.data;

    register(userId, socket);

    socket.emit("ice-config", { iceServers: buildIceServers() });

    // ── Message rate limit ───────────────────────────────────
    socket.use(([event], next) => {
      // WebRTC signaling can burst quickly (especially ICE); do not throttle these.
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
