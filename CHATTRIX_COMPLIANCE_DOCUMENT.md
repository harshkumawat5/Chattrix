<div align="center">
<img src="apps/client/public/android-chrome-192x192.png" alt="Chattrix Logo" width="120" style="border-radius: 16px" />
# Chattrix Compliance & Security Architecture Document
### Prepared for: Ministry of Electronics and Information Technology (MeitY), Government of India
**Date:** April 18, 2026
</div>
---
## Executive Summary
Chattrix is an online communications platform designed strictly for adults (18+). This document serves as a comprehensive overview of the **Terms of Service**, **Privacy Policy**, **Safety Guidelines**, and operational mechanisms implemented by Chattrix to ensure legal compliance, user safety, and cooperation with law enforcement. We explicitly adhere to the **Information Technology Act, 2000 (India)** and the **Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021**.
## 1. Safety & Eligibility (Age Gate Mechanism)
Access to Chattrix is strictly restricted to users aged 18 and above. Prior to entry, users must pass a mandatory "Age Gate" mechanism visible on the frontend screen (`apps/client/src/components/AgeGate.jsx`) acknowledging the following:
*   Users must explicitly confirm they are **18 years of age or older**.
*   Users must explicitly confirm they are **18 years of age or older**.
or to entry, users*   Users must commit to not shaorng illegal, explicit, or harmful content.
### Legal Notice at Entry
Users are notified at the point of entry before a session starts: 
> *"Your IP address and location are logged for legal compliance under the Indian IT Act, 2000."*
## 2. Platform Architecture & Data Security
Chattrix relies on temporary "sessions" to pseudo-anonymize user identity, operating without long-term accounts while simultaneously preserving the required digital footprint for law enforcement traceability.
### WebRTC End-to-End Encryption
Video calls operate primarily on **WebRTC P2P (Peer-to-Peer) connections**.
- Audio and Video streams are fundamentally **End-to-End Encrypted (E2EE)** by WebRTC standards (DTLS/SRTP).
- The media streams **are not routed through Chattrix servers**, preventing interception and adhering to strict privacy protections.
- Connections fallback to metered TURN servers (`Metered.ca`) only when strict NAT configurations block direct P2P.
### Backend LLD Architecture Screenshot
Here is the architectural design demonstrating the separation of socket signaling operations and MongoDB storage:
<div align="center">
  <img src="docs/lld_backend.png" alt="Backend Architecture Diagram" width="500"/>
</div>
### Ephemeral Data & Document TTL (Time-To-Live)
As outlined in our `User.model.js`, MongoDB automatically purges active username profiles and signaling sessions following 15 minutes of inactivity using TTL indexes. 
```javascript
// apps/server/src/models/User.model.js
userSchema.index({ expiresAt: 1 }, { expireAfterSeconduserSchema.index({ expiresAt: 1 }, { expireAfterSeconduserSchema.index({  reuserSchema.index({ expiresAt: 1 }, { expireAfterSeconduserSchema.index({ expiresAt: 1 }, { expireAlimits are placed on all entryways using `express-rate-limit`:
```javascript
// apps/server/src/middlewares/rateLimiter.middleware.js
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS),
  max: Number(process.env.RATE_LIMIT_AUTH_MAX), // 10 max
  message: { message: "Too many auth attempts, please try again later." },
});
```
---
## 3. Law Enforcement Cooperation & Data Retention
### Privacy Policy: Information Collected
While frontend profiles explicitly delete after 15 minutes of inactivity (`SESSION_TTL_MS`), Chattrix retains essential data exclusively for law enforcement compliance:
*   **IP Address:** Logged upon session initiation. Stored permanently in secure backend logs (`UserLog.model.*   **IP Adimplementations).
*   **Geolocation:** Approximate radius points used for matches.
*   **Session Logs & Match Requests:** Timestamps of connections and blocked relationships.
*   **Block Reports:** User-submitted abuse reports.
### Disclosure Protocol (IT Rules 2021)
Chattrix fulfills and exceeds the requirement of retaining user interaction context for **at least 180 days** for law enforcement purposes.
In compliance with the *IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021*, Chattrix will disclose retained IP addresses, approximate session coordinates, and blocking history to **Indian government agencies and law enforcement** upon receipt of a valid legal order (e.g., Section 91 CrPC notice).
---
## 4. Content Moderation & Banning Protocols
Chattrix aggressively combats abuse via automated filtering and user-actionable reporting tools.
### Automated Text Filtering
Real-time regex and string matching occurs on the server to block harmful text messages related to explicit abuse, threats, drugs, and terrorism in multiple languages (English & Hindi).
```javascript
// apps/server/src/utils/contentFilter.js
const ENGLISH_PATTERNS = [ ... ];
const HINDI_SUBSTRINGS = [ "bhadwa", "jaan se maar", "charas bech", "pistol bech" ... ];
const containsBannedContent = (text) => {
  if (!text) return false;
  // Blocks message processing if match found
};
```
### User Reporting & Automatic Banning
Users can immediately block and report peers (`apps/client/src/components/ReportModal.jsx`) for:
*   🔞 Nudity / Sexual content
*   😡 Harassment / Bullying
*   ⚠️ Threats / Violence
*   🚫 Illegal activity
*   👶 Suspected minor (under 18)
**Automatic Over-Encroachment Ban:** Users reported and blocked by **5 or more** distinct IP profiles in close succession are automatically placed and retained in a permanent platform blackhole, blocking future access via their IP and device fingerprint.
### CSAM (Child Sexual Abuse Material) Zero-Tolerance
Any content involving minors flagged under the *`minor`* reporting tag creates an immediate, silent audit flag. AssociatedAny contentsion data logs are affirmatively expedited to the **National Center for Missing & Exploited Children (NCMEC)** and the **Indian Cyber Crime Coordination Centre (I4C)** without requiring a prior warrant request.Any content involving miact Channels & Emergency Escalations
For government inquiries, section 91 requests, and active For government inquiries, section 91 requests, and active For government inquiries, section 9es:*For government inquiries, sec**Safety/Emergency Takedowns:** `safety@chattrix.app`
*(For India*(For India*(For Indidling imminent threats to life, Chattrix processing teams offer 24/7 turnaround at `safety@chattrix.app` without mandating standard court-order timelines.)*
---
<div align="center">
  <b>END OF COMPLIANCE DOCUMENT</b>
</div>
