import { useAuthStore } from "../store/auth.store";
import { connectSocket } from "./socket";

const BASE = import.meta.env.VITE_API_URL;

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (newToken, error) => {
  refreshQueue.forEach((cb) => (error ? cb.reject(error) : cb.resolve(newToken)));
  refreshQueue = [];
};

const tryRefresh = async () => {
  const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${BASE}/api/users/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const { user } = useAuthStore.getState();
  setAuth(user, data.accessToken, data.refreshToken);
  connectSocket(data.accessToken);
  return data.accessToken;
};

const request = async (method, path, body, token, retry = true) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  // auto-refresh on 401
  if (res.status === 401 && retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken) => resolve(request(method, path, body, newToken, false)),
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await tryRefresh();
      processQueue(newToken, null);
      return request(method, path, body, newToken, false);
    } catch (err) {
      processQueue(null, err);
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  // for 409 return data with status so caller can handle it
  if (res.status === 409) {
    const err = new Error(data.message || "Conflict");
    err.status = 409;
    err.data = data.data; // existing resource (e.g. existing match request)
    throw err;
  }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

export const api = {
  post:   (path, body, token) => request("POST",   path, body, token),
  get:    (path, token)       => request("GET",    path, null, token),
  patch:  (path, body, token) => request("PATCH",  path, body, token),
  put:    (path, body, token) => request("PUT",    path, body, token),
  delete: (path, token)       => request("DELETE", path, null, token),
};
