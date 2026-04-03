const express = require("express");
const {
  createRecording,
  listRecordingsByUser,
  listRecordingsBySession,
} = require("../controllers/recording.controller");

const router = express.Router();

router.post("/", createRecording);
router.get("/user/:userId", listRecordingsByUser);
router.get("/session/:chatSessionId", listRecordingsBySession);

module.exports = router;

