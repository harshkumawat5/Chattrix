import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const { user, accessToken, setAuth, refreshToken } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarUrl,   setAvatarUrl]   = useState(user?.avatarUrl || "");
  const [languages,   setLanguages]   = useState((user?.languages || []).join(", "));
  const [loading,     setLoading]     = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const langArray = languages.split(",").map((l) => l.trim()).filter(Boolean);
      const data = await api.patch("/api/users/me", {
        displayName,
        avatarUrl: avatarUrl || null,
        languages: langArray,
      }, accessToken);
      setAuth(data.data, accessToken, refreshToken);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const avatar = avatarUrl || null;
  const initials = displayName?.[0]?.toUpperCase() || "?";

  return (
    <div className="profile-page">
      <div className="profile-bg" />

      <div className="profile-card card fade-up">
        <div className="profile-header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/match")}>
            ← Back
          </button>
          <span className="logo">chattrix</span>
        </div>

        <div className="profile-avatar-wrap">
          {avatar
            ? <img src={avatar} alt="avatar" className="profile-avatar-img" />
            : <div className="profile-avatar-placeholder">{initials}</div>
          }
        </div>

        <form onSubmit={save} className="profile-form">
          <div className="field">
            <label>Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} maxLength={50} />
          </div>

          <div className="field">
            <label>Avatar URL <span className="optional">(optional)</span></label>
            <input className="input" placeholder="https://..." value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </div>

          <div className="field">
            <label>Languages <span className="optional">(comma separated)</span></label>
            <input className="input" placeholder="English, Hindi, Spanish" value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </div>

          <div className="profile-meta">
            <span>📍 {user?.locationSource === "gps" ? "GPS location" : "IP location"}</span>
            <span>📧 {user?.email || "No email"}</span>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Saving..." : saved ? "✅ Saved!" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
