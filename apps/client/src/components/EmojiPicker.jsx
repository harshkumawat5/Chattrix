import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import "./EmojiPicker.css";

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  const isMobile = window.innerWidth <= 480;
  const perLine = isMobile ? Math.floor((window.innerWidth - 8) / 40) : 9;

  // Desktop: close on outside click. Mobile: closed by toggle button only.
  useEffect(() => {
    if (isMobile) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose, isMobile]);

  return (
    <div ref={ref} className="emoji-picker-wrap">
      <Picker
        data={data}
        onEmojiSelect={(e) => onSelect(e.native)}
        theme="auto"
        set="native"
        previewPosition="none"
        skinTonePosition="none"
        maxFrequentRows={2}
        perLine={perLine}
        emojiSize={isMobile ? 28 : 26}
        emojiButtonSize={isMobile ? 36 : 36}
        searchPosition="sticky"
        navPosition="bottom"
        icons="outline"
      />
    </div>
  );
}
