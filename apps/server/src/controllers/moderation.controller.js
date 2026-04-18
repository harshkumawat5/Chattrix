const { RekognitionClient, DetectModerationLabelsCommand } = require("@aws-sdk/client-rekognition");
const { User, ChatSession, UserLog } = require("../models");
const { getSocket } = require("../socket/registry");

// Lazy-init client so missing credentials don't crash startup
let rekognitionClient = null;
const getClient = () => {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return rekognitionClient;
};

// Labels Rekognition returns for explicit/illegal content
const FLAGGED_LABELS = [
  "Explicit Nudity", "Nudity", "Graphic Male Nudity", "Graphic Female Nudity",
  "Sexual Activity", "Illustrated Explicit Nudity", "Adult Content",
  "Partial Nudity", "Barechested Male",
  "Weapons", "Weapon Violence", "Knife", "Gun",
  "Drugs", "Drug Products", "Drug Use", "Pills",
  "Violence", "Graphic Violence",
];

/**
 * Check if an IP is permanently banned.
 * Called from registration to block banned users from re-entering.
 */
const isIpBanned = async (ipAddress) => {
  const record = await UserLog.findOne({
    ipAddress,
    reportReason: /^AUTO_MODERATION:/,
  }).lean();
  return !!record;
};

const checkFrame = async (req, res) => {
  try {
    const enabled = process.env.MODERATION_ENABLED !== "false";
    if (!enabled) return res.status(200).json({ flagged: false });

    const { frameBase64, sessionId, reportedUserId } = req.body;
    if (!frameBase64 || !sessionId || !reportedUserId) {
      return res.status(400).json({ message: "frameBase64, sessionId, reportedUserId required" });
    }

    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    if (!awsKey || !awsSecret || awsKey === "your-aws-access-key-id") {
      return res.status(200).json({ flagged: false, reason: "moderation_disabled" });
    }

    const threshold = parseFloat(process.env.MODERATION_CONFIDENCE_THRESHOLD) || 80;

    // Strip data URL prefix and convert to buffer
    const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(base64Data, "base64");

    const command = new DetectModerationLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: threshold,
    });

    const result = await getClient().send(command);
    const labels = result.ModerationLabels || [];

    const flaggedLabel = labels.find((l) =>
      FLAGGED_LABELS.some((f) => l.Name?.includes(f) || l.ParentName?.includes(f))
    );

    if (flaggedLabel) {
      const reason = flaggedLabel.Name;
      const confidence = flaggedLabel.Confidence;

      // 1. End the session immediately
      await ChatSession.findOneAndUpdate(
        { _id: sessionId, status: "active" },
        { status: "ended", endedAt: new Date(), endReason: "error" }
      ).catch(() => {});

      // 2. Ban the user — set undiscoverable + offline
      const bannedUser = await User.findByIdAndUpdate(
        reportedUserId,
        { isDiscoverable: false, status: "offline" },
        { new: false }
      ).catch(() => null);

      // 3. Get the banned user's IP from their UserLog
      const bannedUserLog = await UserLog.findOne({ sessionUserId: reportedUserId }).sort({ createdAt: -1 }).lean();
      const bannedIp = bannedUserLog?.ipAddress || "unknown";

      // 4. Permanent IP ban log — checked on every registration
      await UserLog.create({
        username: bannedUser?.username || "unknown",
        ipAddress: bannedIp,
        coordinates: bannedUser?.location?.coordinates || null,
        locationSource: bannedUser?.locationSource || "ip",
        userAgent: req.headers["user-agent"]?.slice(0, 300) || null,
        action: "block_report",
        sessionUserId: reportedUserId,
        reportedUserId: reportedUserId,
        reportReason: `AUTO_MODERATION: ${reason} (confidence: ${confidence.toFixed(1)}%)`,
      }).catch(() => {});

      // 5. Notify + force disconnect the banned user's socket
      const reportedSocket = getSocket(reportedUserId.toString());
      if (reportedSocket) {
        reportedSocket.emit("moderation-ban", {
          message: "Your session was ended due to a policy violation. Your account has been permanently suspended.",
        });
        setTimeout(() => reportedSocket.disconnect(true), 500);
      }

      return res.status(200).json({ flagged: true, reason, confidence });
    }

    return res.status(200).json({ flagged: false });
  } catch {
    return res.status(200).json({ flagged: false, reason: "error" });
  }
};

module.exports = { checkFrame, isIpBanned };
