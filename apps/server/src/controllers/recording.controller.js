const mongoose = require("mongoose");
const { ChatSession, CallRecording } = require("../models");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createRecording = async (req, res, next) => {
  try {
    const {
      chatSessionId,
      ownerUserId,
      participantUserIds = [],
      provider,
      bucketName,
      objectKey,
      fileUrl,
      region,
      mimeType,
      sizeBytes,
      durationSeconds,
      startedAt,
      endedAt,
      status,
      metadata,
    } = req.body;

    if (!chatSessionId || !isValidObjectId(chatSessionId)) {
      return res.status(400).json({ message: "Valid chatSessionId is required" });
    }

    if (!ownerUserId || !isValidObjectId(ownerUserId)) {
      return res.status(400).json({ message: "Valid ownerUserId is required" });
    }

    if (!provider || !bucketName || !objectKey || !fileUrl) {
      return res.status(400).json({
        message: "provider, bucketName, objectKey, and fileUrl are required",
      });
    }

    const chatSession = await ChatSession.findById(chatSessionId).select("participants");
    if (!chatSession) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    const defaultParticipantIds = chatSession.participants || [];
    const finalParticipantIds = participantUserIds.length ? participantUserIds : defaultParticipantIds;

    const invalidParticipant = finalParticipantIds.some((id) => !isValidObjectId(id));
    if (invalidParticipant) {
      return res.status(400).json({ message: "participantUserIds contains invalid user id(s)" });
    }

    const recording = await CallRecording.create({
      chatSession: chatSessionId,
      ownerUser: ownerUserId,
      participantUsers: finalParticipantIds,
      provider,
      bucketName,
      objectKey,
      fileUrl,
      region,
      mimeType,
      sizeBytes,
      durationSeconds,
      startedAt,
      endedAt,
      status,
      metadata,
    });

    await ChatSession.findByIdAndUpdate(chatSessionId, {
      $addToSet: { recordings: recording._id },
    });

    return res.status(201).json({
      message: "Recording metadata saved",
      data: recording,
    });
  } catch (error) {
    return next(error);
  }
};

const listRecordingsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const role = req.query.role || "all";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    let filter = {};
    if (role === "owner") {
      filter = { ownerUser: userId };
    } else if (role === "participant") {
      filter = { participantUsers: userId };
    } else {
      filter = { $or: [{ ownerUser: userId }, { participantUsers: userId }] };
    }

    const [items, total] = await Promise.all([
      CallRecording.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CallRecording.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: items,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listRecordingsBySession = async (req, res, next) => {
  try {
    const { chatSessionId } = req.params;

    if (!isValidObjectId(chatSessionId)) {
      return res.status(400).json({ message: "Invalid chatSessionId" });
    }

    const items = await CallRecording.find({ chatSession: chatSessionId }).sort({ createdAt: -1 });

    return res.status(200).json({
      data: items,
    });
  } catch (error) {
    return next(error);
  }
};

const getRecordingById = async (req, res, next) => {
  try {
    const recording = await CallRecording.findById(req.params.id);
    if (!recording) return res.status(404).json({ message: "Recording not found" });
    return res.status(200).json({ data: recording });
  } catch (error) {
    return next(error);
  }
};

const deleteRecording = async (req, res, next) => {
  try {
    const recording = await CallRecording.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status: "deleted" },
      { new: true }
    );
    if (!recording) return res.status(404).json({ message: "Recording not found" });
    return res.status(200).json({ message: "Recording deleted", data: recording });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRecording,
  getRecordingById,
  listRecordingsByUser,
  listRecordingsBySession,
  deleteRecording,
};

