const registerSignalHandlers = (io, socket) => {
  socket.on("offer", ({ sessionId, offer }) => {
    socket.to(sessionId).emit("offer", { offer, fromUserId: socket.data.userId });
  });

  socket.on("answer", ({ sessionId, answer }) => {
    socket.to(sessionId).emit("answer", { answer, fromUserId: socket.data.userId });
  });

  socket.on("ice-candidate", ({ sessionId, candidate }) => {
    socket.to(sessionId).emit("ice-candidate", { candidate, fromUserId: socket.data.userId });
  });

  // text chat — relay message to the other peer in the room
  socket.on("send-message", ({ sessionId, text }) => {
    if (!text?.trim()) return;
    socket.to(sessionId).emit("receive-message", {
      text: text.trim(),
      fromUserId: socket.data.userId,
      timestamp: Date.now(),
    });
  });

  // typing indicator
  socket.on("typing", ({ sessionId, isTyping }) => {
    socket.to(sessionId).emit("peer-typing", { isTyping });
  });
};

module.exports = { registerSignalHandlers };
