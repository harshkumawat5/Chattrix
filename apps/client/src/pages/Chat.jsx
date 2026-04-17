import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, getPendingPeerLeft, clearPendingPeerLeft } from "../lib/socket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import Icon from "../components/Icon";
import EmojiPicker from "../components/EmojiPicker";
import ReportModal from "../components/ReportModal";
import "./Chat.css";

export default function Chat() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { accessToken } = useAuthStore();

  const chatEndRef    = useRef(null);
  const messagesRef   = useRef(null);
  const inputRef      = useRef(null);
  const inputRowRef   = useRef(null);
  const isNearBottom  = useRef(true);

  const [messages,    setMessages]    = useState([]);
  const [msgInput,    setMsgInput]    = useState("");
  const [connected,   setConnected]   = useState(false);
  const [duration,    setDuration]    = useState(0);
  const [peerTyping,  setPeerTyping]  = useState(false);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [blockedMsg,  setBlockedMsg]  = useState("");
  const [showReport,  setShowReport]  = useState(false);
  const [reportPeerId, setReportPeerId] = useState(null);
  const showReportRef = useRef(false);
  const typingTimer = useRef(null);

  useEffect(() => {
    showReportRef.current = showReport;
  }, [showReport]);

  // Scroll to bottom smoothly — use rAF to avoid layout thrashing / flicker
  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !isNearBottom.current) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, peerTyping]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigate("/match"); return; }

    if (getPendingPeerLeft()) {
      clearPendingPeerLeft();
      navigate("/ended");
      return;
    }

    let cancelled = false;

    const onPeerJoined  = ({ userId: peerId } = {}) => {
      if (!cancelled) {
        setConnected(true);
        if (peerId) setReportPeerId(peerId);
      }
    };
    const onReceiveMessage = ({ text, fromUserId, timestamp }) => {
      if (cancelled) return;
      setMessages((prev) => [...prev, { text, fromUserId, timestamp, mine: false }]);
    };
    const onPeerLeft    = () => {
      if (cancelled) return;
      clearPendingPeerLeft();
      if (!showReportRef.current) navigate("/match?autostart=text&instant=1");
    };
    const onPeerTyping  = ({ isTyping }) => { if (!cancelled) setPeerTyping(isTyping); };
    const onSocketError = ({ message }) => {
      if (!cancelled && message?.includes("blocked")) {
        setBlockedMsg(message);
        setTimeout(() => setBlockedMsg(""), 4000);
      }
    };

    socket.on("peer-joined",     onPeerJoined);
    socket.on("receive-message", onReceiveMessage);
    socket.on("peer-left",       onPeerLeft);
    socket.on("peer-typing",     onPeerTyping);
    socket.on("error",           onSocketError);

    const pollTimer = setInterval(async () => {
      try {
        const data = await api.get(`/api/sessions/${sessionId}`, accessToken);
        if (data.data?.status === "ended") {
          clearInterval(pollTimer);
          // don't navigate if report modal is showing
          if (!cancelled && !showReportRef.current) navigate("/match?autostart=text&instant=1");
        }
      } catch {}
    }, 3000);

    socket.emit("join-room", { sessionId });

    const connTimer = setTimeout(() => { if (!cancelled) setConnected(true); }, 2000);
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    inputRef.current?.focus();

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(pollTimer);
      clearTimeout(connTimer);
      socket.off("peer-joined",     onPeerJoined);
      socket.off("receive-message", onReceiveMessage);
      socket.off("peer-left",       onPeerLeft);
      socket.off("peer-typing",     onPeerTyping);
      socket.off("error",           onSocketError);
    };
  }, [sessionId, navigate, accessToken]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const emitTyping = (isTyping) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("typing", { sessionId, isTyping });
  };

  const sendMessage = (e) => {
    e?.preventDefault();
    const text = msgInput.trim();
    if (!text) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("send-message", { sessionId, text });
    emitTyping(false);
    setMessages((prev) => [...prev, { text, mine: true, timestamp: Date.now() }]);
    setMsgInput("");
    // Don't blur+refocus — keep the input focused so mobile keyboard never dismisses
    // The form onSubmit already keeps focus on the input naturally
  };

  const handleTyping = (e) => {
    setMsgInput(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  const handleEmojiSelect = (emoji) => {
    setMsgInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const end = (reason = "completed") => {
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: reason }, accessToken).catch(() => {});
    navigate(reason === "skipped" ? "/match?autostart=text&instant=1" : "/ended");
  };

  const blockPeer = () => {
    // Step 1: immediately disconnect
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: "skipped" }, accessToken).catch(() => {});
    // Step 2: show report reason modal
    setShowReport(true);
  };

  const submitReport = async (reason) => {
    if (reportPeerId) {
      await api.post(`/api/users/block/${reportPeerId}`, { reason }, accessToken).catch(() => {});
    }
    setShowReport(false);
    navigate("/match?autostart=text&instant=1");
  };

  const skipReport = () => {
    setShowReport(false);
    navigate("/match?autostart=text&instant=1");
  };

  return (
    <div className={`chat-page${showEmoji ? " emoji-open" : ""}`}>
      {showReport && (
        <ReportModal onSubmit={submitReport} onSkip={skipReport} />
      )}
      <div className="chat-page-bg" />

      <header className="chat-page-header">
        <div className="logo-wrap">
          <img src="/android-chrome-192x192.png" alt="Chattrix" className="logo-img" />
          <span className="logo">Chattrix</span>
        </div>
        <div className="chat-page-status">
          <span className={`status-dot ${connected ? "online" : "waiting"}`} />
          <span>{connected ? `Connected · ${fmt(duration)}` : "Waiting..."}</span>
        </div>
        <div className="chat-page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => end("skipped")}>
            <Icon name="skipForward" size={14} /> Skip
          </button>
          <button className="btn btn-ghost btn-sm" onClick={blockPeer} disabled={!connected}>
            <Icon name="ban" size={14} /> Block
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => end("completed")}>
            <Icon name="endCall" size={14} /> End
          </button>
        </div>
      </header>

      <div
        className="chat-page-messages"
        ref={messagesRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        {!connected && (
          <div className="chat-page-waiting fade-up">
            <div className="pulse-wrapper">
              <div className="pulse-ring" />
              <div className="pulse-ring delay" />
              <div className="pulse-dot" />
            </div>
            <p>Finding your chat partner...</p>
          </div>
        )}

        {connected && messages.length === 0 && (
          <div className="chat-page-empty fade-up">
            <span>👋</span>
            <p>You're connected! Say something.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-page-msg ${m.mine ? "mine" : "theirs"}`}>
            <div className="chat-page-bubble">{m.text}</div>
          </div>
        ))}

        {peerTyping && (
          <div className="chat-page-msg theirs">
            <div className="chat-page-bubble typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={chatEndRef} style={{ height: 0 }} />
      </div>

      <form className="chat-page-input-row" onSubmit={sendMessage} ref={inputRowRef} action="#">
        {blockedMsg && <div className="chat-blocked-msg">🚫 {blockedMsg}</div>}
        <div className="emoji-btn-wrap">
          <button
            type="button"
            className="emoji-toggle-btn"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={!connected}
            title="Emoji"
          >
            <Icon name="smile" size={22} color="var(--muted)" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        <input
          ref={inputRef}
          className="input chat-page-input"
          placeholder={connected ? "Type a message..." : "Waiting to connect..."}
          value={msgInput}
          onChange={handleTyping}
          disabled={!connected}
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-page-send"
          disabled={!connected || !msgInput.trim()}
        >
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
