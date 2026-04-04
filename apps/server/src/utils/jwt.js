const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const signAccessToken = (user) =>
  jwt.sign({ sub: user._id, displayName: user.displayName }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

const hashToken = (token) => bcrypt.hashSync(token, 10);

const compareToken = (token, hash) => bcrypt.compareSync(token, hash);

module.exports = { signAccessToken, signRefreshToken, hashToken, compareToken };
