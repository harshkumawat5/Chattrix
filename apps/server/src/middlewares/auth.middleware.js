const jwt = require("jsonwebtoken");
const { User } = require("../models");

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: payload.sub, username: payload.username, displayName: payload.displayName };

    // keep-alive: extend expiresAt on every authenticated request
    const ttl = Number(process.env.SESSION_TTL_MS) || 900000;
    User.findByIdAndUpdate(payload.sub, { expiresAt: new Date(Date.now() + ttl) }).catch(() => {});

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

module.exports = { auth };
