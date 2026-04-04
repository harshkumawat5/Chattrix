const express = require("express");
const {
  createRecording,
  getRecordingById,
  listRecordingsByUser,
  listRecordingsBySession,
  deleteRecording,
} = require("../controllers/recording.controller");
const { auth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/",                       auth, createRecording);
router.get("/user/:userId",            auth, listRecordingsByUser);
router.get("/session/:chatSessionId",  auth, listRecordingsBySession);
router.get("/:id",                     auth, getRecordingById);
router.delete("/:id",                  auth, deleteRecording);

module.exports = router;
