const { MatchRequest, User } = require("../models");
const { getSocket } = require("../socket/registry");

let timer = null;

const runExpiryJob = async () => {
  try {
    const expired = await MatchRequest.find({
      status: "searching",
      expiresAt: { $lt: new Date() },
    }).select("user");

    if (!expired.length) return;

    const userIds = expired.map((r) => r.user);

    await Promise.all([
      MatchRequest.updateMany(
        { status: "searching", expiresAt: { $lt: new Date() } },
        { status: "expired" }
      ),
      // user may already be deleted by MongoDB TTL — ignore errors
      User.updateMany({ _id: { $in: userIds }, status: { $exists: true } }, { status: "online" }).catch(() => {}),
    ]);

    userIds.forEach((userId) => {
      const socket = getSocket(userId.toString());
      if (socket) {
        socket.emit("match-expired", { message: "No match found nearby. Please try again." });
      }
    });
  } catch (error) {
    console.error("[ExpiryJob] Error:", error.message);
  }
};

const startExpiryJob = () => {
  if (timer) return;
  const intervalMs = Number(process.env.MATCH_EXPIRY_INTERVAL_MS);
  timer = setInterval(runExpiryJob, intervalMs);
  console.log(`Match expiry job started (interval: ${intervalMs}ms)`);
};

const stopExpiryJob = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { startExpiryJob, stopExpiryJob };
