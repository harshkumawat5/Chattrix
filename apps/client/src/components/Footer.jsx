import { Link } from "react-router-dom";
import "./Footer.css";

const safetyEmail = import.meta.env.VITE_EMAIL_SAFETY || "safety@chattrix.app";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/safety">Safety</Link>
        <Link to="/contact">Contact Us</Link>
      </div>
      <p className="footer-copy">
        © {new Date().getFullYear()} Chattrix. All rights reserved. For users 18+ only.
      </p>
      <p className="footer-legal">
        Chattrix complies with the Information Technology Act, 2000 and IT (Intermediary Guidelines) Rules, 2021 (India).
        Report illegal content: <a href={`mailto:${safetyEmail}`}>{safetyEmail}</a> | Cyber Crime Helpline: <strong>1930</strong>
      </p>
    </footer>
  );
}
