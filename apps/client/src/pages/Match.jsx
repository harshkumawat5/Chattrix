import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket, connectSocket, getPendingMatch, clearPendingMatch, disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/auth.store";
import "./Match.css";

export default function Match() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, user, clearAuth } = useAuthStore();
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState("video");
  const matchRequestId = useRef(null);
  const startSearchRef = useRef(null);
  const modeRef = useRef("video");

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // auto-start search if navigated here with ?autostart=video|text (from skip)
  useEffect(() => {
    const autostart = searchParams.get("autostart");
    if (autostart === "video" || autostart === "text") {
      setMode(autostart);
      // small delay so socket listeners are registered first
      const t = setTimeout(() => doSearch(autostart), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const logout = async () => {
    await api.post("/api/users/auth/logout", null, accessToken).catch(() => {});
    disconnectSocket();
    clearAuth();
    navigate("/");
  };

  useEffect(() => {
    const socket = connectSocket(accessToken);

    const pending = getPendingMatch();
    if (pending) {
      clearPendingMatch();
      const route = pending.mode === "text" ? `/chat/${pending.sessionId}` : `/call/${pending.sessionId}`;
      navigate(route);
      return;
    }

    const onMatchFound = ({ sessionId, mode: sessionMode }) => {
      clearPendingMatch();
      const route = sessionMode === "text" ? `/chat/${sessionId}` : `/call/${sessionId}`;
      navigate(route);
    };

    const onMatchExpired = () => {
      setStatus("expired");
      matchRequestId.current = null;
    };

    socket.on("match-found", onMatchFound);
    socket.on("match-expired", onMatchExpired);

    let pollTimer = null;
    const startPolling = (requestId) => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try {
          const data = await api.get(`/api/match-requests/${requestId}`, accessToken);
          if (data.data?.status === "matched") {
            clearInterval(pollTimer);
            const sessions = await api.get("/api/users/me/sessions?status=active", accessToken);
            const session = sessions.data?.[0];
            if (session) {
              const route = session.mode === "text" ? `/chat/${session._id}` : `/call/${session._id}`;
              navigate(route);
            }
          } else if (["expired", "cancelled"].includes(data.data?.status)) {
            clearInterval(pollTimer);
            setStatus("expired");
          }
        } catch { clearInterval(pollTimer); }
      }, 2000);
    };
    startSearchRef.current = startPolling;

    return () => {
      socket.off("match-found", onMatchFound);
      socket.off("match-expired", onMatchExpired);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [accessToken, navigate]);

  const doSearch = async (selectedMode) => {
    setStatus("searching");
    try {
      const data = await api.post("/api/match-requests", { mode: selectedMode }, accessToken);
      if (data.data?.session) {
        const route = selectedMode === "text" ? `/chat/${data.data.session._id}` : `/call/${data.data.session._id}`;
        navigate(route);
        return;
      }
      matchRequestId.current = data.data?._id;
      if (startSearchRef.current) startSearchRef.current(data.data?._id);
    } catch (err) {
      if (err.status === 409 && err.data?._id) {
        try {
          await api.delete(`/api/match-requests/${err.data._id}`, accessToken);
          const data = await api.post("/api/match-requests", { mode: selectedMode }, accessToken);
          if (data.data?.session) {
            const route = selectedMode === "text" ? `/chat/${data.data.session._id}` : `/call/${data.data.session._id}`;
            navigate(route);
            return;
          }
          matchRequestId.current = data.data?._id;
          if (startSearchRef.current) startSearchRef.current(data.data?._id);
        } catch { setStatus("error"); }
        return;
      }
      setStatus("error");
    }
  };

  const cancel = async () => {
    if (matchRequestId.current) {
      await api.delete(`/api/match-requests/${matchRequestId.current}`, accessToken).catch(() => {});
      matchRequestId.current = null;
    }
    setStatus("idle");
  };

  return (
    <div className="match-page">
      <div className="match-bg" />

      <nav className="match-nav">
        <span className="logo">chattrix</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>👤 {user?.displayName}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      </nav>

      <main className="match-main">
        {status === "idle" && (
          <div className="match-idle fade-up">
            <div className="match-avatar">
              {user?.displayName?.[0]?.toUpperCase() || "?"}
            </div>
            <h2>How do you want to connect?</h2>
            <p>Pick a mode and we'll find someone nearby.</p>

            <div className="mode-cards">
              <button
                className={`mode-card ${mode === "video" ? "active" : ""}`}
                onClick={() => setMode("video")}
              >
                <span className="mode-icon">📹</span>
                <span className="mode-title">Video Chat</span>
                <span className="mode-desc">See & talk face to face</span>
              </button>
              <button
                className={`mode-card ${mode === "text" ? "active" : ""}`}
                onClick={() => setMode("text")}
              >
                <span className="mode-icon">💬</span>
                <span className="mode-title">Text Chat</span>
                <span className="mode-desc">Anonymous, no camera needed</span>
              </button>
            </div>

            <button className="btn btn-primary btn-lg" onClick={() => doSearch(mode)}>
              Find a match →
            </button>
          </div>
        )}

        {status === "searching" && (
          <div className="match-searching fade-up">
            <div className="pulse-wrapper">
              <div className="pulse-ring" />
              <div className="pulse-ring delay" />
              <div className="pulse-dot" />
            </div>
            <h2>Looking nearby...</h2>
            <p>Finding someone for {mode === "text" ? "text" : "video"} chat.</p>
            <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
          </div>
        )}

        {status === "expired" && (
          <div className="match-idle fade-up">
            <div className="match-avatar" style={{ background: "var(--bg3)" }}>😔</div>
            <h2>No one nearby right now</h2>
            <p>Try again in a moment.</p>
            <button className="btn btn-primary btn-lg" onClick={() => doSearch(mode)}>
              Try again →
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="match-idle fade-up">
            <div className="match-avatar" style={{ background: "var(--bg3)" }}>⚠️</div>
            <h2>Something went wrong</h2>
            <p>Check your connection and try again.</p>
            <button className="btn btn-primary btn-lg" onClick={() => setStatus("idle")}>
              Go back
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
