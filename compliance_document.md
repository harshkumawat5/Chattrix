# Chattrix - Compliance & Moderation Framework

## 1. Introduction
This document outlines the legal, privacy, and safety frameworks implemented by **Chattrix** to comply with Indian guidelines (including the Information Technology Act, 2000, and IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021). Our platform strictly prohibits illegal activities, non-consensual explicit content, and serves users aged 18 and above.

## 2. Age Verification & Explicit Consent
Before accessing the platform, absolute consent is captured regarding age and the prohibition of illegal content. Users must confirm they are 18+ and agree to community guidelines.

**Implementation (Frontend Entry Popup):**
```jsx
// src/components/EntryPopup.jsx
<ul className="entry-rules">
  <li>✅ I am <strong>18 years or older</strong></li>
  <li>✅ I will <strong>not share</strong> nudity or explicit content</li>
  <li>✅ I will <strong>not engage</strong> in illegal activities</li>
  <li>✅ I agree to the <Link to="/terms">Terms of Service</Link></li>
  <li>✅ I agree to the <Link to="/privacy">Privacy Policy</Link></li>
  <li>✅ I agree to the <Link to="/safety">Safety Guidelines</Link></li>
</ul>
```

## 3. Handling Nudity, Video Sexting, and Prohibited Content
Chattrix maintains a zero-tolerance policy against:
- Non-consensual explicit content (revenge porn).
- Child Sexual Abuse Material (CSAM).
- Unsolicited nudity and explicit video broadcasting.

**Safety Mechanisms:**
1. **User Reporting:** Users can flag inappropriate behavior during active sessions.
2. **Instant Ban:** Accounts flagged for violating community guidelines are permanently restricted.
3. **Automated Moderation (Future Scope/Active API):** Video frames are periodically analyzed using AI moderation APIs for NSFW content detection without recording backend streams.

## 4. Privacy Policy & Data Handling
- **Data Minimization:** We collect only necessary data points (e.g., username, IP address for banning malicious users).
- **Ephemeral Connections:** Video/Chat streams utilize WebRTC peer-to-peer architecture. Streams are not recorded or saved on our servers to protect user privacy.
- **Data Encryption:** All data in transit is secured using TLS/SSL.

**Secure Environment Configuration (Example):**
```env
# .env.production
NODE_ENV=production
PORT=8080

# Database & Storage (No PII or streams saved)
DB_URI=mongodb+srv://<REDACTED_USER>:<REDACTED_PASS>@cluster.mongodb.net/chattrix
JWT_SECRET=super_secret_redacted_key

# Moderation API Keys
MODERATION_API_KEY=redacted_api_key_for_nsfw_detection
```

## 5. Terms of Service & Legal Actions
- **Intermediary Safe Harbor:** As an intermediary, Chattrix acts promptly on grievances to remove algorithmic access to reported explicit/illegal content within the legally mandated timeframe (e.g., 24-36 hours).
- **Cooperation with Law Enforcement:** In the event of cybercrime investigations, Chattrix provides necessary metadata (IP logs, account creation timestamps) to Indian law enforcement agencies upon receiving a valid legal order.
- **Grievance Officer:** A dedicated contact (grievance@chattrix_domain.com) is available for users and authorities.

## 6. Conclusion
Chattrix is committed to building a safe, moderated, and compliant environment. By combining strict entry agreements, anonymous peer-to-peer privacy, and robust reporting mechanisms, we align with the safety standards required for digital platforms operating in India.
