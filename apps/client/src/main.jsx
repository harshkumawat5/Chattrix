import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./store/auth.store";
import { connectSocket } from "./lib/socket";

// reconnect socket on page refresh if token exists
const { accessToken } = useAuthStore.getState();
if (accessToken) connectSocket(accessToken);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
