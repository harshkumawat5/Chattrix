import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { api } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const { user, accessToken, clearAuth } = useAuthStore();

  const logout = async () => {
    await api.post("/api/users/auth/logout", null, accessToken).catch(() => {});
    disconnectSocket();
    clearAuth();
    navigate("/");
  };

  return (
    <div className="landing">
      <div className="landing-bg" />

      <nav className="landing-nav">
        <span className="logo">chattrix</span>
        {user ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/match")}>
              Start Chatting
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>Log in</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/register")}>Sign up</button>
          </div>
        )}
      </nav>

      <main className="landing-hero fade-up">
        <div className="badge">🌍 Proximity-based random chat</div>
        <h1>
          Meet people<br />
          <span className="gradient-text">near you.</span>
        </h1>
        <p className="hero-sub">
          Instant video & audio chats with strangers nearby.<br />
          No algorithms. No feeds. Just real conversations.
        </p>
        <div className="hero-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate(user ? "/match" : "/register")}
          >
            {user ? "Start chatting →" : "Create account →"}
          </button>
          {!user && (
            <button className="btn btn-ghost btn-lg" onClick={() => navigate("/login")}>
              Log in
            </button>
          )}
        </div>

        <div className="hero-stats">
          <div className="stat"><span>⚡</span> Instant match</div>
          <div className="stat"><span>📍</span> Location-aware</div>
          <div className="stat"><span>🎲</span> Random & real</div>
        </div>
      </main>
    </div>
  );
}
