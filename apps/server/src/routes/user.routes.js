const express = require("express");
const { register, login, refresh, logout, getUser, updateLocation, updateStatus, deleteUser, updateProfile, blockUser, unblockUser } = require("../controllers/user.controller");
const { getPreferences, updatePreferences } = require("../controllers/preference.controller");
const { getUserSessions } = require("../controllers/session.controller");
const { auth } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.middleware");

const router = express.Router();

// ── Public auth routes ───────────────────────────────────────────
router.post("/auth/register", authLimiter, register);
router.post("/auth/login",    authLimiter, login);
router.post("/auth/refresh",  authLimiter, refresh);
router.post("/auth/logout",   auth, logout);

// ── Protected routes ─────────────────────────────────────────────
router.get("/me",              auth, getUser);
router.patch("/me",            auth, updateProfile);
router.patch("/me/location",   auth, updateLocation);
router.patch("/me/status",     auth, updateStatus);
router.delete("/me",           auth, deleteUser);
router.get("/me/preferences",  auth, getPreferences);
router.put("/me/preferences",  auth, updatePreferences);
router.get("/me/sessions",     auth, getUserSessions);

// ── Block / unblock ──────────────────────────────────────────────
router.post("/block/:userId",   auth, blockUser);
router.delete("/block/:userId", auth, unblockUser);

// ── Public profile lookup ────────────────────────────────────────
router.get("/:userId", auth, getUser);

module.exports = router;
