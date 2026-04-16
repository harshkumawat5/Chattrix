import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import { connectSocket } from "../lib/socket";
import Icon from "../components/Icon";
import { useThemeStore } from "../store/theme.store";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const { user, accessToken, setAuth } = useAuthStore();
  const { theme, toggle } = useThemeStore();

  const [username,     setUsername]     = useState("");
  const [status,       setStatus]       = useState("idle"); // idle | checking | available | taken | invalid | loading
  const [suggestions,  setSuggestions]  = useState([]);
  const [useGps,       setUseGps]       = useState(false);
  const [error,        setError]        = useState("");
  const debounceRef = useRef(null);

  // if already logged in with valid token → go straight to match
  useEffect(() => {
    if (user && accessToken) navigate("/match");
  }, []);

  const validate = (val) => /^[a-z0-9_]+$/.test(val) && val.length >= 3 && val.length <= 20;

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(val);
    setSuggestions([]);
    setError("");

    if (!val) { setStatus("idle"); return; }
    if (val.length < 3) { setStatus("invalid"); return; }
    if (!validate(val)) { setStatus("invalid"); return; }

    setStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/api/users/check/${val}`);
        if (data.available) {
          setStatus("available");
        } else {
          setStatus("taken");
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        // on 429 keep current status — don't block the user
        if (err.message?.includes("429") || err.message?.includes("Too many")) return;
        setStatus("idle");
      }
    }, 400);
  };

  const getGps = () =>
    new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(
        (p) => res([p.coords.longitude, p.coords.latitude]),
        () => rej()
      )
    );

  const submit = async (e) => {
    e.preventDefault();
    if (status !== "available") return;
    setStatus("loading");
    setError("");
    try {
      let location;
      if (useGps) {
        try { location = { coordinates: await getGps() }; } catch {}
      }
      const data = await api.post("/api/users/auth/register", {
        username,
        ...(location ? { location } : {}),
      });
      setAuth(data.data, data.accessToken);
      connectSocket(data.accessToken);
      navigate("/match");
    } catch (err) {
      setError(err.message);
      setStatus("available");
    }
  };

  const pickSuggestion = (s) => {
    setUsername(s);
    setStatus("available");
    setSuggestions([]);
  };

  const statusIcon = {
    checking:  <Icon name="loader" size={18} />,
    available: <Icon name="checkCircle" size={18} color="var(--green)" />,
    taken:     <Icon name="xCircle" size={18} color="var(--red)" />,
    invalid:   <Icon name="alertTriangle" size={18} color="var(--orange)" />,
  };

  return (
    <div className="landing">
      <div className="landing-bg" />

      <nav className="landing-nav">
        <div className="logo-wrap">
          <img src="/android-chrome-192x192.png" alt="Chattrix" className="logo-img" />
          <span className="logo">Chattrix</span>
        </div>
        <div className="badge">🌍 Proximity-based random chat</div>
        <button className="theme-toggle" onClick={toggle} title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </nav>

      <main className="landing-hero fade-up">
        <h1>
          Meet people<br />
          <span className="gradient-text">near you.</span>
        </h1>
        <p className="hero-sub">
          Pick a username and start chatting instantly.<br />
          No sign-up. No password. Username expires when you leave.
        </p>

        <form className="username-form" onSubmit={submit}>
          <div className="username-input-wrap">
            <span className="username-prefix">@</span>
            <input
              className="username-input"
              placeholder="pick a username"
              value={username}
              onChange={handleUsernameChange}
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
            {statusIcon[status]}
          </div>

          {status === "taken" && suggestions.length > 0 && (
            <div className="suggestions">
              <span className="suggestions-label">Try:</span>
              {suggestions.map((s) => (
                <button key={s} type="button" className="suggestion-pill" onClick={() => pickSuggestion(s)}>
                  @{s}
                </button>
              ))}
            </div>
          )}

          {status === "invalid" && username.length > 0 && (
            <p className="username-hint">3–20 chars, letters, numbers, underscores only</p>
          )}

          <div className="location-toggle" onClick={() => setUseGps((v) => !v)}>
            <div className={`toggle ${useGps ? "on" : ""}`} />
            <div>
              <div className="toggle-label">
                {useGps ? "📍 Using GPS location" : "🌐 Using IP location"}
              </div>
              <div className="toggle-sub">
                {useGps ? "Better match accuracy" : "No permission needed — city-level"}
              </div>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={status !== "available"}
            style={{ width: "100%" }}
          >
            {status === "loading" ? "Entering..." : "Get started"}
          </button>
        </form>

        <div className="hero-stats">
          <div className="stat"><span>⚡</span> Instant match</div>
          <div className="stat"><span>📍</span> Location-aware</div>
          <div className="stat"><span>⏱</span> No account needed</div>
        </div>
      </main>
    </div>
  );
}
