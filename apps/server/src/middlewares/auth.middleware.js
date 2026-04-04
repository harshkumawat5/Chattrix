const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: payload.sub, displayName: payload.displayName };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

module.exports = { auth };
