const { ChatSession, User } = require("../models");

const getSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findById(req.params.id)
      .populate("participants", "displayName avatarUrl status locationSource")
      .populate("matchRequests");
    if (!session) return res.status(404).json({ message: "Session not found" });
    return res.status(200).json({ data: session });
  } catch (error) {
    return next(error);
  }
};

const endSession = async (req, res, next) => {
  try {
    const { endReason } = req.body;
    const endedBy = req.user._id;
    const allowed = ["completed", "skipped", "disconnect", "timeout", "error"];

    if (!endReason || !allowed.includes(endReason)) {
      return res.status(400).json({ message: `endReason must be one of: ${allowed.join(", ")}` });
    }

    const session = await ChatSession.findOneAndUpdate(
      { _id: req.params.id, status: "active" },
      { status: "ended", endedAt: new Date(), endedBy, endReason },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: "Active session not found" });

    // Set participants back to online
    await User.updateMany({ _id: { $in: session.participants } }, { status: "online" });

    return res.status(200).json({ data: session });
  } catch (error) {
    return next(error);
  }
};

const getUserSessions = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const userId = req.params.userId || req.user._id;
    const filter = { participants: userId };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      ChatSession.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit),
      ChatSession.countDocuments(filter),
    ]);

    return res.status(200).json({ data: items, pagination: { page, limit, total } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getSession, endSession, getUserSessions };
