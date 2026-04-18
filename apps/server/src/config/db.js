const mongoose = require("mongoose");

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required in environment variables");
  }

  await mongoose.connect(mongoUri, {
    maxPoolSize: 20,       // max concurrent connections (Atlas free = 100 limit)
    minPoolSize: 5,        // keep 5 warm connections ready
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log("MongoDB connected (pool: 5–20)");

  // ── Background index creation — non-blocking, never stalls startup ──
  setImmediate(async () => {
    try {
      const db = mongoose.connection.db;

      await Promise.allSettled([
        // ChatSession — fast lookups when polling session status
        db.collection("chatsessions").createIndex(
          { status: 1, createdAt: -1 },
          { background: true }
        ),
        // ChatSession — find sessions by participant
        db.collection("chatsessions").createIndex(
          { participants: 1, status: 1 },
          { background: true }
        ),
        // UserLog — law enforcement IP lookups
        db.collection("userlogs").createIndex(
          { sessionUserId: 1, action: 1 },
          { background: true }
        ),
        // UserLog — report lookups by reported user
        db.collection("userlogs").createIndex(
          { reportedUserId: 1, createdAt: -1 },
          { background: true }
        ),
        // User — blocked users array lookups
        db.collection("users").createIndex(
          { blockedUsers: 1 },
          { background: true }
        ),
        // MatchRequest — expiry cleanup
        db.collection("matchrequests").createIndex(
          { expiresAt: 1 },
          { background: true, expireAfterSeconds: 0 }
        ),
      ]);

      console.log("[DB] Background indexes ensured");
    } catch (err) {
      // Never crash the server for index issues — just log
      console.warn("[DB] Index creation warning:", err.message);
    }
  });
};

module.exports = {
  connectDatabase,
};

