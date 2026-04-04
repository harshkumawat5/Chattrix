import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import "./Preferences.css";

const MODES = ["audio", "video", "both"];
const DISTANCES = [
  { label: "Same block", value: 500 },
  { label: "Neighborhood", value: 2000 },
  { label: "City", value: 10000 },
  { label: "Region", value: 50000 },
];

export default function Preferences() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [mode, setMode] = useState("both");
  const [distIdx, setDistIdx] = useState(2);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.put(
        "/api/users/me/preferences",
        { preferredMode: mode, preferredMaxDistanceMeters: DISTANCES[distIdx].value },
        accessToken
      );
      navigate("/match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pref-page">
      <div className="pref-bg" />
      <div className="pref-card card fade-up">
        <div className="pref-header">
          <div className="auth-logo">chattrix</div>
          <h2>Set your vibe</h2>
          <p className="auth-sub">You can change these anytime.</p>
        </div>

        <div className="pref-section">
          <label className="pref-label">Chat mode</label>
          <div className="mode-tabs">
            {MODES.map((m) => (
              <button
                key={m}
                className={`mode-tab ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "audio" ? "🎙 Audio" : m === "video" ? "📹 Video" : "✨ Both"}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-section">
          <label className="pref-label">
            Match distance — <span className="pref-value">{DISTANCES[distIdx].label}</span>
          </label>
          <input
            type="range"
            min={0}
            max={DISTANCES.length - 1}
            value={distIdx}
            onChange={(e) => setDistIdx(Number(e.target.value))}
            className="dist-slider"
          />
          <div className="dist-labels">
            {DISTANCES.map((d, i) => (
              <span key={i} className={distIdx === i ? "active" : ""}>{d.label}</span>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%" }} onClick={save} disabled={loading}>
          {loading ? "Saving..." : "Let's go →"}
        </button>

        <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: -8 }} onClick={() => navigate("/match")}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
