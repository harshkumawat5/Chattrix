const { User, UserPreference, MatchRequest, ChatSession } = require("../models");
const { getIpDefaultRadius } = require("../utils/geoip");
const { getSocket } = require("../socket/registry");

const createMatchRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, pref] = await Promise.all([
      User.findById(userId),
      UserPreference.findOne({ user: userId }),
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent duplicate searching requests
    const existing = await MatchRequest.findOne({ user: userId, status: "searching" });
    if (existing) return res.status(409).json({ message: "Already searching", data: existing });

    const isGps = user.locationSource === "gps";
    const maxDistance = isGps
      ? (pref?.preferredMaxDistanceMeters ?? 10000)
      : getIpDefaultRadius();
    const minDistance = isGps ? (pref?.preferredMinDistanceMeters ?? 0) : 0;

    // if pref is null or mode is "both", fall back to req.body.mode
    const prefMode = pref?.preferredMode;
    const mode = (!prefMode || prefMode === "both") ? req.body.mode : prefMode;

    if (!mode || !["audio", "video", "text"].includes(mode)) {
      return res.status(400).json({ message: "mode (audio|video|text) is required" });
    }

    const myRequest = await MatchRequest.create({
      user: userId,
      mode,
      minDistanceMeters: minDistance,
      maxDistanceMeters: maxDistance,
      locationSnapshot: user.location,
    });

    // Try to find a match: another searching user within range with same mode
    const candidate = await MatchRequest.findOne({
      _id: { $ne: myRequest._id },
      user: { $ne: userId, $nin: user.blockedUsers },
      status: "searching",
      mode,
      locationSnapshot: {
        $nearSphere: {
          $geometry: user.location,
          $maxDistance: maxDistance,
          $minDistance: minDistance,
        },
      },
    });

    if (!candidate) {
      await User.findByIdAndUpdate(userId, { status: "searching" });
      return res.status(202).json({ message: "Searching for a match...", data: myRequest });
    }

    // Match found — create session and mark both requests matched
    const session = await ChatSession.create({
      participants: [userId, candidate.user],
      mode,
      initiatedBy: userId,
      matchRequests: [myRequest._id, candidate._id],
      distanceMeters: null,
    });

    await Promise.all([
      MatchRequest.findByIdAndUpdate(myRequest._id, { status: "matched", matchedAt: new Date() }),
      MatchRequest.findByIdAndUpdate(candidate._id, { status: "matched", matchedAt: new Date() }),
      User.findByIdAndUpdate(userId, { status: "in_call" }),
      User.findByIdAndUpdate(candidate.user, { status: "in_call" }),
    ]);

    // Push match-found to the waiting user (202 case) via socket
    // so they don't need to poll anymore
    const waitingSocket = getSocket(candidate.user.toString());
    if (waitingSocket) {
      waitingSocket.emit("match-found", {
        sessionId: session._id,
        mode,
        matchedWith: userId,
      });
    }

    return res.status(201).json({ message: "Match found!", data: { session, matchRequest: myRequest } });
  } catch (error) {
    return next(error);
  }
};

const getMatchRequest = async (req, res, next) => {
  try {
    const request = await MatchRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Match request not found" });
    return res.status(200).json({ data: request });
  } catch (error) {
    return next(error);
  }
};

const cancelMatchRequest = async (req, res, next) => {
  try {
    const request = await MatchRequest.findOneAndUpdate(
      { _id: req.params.id, status: "searching" },
      { status: "cancelled" },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: "Active match request not found" });

    await User.findByIdAndUpdate(request.user, { status: "online" });

    return res.status(200).json({ message: "Match request cancelled", data: request });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createMatchRequest, getMatchRequest, cancelMatchRequest };
