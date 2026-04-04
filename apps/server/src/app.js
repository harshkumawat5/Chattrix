const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");
const userRoutes = require("./routes/user.routes");
const matchRequestRoutes = require("./routes/matchRequest.routes");
const sessionRoutes = require("./routes/session.routes");
const recordingRoutes = require("./routes/recording.routes");

const { apiLimiter } = require("./middlewares/rateLimiter.middleware");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(apiLimiter);

app.use("/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/match-requests", matchRequestRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/recordings", recordingRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    message,
  });
});

module.exports = app;

