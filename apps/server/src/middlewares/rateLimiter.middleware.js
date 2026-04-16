const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS),
  max: Number(process.env.RATE_LIMIT_API_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS),
  max: Number(process.env.RATE_LIMIT_AUTH_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts, please try again later." },
});

// Username availability check — generous limit since it fires on every keystroke
const checkUsernameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CHECK_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many checks, please slow down." },
});

const matchCooldowns = new Map();

const matchLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_MATCH_WINDOW_MS),
  max: Number(process.env.RATE_LIMIT_MATCH_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  message: { message: "Too many match requests, please slow down." },
});

const matchCooldownGuard = (req, res, next) => {
  const userId = req.user?._id?.toString();
  if (!userId) return next();

  const cooldownMs = Number(process.env.RATE_LIMIT_MATCH_COOLDOWN_MS);
  const last = matchCooldowns.get(userId);
  const now = Date.now();

  if (last && now - last < cooldownMs) {
    return res.status(429).json({
      message: `Please wait ${cooldownMs / 1000} seconds before requesting another match.`,
    });
  }

  matchCooldowns.set(userId, now);
  return next();
};

// clear cooldown when user cancels — so skip → autostart doesn't hit 429
const clearMatchCooldown = (userId) => {
  if (userId) matchCooldowns.delete(userId.toString());
};

module.exports = { apiLimiter, authLimiter, checkUsernameLimiter, matchLimiter, matchCooldownGuard, clearMatchCooldown };
