import { Link } from "react-router-dom";
import "./AgeGate.css";

export default function AgeGate({ onAccept, onDecline }) {
  return (
    <div className="age-gate-overlay">
      <div className="age-gate-card fade-up">
        <div className="age-gate-icon">🔞</div>
        <h2>Adults Only (18+)</h2>
        <p>By entering Chattrix, you confirm that:</p>
        <ul>
          <li>✅ You are <strong>18 years of age or older</strong></li>
          <li>✅ You have read and agree to our <Link to="/terms" target="_blank">Terms of Service</Link></li>
          <li>✅ You have read and agree to our <Link to="/privacy" target="_blank">Privacy Policy</Link></li>
          <li>✅ You have read and agree to our <Link to="/safety" target="_blank">Safety Guidelines</Link></li>
          <li>✅ You will not share illegal, explicit, or harmful content</li>
        </ul>
        <p className="age-gate-note">
          Your IP address and location are logged for legal compliance under Indian IT Act, 2000.
        </p>
        <div className="age-gate-actions">
          <button className="btn btn-primary btn-lg" onClick={onAccept}>
            I am 18+ — Enter
          </button>
          <button className="btn btn-ghost" onClick={onDecline}>
            I am under 18 — Exit
          </button>
        </div>
      </div>
    </div>
  );
}
