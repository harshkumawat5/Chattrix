const jwt = require("jsonwebtoken");
const { User, UserPreference } = require("../models");
const { resolveCoordinatesFromIp } = require("../utils/geoip");
const { signAccessToken, signRefreshToken, hashToken, compareToken } = require("../utils/jwt");

// ── Auth ────────────────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const { displayName, email, avatarUrl, languages, location } = req.body;
    if (!displayName) return res.status(400).json({ message: "displayName is required" });

    let resolvedLocation;
    let locationSource = "ip";

    if (location?.coordinates?.length === 2) {
      resolvedLocation = { type: "Point", coordinates: location.coordinates };
      locationSource = "gps";
    } else {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
      const geo = await resolveCoordinatesFromIp(ip);
      // fallback to a default location if IP resolution fails (e.g. localhost dev)
      resolvedLocation = {
        type: "Point",
        coordinates: geo ? geo.coordinates : [0, 0],
      };
      locationSource = "ip";
    }

    const user = await User.create({
      displayName,
      email,
      avatarUrl,
      languages,
      location: resolvedLocation,
      locationSource,
      status: "online",
    });

    await UserPreference.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id } },
      { upsert: true, new: true }
    );

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await User.findByIdAndUpdate(user._id, { refreshToken: hashToken(refreshToken) });

    return res.status(201).json({ data: user, accessToken, refreshToken });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await User.findByIdAndUpdate(user._id, { refreshToken: hashToken(refreshToken) });

    return res.status(200).json({ data: user, accessToken, refreshToken });
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "refreshToken is required" });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(payload.sub).select("+refreshToken");
    if (!user || !user.refreshToken) return res.status(401).json({ message: "Refresh token revoked" });

    const valid = compareToken(refreshToken, user.refreshToken);
    if (!valid) return res.status(401).json({ message: "Refresh token mismatch" });

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    await User.findByIdAndUpdate(user._id, { refreshToken: hashToken(newRefreshToken) });

    return res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null, status: "offline" });
    return res.status(200).json({ message: "Logged out" });
  } catch (error) {
    return next(error);
  }
};

// ── Profile ─────────────────────────────────────────────────────

const getUser = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user._id;
    const user = await User.findById(userId).select("-blockedUsers");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ data: user });
  } catch (error) {
    return next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { coordinates } = req.body;

    let location;
    let locationSource;

    if (coordinates?.length === 2) {
      location = { type: "Point", coordinates };
      locationSource = "gps";
    } else {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
      const geo = await resolveCoordinatesFromIp(ip);
      location = { type: "Point", coordinates: geo ? geo.coordinates : [0, 0] };
      locationSource = "ip";
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { location, locationSource, locationUpdatedAt: new Date() },
      { new: true }
    );

    return res.status(200).json({ data: user });
  } catch (error) {
    return next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["offline", "online", "searching", "in_call"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const user = await User.findByIdAndUpdate(req.user._id, { status }, { new: true });
    return res.status(200).json({ data: user });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    await UserPreference.deleteOne({ user: req.user._id });
    return res.status(200).json({ message: "User deleted" });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, refresh, logout, getUser, updateLocation, updateStatus, deleteUser };
