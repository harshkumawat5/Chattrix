const jwt = require("jsonwebtoken");

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id, username: user.username, displayName: user.displayName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );

module.exports = { signAccessToken };
