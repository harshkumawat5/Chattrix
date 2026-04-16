import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import "./EmojiPicker.css";

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  const isMobile = window.innerWidth <= 480;

  useEffect(() => {
    if (isMobile) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose, isMobile]);

  // fill full width on mobile
  const perLine = isMobile ? Math.floor((window.innerWidth - 8) / 40) : 9;

  return (
    <>
      {isMobile && (
        <div className="emoji-overlay" onMouseDown={onClose} onTouchStart={onClose} />
      )}
      <div ref={ref} className="emoji-picker-wrap">
        <Picker
          data={data}
          onEmojiSelect={(e) => { onSelect(e.native); onClose(); }}
          theme="auto"
          set="native"
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={2}
          perLine={perLine}
          emojiSize={isMobile ? 30 : 26}
          emojiButtonSize={isMobile ? 40 : 36}
          searchPosition="sticky"
          navPosition="bottom"
          icons="outline"
        />
      </div>
    </>
  );
}
