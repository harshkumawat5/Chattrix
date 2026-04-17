import { useNavigate } from "react-router-dom";
import "./Legal.css";

const E = {
  general:   import.meta.env.VITE_EMAIL_GENERAL   || "hello@chattrix.app",
  legal:     import.meta.env.VITE_EMAIL_LEGAL     || "legal@chattrix.app",
  safety:    import.meta.env.VITE_EMAIL_SAFETY    || "safety@chattrix.app",
  privacy:   import.meta.env.VITE_EMAIL_PRIVACY   || "privacy@chattrix.app",
  grievance: import.meta.env.VITE_EMAIL_GRIEVANCE || "grievance@chattrix.app",
};

export default function Contact() {
  const navigate = useNavigate();
  const goBack = () => window.history.length > 1 ? navigate(-1) : navigate("/");
  return (
    <div className="legal-page">
      <div className="legal-bg" />
      <div className="legal-container fade-up">
        <button className="legal-back" onClick={goBack}>← Back</button>
        <h1>Contact Us</h1>

        <section>
          <h2>General Inquiries</h2>
          <p>Email: <a href={`mailto:${E.general}`}>{E.general}</a></p>
        </section>

        <section>
          <h2>Legal & Law Enforcement</h2>
          <p>For legal requests, court orders, or law enforcement inquiries:</p>
          <p>Email: <a href={`mailto:${E.legal}`}>{E.legal}</a></p>
          <p>We respond to valid legal orders within 72 hours as required by IT Rules 2021.</p>
        </section>

        <section>
          <h2>Safety & Abuse Reports</h2>
          <p>To report illegal content, CSAM, or safety concerns:</p>
          <p>Email: <a href={`mailto:${E.safety}`}>{E.safety}</a></p>
          <p>Indian Cyber Crime Helpline: <strong>1930</strong></p>
          <p>National Cyber Crime Portal: <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a></p>
        </section>

        <section>
          <h2>Privacy Requests</h2>
          <p>Email: <a href={`mailto:${E.privacy}`}>{E.privacy}</a></p>
        </section>

        <section>
          <h2>Grievance Officer</h2>
          <p>As required under IT Rules 2021, our Grievance Officer can be contacted at:</p>
          <p>Email: <a href={`mailto:${E.grievance}`}>{E.grievance}</a></p>
          <p>We acknowledge complaints within 24 hours and resolve within 15 days.</p>
        </section>
      </div>
    </div>
  );
}
