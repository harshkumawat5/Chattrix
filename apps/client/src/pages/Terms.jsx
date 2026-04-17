import { useNavigate } from "react-router-dom";
import "./Legal.css";

const legalEmail = import.meta.env.VITE_EMAIL_LEGAL || "legal@chattrix.app";

export default function Terms() {
  const navigate = useNavigate();
  const goBack = () => window.history.length > 1 ? navigate(-1) : navigate("/");
  return (
    <div className="legal-page">
      <div className="legal-bg" />
      <div className="legal-container fade-up">
        <button className="legal-back" onClick={goBack}>← Back</button>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: January 2025</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Chattrix ("the Service"), you confirm that you are at least 18 years of age and agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2>2. Eligibility</h2>
          <p>You must be 18 years or older to use Chattrix. By using this Service, you represent and warrant that you meet this age requirement. We reserve the right to terminate accounts of users found to be under 18.</p>
        </section>

        <section>
          <h2>3. Prohibited Content & Conduct</h2>
          <p>You agree NOT to use the Service to:</p>
          <ul>
            <li>Share, display, or transmit nudity, sexually explicit content, or pornographic material</li>
            <li>Engage in or promote illegal activities including but not limited to drug trafficking, weapons dealing, or terrorism</li>
            <li>Harass, bully, threaten, or abuse other users</li>
            <li>Share content involving minors in any sexual or inappropriate context (strictly prohibited and reported to law enforcement)</li>
            <li>Transmit malware, viruses, or any harmful code</li>
            <li>Impersonate any person or entity</li>
            <li>Violate any applicable Indian or international laws</li>
          </ul>
        </section>

        <section>
          <h2>4. Content Moderation</h2>
          <p>Chattrix employs automated text filtering to detect and block prohibited content. Users who repeatedly violate content policies will be permanently banned. We cooperate fully with Indian law enforcement agencies including the Cyber Crime Cell when required by law.</p>
        </section>

        <section>
          <h2>5. Data Collection & Law Enforcement</h2>
          <p>In compliance with the Information Technology Act, 2000 (India) and IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, we collect and retain user IP addresses, approximate location data, and session logs. This data may be disclosed to government authorities upon receipt of a valid legal order.</p>
        </section>

        <section>
          <h2>6. User Banning</h2>
          <p>Users reported and blocked by 5 or more other users will be automatically and permanently banned from the Service. Chattrix reserves the right to ban any user at its sole discretion for violations of these Terms.</p>
        </section>

        <section>
          <h2>7. Disclaimer of Warranties</h2>
          <p>The Service is provided "as is" without warranties of any kind. Chattrix does not guarantee uninterrupted or error-free service.</p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>Chattrix shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service or from content shared by other users.</p>
        </section>

        <section>
          <h2>9. Governing Law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
        </section>

        <section>
          <h2>10. Changes to Terms</h2>
          <p>We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>For questions about these Terms, contact us at <a href={`mailto:${legalEmail}`}>{legalEmail}</a></p>
        </section>
      </div>
    </div>
  );
}
