import { useAuthStore } from "../store/auth.store";

const BASE = import.meta.env.VITE_API_URL;

const request = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  // session expired — clear auth and send back to username screen
  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    window.location.href = "/";
    throw new Error("Session expired");
  }

  // 429 — rate limited, throw with status so caller can handle gracefully
  if (res.status === 429) {
    const err = new Error(data.message || "Too many requests");
    err.status = 429;
    throw err;
  }

  // 409 — return with status so caller can handle (e.g. stale match request)
  if (res.status === 409) {
    const err = new Error(data.message || "Conflict");
    err.status = 409;
    err.data = data.data;
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
