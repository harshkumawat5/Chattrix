/**
 * In-memory registry: userId (string) → socket instance
 * Allows REST controllers to push events to specific connected users.
 * Scoped to a single process — sufficient for single-instance deployment.
 * Replace with Redis adapter when scaling horizontally.
 */
const registry = new Map();

const register = (userId, socket) => registry.set(userId, socket);

const unregister = (userId) => registry.delete(userId);

const getSocket = (userId) => registry.get(userId) || null;

module.exports = { register, unregister, getSocket };
