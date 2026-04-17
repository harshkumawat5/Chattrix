const { ChatSession, User } = require("../../models");

const registerSessionHandlers = (io, socket) => {
  // userId is trusted — set by auth middleware, not from client payload
  socket.on("join-room", async ({ sessionId }) => {
    try {
      const { userId } = socket.data;

      const session = await ChatSession.findOne({ _id: sessionId, status: "active" });
      if (!session) {
        socket.emit("error", { message: "Session not found or already ended" });
        return;
      }

      const isParticipant = session.participants.some((p) => p.toString() === userId);
      if (!isParticipant) {
        socket.emit("error", { message: "You are not a participant of this session" });
        return;
      }

      socket.join(sessionId);
      socket.data.sessionId = sessionId;

      // send both userIds so client can determine offerer/answerer role
      const roomSockets = await io.in(sessionId).fetchSockets();
      const otherSocket = roomSockets.find((s) => s.data.userId !== userId);
      if (otherSocket) {
        // tell the existing peer about the new joiner
        otherSocket.emit("peer-joined", { userId });
        // tell the new joiner about the existing peer
        socket.emit("peer-joined", { userId: otherSocket.data.userId });
      }
    } catch {
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("leave-room", async () => {
    await handleDisconnect(io, socket, "skipped");
  });

  socket.on("disconnecting", async () => {
    await handleDisconnect(io, socket, "disconnect");
  });
};

const handleDisconnect = async (io, socket, endReason) => {
  const { sessionId, userId } = socket.data;
  if (!sessionId || !userId) return;

  // Clear sessionId immediately to prevent double-fire
  socket.data.sessionId = null;

  try {
    const session = await ChatSession.findOneAndUpdate(
      { _id: sessionId, status: "active" },
      { status: "ended", endedAt: new Date(), endedBy: userId, endReason },
      { returnDocument: "after" }
    );

    // Always notify peers — even if DB says session was already ended
    // (race between api.patch and socket leave-room)
    socket.to(sessionId).emit("peer-left", {
      userId,
      endReason,
      message: "Your partner has left the session",
    });

    if (session) {
      await User.updateMany({ _id: { $in: session.participants } }, { status: "online" });
    }
  } catch {
    // Still try to notify peers even if DB fails
    socket.to(sessionId).emit("peer-left", {
      userId,
      endReason,
      message: "Your partner has left the session",
    });
  }
};

module.exports = { registerSessionHandlers };
