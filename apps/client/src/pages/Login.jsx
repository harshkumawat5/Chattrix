import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import { connectSocket } from "../lib/socket";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/api/users/auth/login", { email });
      setAuth(data.data, data.accessToken, data.refreshToken);
      connectSocket(data.accessToken);
      navigate("/match");
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
        <h2>Welcome back</h2>
        <p className="auth-sub">Enter your email to continue.</p>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Logging in..." : "Continue →"}
          </button>
        </form>

        <p className="auth-footer">
          New here? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
