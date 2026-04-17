import { useState } from "react";
import "./ReportModal.css";

const REASONS = [
  { value: "nudity",        label: "🔞 Nudity / Sexual content" },
  { value: "harassment",    label: "😡 Harassment / Bullying" },
  { value: "threats",       label: "⚠️ Threats / Violence" },
  { value: "illegal",       label: "🚫 Illegal activity" },
  { value: "spam",          label: "📢 Spam / Scam" },
  { value: "minor",         label: "👶 Suspected minor (under 18)" },
  { value: "other",         label: "📝 Other" },
];

export default function ReportModal({ onSubmit, onSkip }) {
  const [selected, setSelected] = useState("");
  const [other, setOther]       = useState("");

  const handleSubmit = () => {
    const reason = selected === "other" ? (other.trim() || "other") : selected;
    if (!reason) return;
    onSubmit(reason);
  };

  return (
    <div className="report-overlay">
      <div className="report-card fade-up">
        <h3>Report this user</h3>
        <p>Why are you blocking this person?</p>

        <div className="report-reasons">
          {REASONS.map((r) => (
            <button
              key={r.value}
              className={`report-reason-btn${selected === r.value ? " active" : ""}`}
              onClick={() => setSelected(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {selected === "other" && (
          <input
            className="report-other-input"
            placeholder="Describe the issue..."
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={200}
            autoFocus
          />
        )}

        <div className="report-actions">
          <button
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={!selected}
          >
            Submit Report
          </button>
          <button className="btn btn-ghost" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
