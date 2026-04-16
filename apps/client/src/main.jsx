import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./store/auth.store";
import { useThemeStore } from "./store/theme.store";
import { connectSocket } from "./lib/socket";

const { accessToken, clearAuth } = useAuthStore.getState();
useThemeStore.getState().init();

if (accessToken) {
  // verify token is not expired before reconnecting
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      clearAuth(); // token expired — send to username screen
    } else {
      connectSocket(accessToken);
    }
  } catch {
    clearAuth();
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
