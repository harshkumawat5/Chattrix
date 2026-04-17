import { useNavigate } from "react-router-dom";
import "./Legal.css";

const safetyEmail = import.meta.env.VITE_EMAIL_SAFETY || "safety@chattrix.app";

export default function Safety() {
  const navigate = useNavigate();
  const goBack = () => window.history.length > 1 ? navigate(-1) : navigate("/");
  return (
    <div className="legal-page">
      <div className="legal-bg" />
      <div className="legal-container fade-up">
        <button className="legal-back" onClick={goBack}>← Back</button>
        <h1>Safety Guidelines</h1>
        <p className="legal-updated">Last updated: January 2025</p>

        <section>
          <h2>🛡 Our Commitment to Safety</h2>
          <p>Chattrix is committed to providing a safe environment for adults. We have zero tolerance for illegal content, exploitation, or abuse.</p>
        </section>

        <section>
          <h2>🚫 Strictly Prohibited</h2>
          <ul>
            <li><strong>Child Sexual Abuse Material (CSAM)</strong> — Any content involving minors is immediately reported to NCMEC and Indian law enforcement (CBI Cyber Crime). Users will be permanently banned and prosecuted.</li>
            <li><strong>Nudity & Sexual Content</strong> — Explicit sexual content is prohibited. Violations result in immediate ban.</li>
            <li><strong>Weapons & Drugs</strong> — Discussion or display of illegal weapons, drugs, or controlled substances is prohibited.</li>
            <li><strong>Terrorism & Extremism</strong> — Content promoting terrorism, violence, or extremist ideologies is strictly prohibited and reported to authorities.</li>
            <li><strong>Harassment & Threats</strong> — Threatening, stalking, or harassing other users is prohibited.</li>
          </ul>
        </section>

        <section>
          <h2>✅ How We Enforce Safety</h2>
          <ul>
            <li><strong>Age Verification</strong> — All users must confirm they are 18+ before accessing the Service</li>
            <li><strong>Automated Text Filtering</strong> — Messages containing prohibited words are automatically blocked</li>
            <li><strong>Block System</strong> — Users blocked by 5 or more people are automatically banned</li>
            <li><strong>IP Logging</strong> — All user IPs are permanently logged for law enforcement use</li>
            <li><strong>Law Enforcement Cooperation</strong> — We fully cooperate with Indian Cyber Crime Cell, CBI, and other agencies</li>
          </ul>
        </section>

        <section>
          <h2>🆘 How to Stay Safe</h2>
          <ul>
            <li>Never share personal information (real name, address, phone number, financial details)</li>
            <li>Use the Block button immediately if someone makes you uncomfortable</li>
            <li>Do not meet strangers from the platform in person</li>
            <li>If you witness illegal activity, use the Block button — we log all reports</li>
            <li>Trust your instincts — if something feels wrong, disconnect immediately</li>
          </ul>
        </section>

        <section>
          <h2>📞 Report Illegal Content</h2>
          <p>To report illegal content or activity, contact us at <a href={`mailto:${safetyEmail}`}>{safetyEmail}</a></p>
          <p>For emergencies involving imminent harm, contact Indian Cyber Crime Helpline: <strong>1930</strong></p>
          <p>National Cyber Crime Reporting Portal: <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a></p>
        </section>
      </div>
    </div>
  );
}
