import { useNavigate } from "react-router-dom";
import "./Legal.css";

const privacyEmail = import.meta.env.VITE_EMAIL_PRIVACY || "privacy@chattrix.app";

export default function Privacy() {
  const navigate = useNavigate();
  const goBack = () => window.history.length > 1 ? navigate(-1) : navigate("/");
  return (
    <div className="legal-page">
      <div className="legal-bg" />
      <div className="legal-container fade-up">
        <button className="legal-back" onClick={goBack}>← Back</button>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: January 2025</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>When you use Chattrix, we collect:</p>
          <ul>
            <li><strong>IP Address</strong> — collected at registration and each session, stored permanently for legal compliance</li>
            <li><strong>Username</strong> — the temporary username you choose</li>
            <li><strong>Session Logs</strong> — timestamps of connections, session durations, and match history</li>
            <li><strong>Block Reports</strong> — records of users you block or who block you</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To match you with nearby users for video and text chat</li>
            <li>To enforce our Terms of Service and ban policy</li>
            <li>To comply with Indian law enforcement requests under the IT Act, 2000</li>
            <li>To investigate reports of illegal activity</li>
            <li>To improve the Service</li>
          </ul>
        </section>

        <section>
          <h2>3. Data Retention</h2>
          <p>Your username and session data are automatically deleted after 15 minutes of inactivity. However, <strong>IP addresses, location data, and session logs are retained permanently</strong> in compliance with Indian IT Rules 2021, which require intermediaries to retain user data for at least 180 days for law enforcement purposes.</p>
        </section>

        <section>
          <h2>4. Disclosure to Law Enforcement</h2>
          <p>In compliance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, we will disclose user data to Indian government agencies and law enforcement upon receipt of a valid legal order, court order, or as required by law. We do not require a court order to respond to emergency requests involving imminent threat to life.</p>
        </section>

        <section>
          <h2>5. Data Security</h2>
          <p>We implement industry-standard security measures to protect your data. Video calls are peer-to-peer (WebRTC) and not routed through our servers. Text messages are relayed through our servers but not stored permanently.</p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p>We use localStorage to store your session token and theme preference. No third-party tracking cookies are used.</p>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <p>You may request deletion of your account data by contacting us. Note that IP logs and session records required for legal compliance cannot be deleted.</p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>For privacy concerns, contact us at <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a></p>
        </section>
      </div>
    </div>
  );
}
