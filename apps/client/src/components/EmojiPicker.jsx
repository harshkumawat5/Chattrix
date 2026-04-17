import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import "./EmojiPicker.css";

export default function EmojiPicker({ onSelect, onClose, excludeRef }) {
  const ref = useRef(null);
  const isMobile = window.innerWidth <= 480;

  useEffect(() => {
    const handler = (e) => {
      const inPicker = ref.current && ref.current.contains(e.target);
      const inExclude = excludeRef?.current && excludeRef.current.contains(e.target);
      if (!inPicker && !inExclude) onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler, { passive: true });
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose, excludeRef]);

  const perLine = isMobile ? Math.floor((window.innerWidth - 8) / 40) : 9;

  return (
    <>
      {isMobile && <div className="emoji-overlay" />}
      <div ref={ref} className="emoji-picker-wrap">
        <Picker
          data={data}
          onEmojiSelect={(e) => {
            // only insert emoji, do NOT close — user can pick multiple like WhatsApp
            onSelect(e.native);
          }}
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
