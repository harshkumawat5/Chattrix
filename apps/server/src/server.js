require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const { connectDatabase } = require("./config/db");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { initReportQueue, closeReportQueue } = require("./config/queue");
const { initSocket } = require("./socket");
const { startExpiryJob, stopExpiryJob } = require("./jobs/matchExpiry.job");

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    // 1. Connect MongoDB (with connection pooling)
    await connectDatabase();

    // 2. Connect Redis (Upstash free tier — optional, graceful fallback)
    const redisClients = await connectRedis();

    // 3. Init BullMQ report queue (uses same Upstash Redis — optional)
    initReportQueue(async (jobName, data) => {
      // Worker callback — process report jobs off the main event loop
      console.log(`[Queue] Processing ${jobName}:`, data.reason || data.type);
      // The actual report logic is in the controller — this just logs for now.
      // Extend here for auto-ban threshold checks, CSAM flagging, etc.
    });

    // 4. Create HTTP server + Socket.IO (pass Redis clients for adapter)
    const httpServer = http.createServer(app);
    initSocket(httpServer, redisClients);

    // 5. Start background jobs
    startExpiryJob();

    httpServer.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`Redis: ${redisClients ? "✅ Upstash connected" : "⚠️  single-instance mode"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  stopExpiryJob();
  await closeReportQueue();
  await disconnectRedis();
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();

