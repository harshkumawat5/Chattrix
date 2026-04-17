const { RekognitionClient, DetectModerationLabelsCommand } = require("@aws-sdk/client-rekognition");
const { User, ChatSession } = require("../models");
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

      // End the session
      await ChatSession.findOneAndUpdate(
        { _id: sessionId, status: "active" },
        { status: "ended", endedAt: new Date(), endReason: "error" }
      ).catch(() => {});

      // Ban the reported user
      await User.findByIdAndUpdate(reportedUserId, {
        isDiscoverable: false,
        status: "offline",
      }).catch(() => {});

      // Notify reported user via socket
      const reportedSocket = getSocket(reportedUserId.toString());
      if (reportedSocket) {
        reportedSocket.emit("moderation-ban", {
          message: "Your session was ended due to a policy violation. Your account has been suspended.",
        });
      }

      return res.status(200).json({ flagged: true, reason, confidence: flaggedLabel.Confidence });
    }

    return res.status(200).json({ flagged: false });
  } catch {
    // Never crash the call over moderation errors — fail open
    return res.status(200).json({ flagged: false, reason: "error" });
  }
};

module.exports = { checkFrame };
