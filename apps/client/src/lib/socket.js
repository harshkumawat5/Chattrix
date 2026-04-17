import { io } from "socket.io-client";

let socket = null;

let pendingMatchFound  = null;
let pendingPeerLeft    = null;
let pendingPeerJoined  = null; // cached so StrictMode double-invoke never misses it

export const getSocket = () => socket;

export const getPendingMatch      = () => pendingMatchFound;
export const clearPendingMatch    = () => { pendingMatchFound = null; };
export const getPendingPeerLeft   = () => pendingPeerLeft;
export const clearPendingPeerLeft = () => { pendingPeerLeft = null; };
export const getPendingPeerJoined  = () => pendingPeerJoined;
export const clearPendingPeerJoined = () => { pendingPeerJoined = null; };

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
  socket.on("peer-joined", (data) => { pendingPeerJoined = data; });

  // Store ICE servers as soon as they arrive so Call.jsx never misses them
  socket.on("ice-config", (cfg) => {
    if (cfg?.iceServers) socket.iceServers = cfg.iceServers;
  });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  pendingMatchFound  = null;
  pendingPeerLeft    = null;
  pendingPeerJoined  = null;
};
