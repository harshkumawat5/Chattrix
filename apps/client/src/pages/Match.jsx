import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket, connectSocket, getPendingMatch, clearPendingMatch } from "../lib/socket";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import Footer from "../components/Footer";
import AdBanner from "../components/AdBanner";
import "./Match.css";


const DISTANCES = [
  { label: "Nearby",       meters: 1000,   svg: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> },
  { label: "Neighborhood", meters: 5000,   svg: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
  { label: "City",         meters: 20000,  svg: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg> },
  { label: "Anywhere",     meters: 100000, svg: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> },
];

export default function Match() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, user } = useAuthStore();
  const { theme, toggle } = useThemeStore();

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
    const instant   = searchParams.get("instant") === "1";
    if (autostart === "video" || autostart === "text") {
      setMode(autostart);
      // instant=1 means coming from skip/peer-left — search immediately, no delay
      // normal autostart waits 2500ms past the 2s cooldown window
      const delay = instant ? 50 : 2500;
      const t = setTimeout(() => doSearch(autostart), delay);
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
        <div className="logo-wrap">
          <img src="/android-chrome-192x192.png" alt="Chattrix" className="logo-img" />
          <span className="logo">Chattrix</span>
        </div>
        <span className="match-username">@{user?.username}</span>
        <button className="theme-toggle" onClick={toggle} title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
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
                <span className="mode-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                </span>
                <span className="mode-title">Video Chat</span>
                <span className="mode-desc">See & talk face to face</span>
              </button>
              <button className={`mode-card ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>
                <span className="mode-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                </span>
                <span className="mode-title">Text Chat</span>
                <span className="mode-desc">Anonymous, no camera needed</span>
              </button>
            </div>

            {/* distance — only meaningful for GPS users */}
            {isGps ? (
              <div className="dist-section">
                <div className="dist-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Match distance — <span className="dist-value">{DISTANCES[distIdx].label}</span>
                </div>
                <div className="dist-pills">
                  {DISTANCES.map((d, i) => (
                    <button
                      key={i}
                      className={`dist-pill ${distIdx === i ? "active" : ""}`}
                      onClick={() => setDistIdx(i)}
                    >
                      {d.svg} {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="dist-ip-note">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                Matching within your city (IP-based)
              </p>
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
      <AdBanner slot={import.meta.env.VITE_AD_SLOT_MATCH} />
      <Footer />
    </div>
  );
}
