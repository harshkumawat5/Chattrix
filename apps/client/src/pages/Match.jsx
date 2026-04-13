import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket, connectSocket, getPendingMatch, clearPendingMatch } from "../lib/socket";
import { useAuthStore } from "../store/auth.store";
import "./Match.css";

const DISTANCES = [
  { label: "Nearby",      meters: 1000,  icon: "🏠" },
  { label: "Neighborhood",meters: 5000,  icon: "🏘" },
  { label: "City",        meters: 20000, icon: "🏙" },
  { label: "Anywhere",    meters: 100000,icon: "🌍" },
];

export default function Match() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, user } = useAuthStore();

  const [status,      setStatus]      = useState("idle");
  const [mode,        setMode]        = useState("video");
  const [distIdx,     setDistIdx]     = useState(2); // default City
  const matchRequestId = useRef(null);
  const startSearchRef = useRef(null);
  const pollTimerRef   = useRef(null);
  const modeRef        = useRef("video");

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const autostart = searchParams.get("autostart");
    if (autostart === "video" || autostart === "text") {
      setMode(autostart);
      const t = setTimeout(() => doSearch(autostart), 300);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const socket = connectSocket(accessToken);

    const pending = getPendingMatch();
    if (pending) {
      clearPendingMatch();
      navigate(pending.mode === "text" ? `/chat/${pending.sessionId}` : `/call/${pending.sessionId}`);
      return;
    }

    const onMatchFound = ({ sessionId, mode: sessionMode }) => {
      clearPendingMatch();
      navigate(sessionMode === "text" ? `/chat/${sessionId}` : `/call/${sessionId}`);
    };

    const onMatchExpired = () => {
      if (matchRequestId.current) {
        setStatus("expired");
        matchRequestId.current = null;
      }
    };

    socket.on("match-found",   onMatchFound);
    socket.on("match-expired", onMatchExpired);

    const startPolling = (requestId) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const data = await api.get(`/api/match-requests/${requestId}`, accessToken);
          if (data.data?.status === "matched") {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            const sessions = await api.get("/api/users/me/sessions?status=active", accessToken);
            const session = sessions.data?.[0];
            if (session) navigate(session.mode === "text" ? `/chat/${session._id}` : `/call/${session._id}`);
          } else if (data.data?.status === "expired") {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            if (matchRequestId.current) setStatus("expired");
          } else if (data.data?.status === "cancelled") {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        } catch {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }, 2000);
    };
    startSearchRef.current = startPolling;

    return () => {
      socket.off("match-found",   onMatchFound);
      socket.off("match-expired", onMatchExpired);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [accessToken, navigate]);

  const doSearch = async (selectedMode, selectedDistIdx) => {
    const idx = selectedDistIdx ?? distIdx;
    const maxDistance = DISTANCES[idx].meters;
    setStatus("searching");
    try {
      const data = await api.post("/api/match-requests", { mode: selectedMode, maxDistanceMeters: maxDistance }, accessToken);
      if (data.data?.session) {
        navigate(selectedMode === "text" ? `/chat/${data.data.session._id}` : `/call/${data.data.session._id}`);
        return;
      }
      matchRequestId.current = data.data?._id;
      if (startSearchRef.current) startSearchRef.current(data.data?._id);
    } catch (err) {
      if (err.status === 409 && err.data?._id) {
        try {
          await api.delete(`/api/match-requests/${err.data._id}`, accessToken);
          const data = await api.post("/api/match-requests", { mode: selectedMode, maxDistanceMeters: maxDistance }, accessToken);
          if (data.data?.session) {
            navigate(selectedMode === "text" ? `/chat/${data.data.session._id}` : `/call/${data.data.session._id}`);
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
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    setStatus("idle");
  };

  const isGps = user?.locationSource === "gps";

  return (
    <div className="match-page">
      <div className="match-bg" />

      <nav className="match-nav">
        <span className="logo">chattrix</span>
        <span className="match-username">@{user?.username}</span>
      </nav>

      <main className="match-main">
        {status === "idle" && (
          <div className="match-idle fade-up">
            <div className="match-avatar">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <h2>How do you want to connect?</h2>

            <div className="mode-cards">
              <button className={`mode-card ${mode === "video" ? "active" : ""}`} onClick={() => setMode("video")}>
                <span className="mode-icon">📹</span>
                <span className="mode-title">Video Chat</span>
                <span className="mode-desc">See & talk face to face</span>
              </button>
              <button className={`mode-card ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>
                <span className="mode-icon">💬</span>
                <span className="mode-title">Text Chat</span>
                <span className="mode-desc">Anonymous, no camera needed</span>
              </button>
            </div>

            {/* distance — only meaningful for GPS users */}
            {isGps ? (
              <div className="dist-section">
                <div className="dist-label">
                  📍 Match distance — <span className="dist-value">{DISTANCES[distIdx].label}</span>
                </div>
                <div className="dist-pills">
                  {DISTANCES.map((d, i) => (
                    <button
                      key={i}
                      className={`dist-pill ${distIdx === i ? "active" : ""}`}
                      onClick={() => setDistIdx(i)}
                    >
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="dist-ip-note">🌐 Matching within your city (IP-based)</p>
            )}

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
            <p>Finding someone for {mode === "text" ? "text" : "video"} chat{isGps ? ` within ${DISTANCES[distIdx].label.toLowerCase()}` : ""}.</p>
            <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
          </div>
        )}

        {status === "expired" && (
          <div className="match-idle fade-up">
            <div className="match-avatar" style={{ background: "var(--bg3)" }}>😔</div>
            <h2>No one nearby right now</h2>
            <p>Try a wider distance or check back in a moment.</p>
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
