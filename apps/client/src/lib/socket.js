import { io } from "socket.io-client";

let socket = null;

let pendingMatchFound = null;
let pendingPeerLeft   = null;

export const getSocket = () => socket;

export const getPendingMatch    = () => pendingMatchFound;
export const clearPendingMatch  = () => { pendingMatchFound = null; };
export const getPendingPeerLeft  = () => pendingPeerLeft;
export const clearPendingPeerLeft = () => { pendingPeerLeft = null; };

export const connectSocket = (token) => {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: `Bearer ${token}` },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("match-found", (data) => { pendingMatchFound = data; });
  socket.on("peer-left",   (data) => { pendingPeerLeft   = data; });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  pendingMatchFound = null;
  pendingPeerLeft   = null;
};
