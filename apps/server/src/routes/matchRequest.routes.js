const express = require("express");
const { createMatchRequest, getMatchRequest, cancelMatchRequest } = require("../controllers/matchRequest.controller");
const { auth } = require("../middlewares/auth.middleware");
const { matchLimiter, matchCooldownGuard } = require("../middlewares/rateLimiter.middleware");

const router = express.Router();

router.post("/",      auth, matchLimiter, matchCooldownGuard, createMatchRequest);
router.get("/:id",    auth, getMatchRequest);
router.delete("/:id", auth, cancelMatchRequest);

module.exports = router;
