const { User, UserPreference } = require("../models");
const { resolveCoordinatesFromIp } = require("../utils/geoip");
const { signAccessToken } = require("../utils/jwt");

// ── helpers ──────────────────────────────────────────────────────

const generateSuggestions = async (username) => {
  const suggestions = [];
  const base = username.slice(0, 17);
  for (let i = 0; suggestions.length < 3; i++) {
    const candidate = `${base}_${Math.floor(10 + Math.random() * 90)}`;
    const exists = await User.exists({ username: candidate });
    if (!exists) suggestions.push(candidate);
  }
  return suggestions;
};

// ── Auth ─────────────────────────────────────────────────────────

const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username || username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ available: false, message: "Invalid username format" });
    }
    const exists = await User.exists({ username });
    if (exists) {
      const suggestions = await generateSuggestions(username);
      return res.status(200).json({ available: false, suggestions });
    }
    return res.status(200).json({ available: true });
  } catch (error) {
    return next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { username, location } = req.body;
    if (!username) return res.status(400).json({ message: "username is required" });

    const clean = username.toLowerCase().trim();
    if (clean.length < 3 || clean.length > 20 || !/^[a-z0-9_]+$/.test(clean)) {
      return res.status(400).json({ message: "username must be 3-20 chars, letters/numbers/underscores only" });
    }

    const exists = await User.exists({ username: clean });
    if (exists) {
      const suggestions = await generateSuggestions(clean);
      return res.status(409).json({ message: "Username already taken", suggestions });
    }

    let resolvedLocation;
    let locationSource = "ip";

    if (location?.coordinates?.length === 2) {
      resolvedLocation = { type: "Point", coordinates: location.coordinates };
      locationSource = "gps";
    } else {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
      const geo = await resolveCoordinatesFromIp(ip);
      resolvedLocation = { type: "Point", coordinates: geo ? geo.coordinates : [0, 0] };
    }

    const ttl = Number(process.env.SESSION_TTL_MS) || 900000;
    const user = await User.create({
      username: clean,
      displayName: clean,
      location: resolvedLocation,
      locationSource,
      status: "online",
      expiresAt: new Date(Date.now() + ttl),
    });

    await UserPreference.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id } },
      { upsert: true, new: true }
    );

    const accessToken = signAccessToken(user);
    return res.status(201).json({ data: user, accessToken });
  } catch (error) {
    return next(error);
  }
};

// ── Profile ──────────────────────────────────────────────────────

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
    let location, locationSource;

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

const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) return res.status(400).json({ message: "Cannot block yourself" });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: userId } });
    return res.status(200).json({ message: "User blocked" });
  } catch (error) {
    return next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: userId } });
    return res.status(200).json({ message: "User unblocked" });
  } catch (error) {
    return next(error);
  }
};

module.exports = { checkUsername, register, getUser, updateLocation, updateStatus, deleteUser, blockUser, unblockUser };
