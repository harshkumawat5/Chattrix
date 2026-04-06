require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const { connectDatabase } = require("./config/db");
const { initSocket } = require("./socket");
const { startExpiryJob, stopExpiryJob } = require("./jobs/matchExpiry.job");

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    await connectDatabase();
    const httpServer = http.createServer(app);
    initSocket(httpServer);
    startExpiryJob();
    httpServer.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Closing MongoDB connection...`);
  stopExpiryJob();
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();

