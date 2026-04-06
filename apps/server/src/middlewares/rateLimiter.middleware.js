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

module.exports = { apiLimiter, authLimiter, matchLimiter, matchCooldownGuard };
