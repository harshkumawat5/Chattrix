const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: {
      moderationFrameIntervalMs: Number(process.env.MODERATION_FRAME_INTERVAL_MS) || 30000,
    },
  });
});

module.exports = router;

