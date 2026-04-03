require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const { connectDatabase } = require("./config/db");

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Closing MongoDB connection...`);
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();

