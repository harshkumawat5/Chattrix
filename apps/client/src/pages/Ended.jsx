import { useNavigate } from "react-router-dom";
import "./Ended.css";

export default function Ended() {
  const navigate = useNavigate();

  return (
    <div className="ended-page">
      <div className="ended-bg" />
      <div className="ended-card fade-up">
        <div className="ended-emoji">👋</div>
        <h2>That's a wrap</h2>
        <p>Hope that was fun. Ready for another?</p>
        <div className="ended-actions">
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/match")}>
            Chat again →
          </button>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
