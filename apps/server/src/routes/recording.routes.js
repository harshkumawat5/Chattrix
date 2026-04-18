const express = require("express");
const {
  createRecordingPresign,
  finalizeRecording,
  createRecording,
  getRecordingById,
  listRecordingsByUser,
  listRecordingsBySession,
  deleteRecording,
} = require("../controllers/recording.controller");
const { auth } = require("../middlewares/auth.middleware");

const router = express.Router();

// ── Recording feature toggle — disable entirely from .env ────────
const recordingGate = (req, res, next) => {
  const enabled = process.env.RECORDING_ENABLED !== "false";
  if (!enabled) {
    return res.status(503).json({ message: "Recording is disabled" });
  }
  return next();
};

router.use(recordingGate);

router.post("/presign",                auth, createRecordingPresign);
router.post("/finalize",               auth, finalizeRecording);
router.post("/",                       auth, createRecording);
router.get("/user/:userId",            auth, listRecordingsByUser);
router.get("/session/:chatSessionId",  auth, listRecordingsBySession);
router.get("/:id",                     auth, getRecordingById);
router.delete("/:id",                  auth, deleteRecording);

module.exports = router;
