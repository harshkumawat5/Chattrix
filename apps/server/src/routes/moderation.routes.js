const express = require("express");
const { checkFrame } = require("../controllers/moderation.controller");
const { auth } = require("../middlewares/auth.middleware");

const router = express.Router();

// Protected — only authenticated users can submit frames
router.post("/check-frame", auth, checkFrame);

module.exports = router;
