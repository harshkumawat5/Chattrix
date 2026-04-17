import { Link } from "react-router-dom";
import "./EntryPopup.css";

export default function EntryPopup({ username, onConfirm, onCancel }) {
  return (
    <div className="entry-overlay">
      <div className="entry-card fade-up">
        <div className="entry-icon">👋</div>
        <h3>Welcome, @{username}!</h3>
        <p>Before you enter, please confirm:</p>

        <ul className="entry-rules">
          <li>✅ I am <strong>18 years or older</strong></li>
          <li>✅ I will <strong>not share</strong> nudity or explicit content</li>
          <li>✅ I will <strong>not engage</strong> in illegal activities</li>
          <li>✅ I agree to the <Link to="/terms" target="_blank">Terms of Service</Link></li>
          <li>✅ I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link></li>
          <li>✅ I agree to the <Link to="/safety" target="_blank">Safety Guidelines</Link></li>
        </ul>

        <div className="entry-actions">
          <button className="btn btn-primary btn-lg" onClick={onConfirm}>
            I Agree — Enter Chattrix
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
