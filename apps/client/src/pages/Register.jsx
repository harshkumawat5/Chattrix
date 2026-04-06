import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import { connectSocket } from "../lib/socket";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ displayName: "", email: "" });
  const [useGps, setUseGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const getGps = () =>
    new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(
        (p) => res([p.coords.longitude, p.coords.latitude]),
        () => rej()
      )
    );

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let location;
      if (useGps) {
        try {
          const coords = await getGps();
          location = { coordinates: coords };
        } catch {
          // fallback to IP — backend handles it
        }
      }
      const data = await api.post("/api/users/auth/register", {
        ...form,
        ...(location ? { location } : {}),
      });
      setAuth(data.data, data.accessToken, data.refreshToken);
      connectSocket(data.accessToken);
      navigate("/preferences");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card card fade-up">
        <div className="auth-logo">chattrix</div>
        <h2>Create account</h2>
        <p className="auth-sub">Jump in. No passwords needed.</p>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label>Display name</label>
            <input className="input" placeholder="e.g. Alex" value={form.displayName} onChange={set("displayName")} required />
          </div>
          <div className="field">
            <label>Email <span className="optional">(optional)</span></label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} />
          </div>

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

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Creating..." : "Get started →"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
