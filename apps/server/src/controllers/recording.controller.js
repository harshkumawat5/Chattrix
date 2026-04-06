const mongoose = require("mongoose");
const { ChatSession, CallRecording } = require("../models");
const {
  buildObjectKey,
  createPresignedUpload,
  getDefaultUploadExpiry,
  isConfigured,
} = require("../config/recordingStorage");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const allowedStatuses = new Set(["uploading", "available", "failed", "deleted"]);

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([key]) => key && typeof key === "string")
    .map(([key, val]) => [key, String(val)]);
  return Object.fromEntries(entries);
};

const loadSessionForParticipant = async (chatSessionId, userId) => {
  const chatSession = await ChatSession.findById(chatSessionId).select("participants mode");
  if (!chatSession) return { error: { code: 404, message: "Chat session not found" } };

  const isParticipant = chatSession.participants.some((id) => id.toString() === String(userId));
  if (!isParticipant) return { error: { code: 403, message: "Not a participant of this chat session" } };

  return { chatSession };
};

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

    const finalOwnerUserId = ownerUserId || req.user._id;
    if (!finalOwnerUserId || !isValidObjectId(finalOwnerUserId)) {
      return res.status(400).json({ message: "Valid ownerUserId is required" });
    }

    if (!provider || !bucketName || !objectKey || !fileUrl) {
      return res.status(400).json({
        message: "provider, bucketName, objectKey, and fileUrl are required",
      });
    }

    const sessionResult = await loadSessionForParticipant(chatSessionId, req.user._id);
    if (sessionResult.error) {
      return res.status(sessionResult.error.code).json({ message: sessionResult.error.message });
    }
    const { chatSession } = sessionResult;

    const defaultParticipantIds = chatSession.participants || [];
    const finalParticipantIds = participantUserIds.length ? participantUserIds : defaultParticipantIds;

    const invalidParticipant = finalParticipantIds.some((id) => !isValidObjectId(id));
    if (invalidParticipant) {
      return res.status(400).json({ message: "participantUserIds contains invalid user id(s)" });
    }

    const sessionParticipantSet = new Set(defaultParticipantIds.map((id) => id.toString()));
    const outsideSessionParticipants = finalParticipantIds.some(
      (id) => !sessionParticipantSet.has(id.toString())
    );
    if (outsideSessionParticipants) {
      return res.status(400).json({ message: "participantUserIds must be chat session participants" });
    }

    const recording = await CallRecording.create({
      chatSession: chatSessionId,
      ownerUser: finalOwnerUserId,
      participantUsers: finalParticipantIds,
      provider,
      bucketName,
      objectKey,
      fileUrl,
      region,
      mimeType,
      sizeBytes: toPositiveNumber(sizeBytes, 0),
      durationSeconds: toPositiveNumber(durationSeconds, 0),
      startedAt: toDateOrNull(startedAt),
      endedAt: toDateOrNull(endedAt),
      status: allowedStatuses.has(status) ? status : "available",
      metadata: normalizeMetadata(metadata),
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

const createRecordingPresign = async (req, res, next) => {
  try {
    const {
      chatSessionId,
      mimeType = "video/webm",
      extension = "webm",
      expiresInSeconds = getDefaultUploadExpiry(),
    } = req.body || {};

    if (!isValidObjectId(chatSessionId)) {
      return res.status(400).json({ message: "Valid chatSessionId is required" });
    }

    const sessionResult = await loadSessionForParticipant(chatSessionId, req.user._id);
    if (sessionResult.error) {
      return res.status(sessionResult.error.code).json({ message: sessionResult.error.message });
    }

    if (!isConfigured()) {
      return res.status(503).json({ message: "Recording storage is not configured on server" });
    }

    const objectKey = buildObjectKey({
      chatSessionId,
      ownerUserId: req.user._id,
      extension,
    });

    const presigned = await createPresignedUpload({
      objectKey,
      mimeType,
      expiresInSeconds: toPositiveNumber(expiresInSeconds, getDefaultUploadExpiry()),
    });

    return res.status(200).json({
      message: "Upload URL generated",
      data: presigned,
    });
  } catch (error) {
    return next(error);
  }
};

const finalizeRecording = async (req, res, next) => {
  try {
    const {
      chatSessionId,
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
      uploadError,
    } = req.body || {};

    if (!isValidObjectId(chatSessionId)) {
      return res.status(400).json({ message: "Valid chatSessionId is required" });
    }

    if (!provider || !bucketName || !objectKey || !fileUrl) {
      return res.status(400).json({
        message: "provider, bucketName, objectKey, and fileUrl are required",
      });
    }

    const sessionResult = await loadSessionForParticipant(chatSessionId, req.user._id);
    if (sessionResult.error) {
      return res.status(sessionResult.error.code).json({ message: sessionResult.error.message });
    }
    const { chatSession } = sessionResult;

    const normalizedStatus = allowedStatuses.has(status) ? status : "available";
    const insertPayload = {
      chatSession: chatSessionId,
      ownerUser: req.user._id,
      participantUsers: chatSession.participants,
      provider,
      bucketName,
      objectKey,
      fileUrl,
      region: region || null,
      mimeType: mimeType || "video/webm",
      sizeBytes: toPositiveNumber(sizeBytes, 0),
      durationSeconds: toPositiveNumber(durationSeconds, 0),
      startedAt: toDateOrNull(startedAt),
      endedAt: toDateOrNull(endedAt),
      status: normalizedStatus,
      uploadError: uploadError ? String(uploadError) : null,
      metadata: normalizeMetadata(metadata),
    };

    const recording = await CallRecording.findOneAndUpdate(
      {
        provider,
        bucketName,
        objectKey,
      },
      {
        $setOnInsert: insertPayload,
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

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
      { returnDocument: "after" }
    );
    if (!recording) return res.status(404).json({ message: "Recording not found" });
    return res.status(200).json({ message: "Recording deleted", data: recording });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRecordingPresign,
  finalizeRecording,
  createRecording,
  getRecordingById,
  listRecordingsByUser,
  listRecordingsBySession,
  deleteRecording,
};
