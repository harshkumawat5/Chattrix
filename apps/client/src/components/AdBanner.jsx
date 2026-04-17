import { useEffect, useRef } from "react";
import "./AdBanner.css";

const ADS_ENABLED  = import.meta.env.VITE_ADS_ENABLED === "true";
const CLIENT       = import.meta.env.VITE_ADSENSE_CLIENT || "";

export default function AdBanner({ slot, label = "Advertisement" }) {
  const adRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADS_ENABLED || !CLIENT || !slot || pushed.current) return;
    try {
      // Push the ad only once
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch { /* AdSense not loaded yet — ignore */ }
  }, [slot]);

  // Don't render anything if ads are disabled or credentials missing
  if (!ADS_ENABLED || !CLIENT || !slot) return null;

  return (
    <div className="ad-banner-wrap">
      <span className="ad-label">{label}</span>
      <ins
        ref={adRef}
        className="adsbygoogle ad-banner-ins"
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="false"
      />
    </div>
  );
}
