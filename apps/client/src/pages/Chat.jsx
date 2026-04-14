import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, getPendingPeerLeft, clearPendingPeerLeft } from "../lib/socket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import Icon from "../components/Icon";
import "./Chat.css";

export default function Chat() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { accessToken, user } = useAuthStore();

  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  const [messages,  setMessages]  = useState([]);
  const [msgInput,  setMsgInput]  = useState("");
  const [connected, setConnected] = useState(false);
  const [duration,  setDuration]  = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef(null);
  const peerUserIdRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigate("/match"); return; }

    if (getPendingPeerLeft()) {
      clearPendingPeerLeft();
      navigate("/ended");
      return;
    }

    let cancelled = false;

    const onPeerJoined = () => {
      if (!cancelled) setConnected(true);
    };

    const onReceiveMessage = ({ text, fromUserId, timestamp }) => {
      if (cancelled) return;
      setMessages((prev) => [...prev, { text, fromUserId, timestamp, mine: false }]);
    };

    const onPeerLeft = () => {
      if (cancelled) return;
      clearPendingPeerLeft();
      navigate("/match?autostart=text");
    };

    const onPeerTyping = ({ isTyping }) => {
      if (!cancelled) setPeerTyping(isTyping);
    };

    socket.on("peer-joined",     onPeerJoined);
    socket.on("receive-message", onReceiveMessage);
    socket.on("peer-left",       onPeerLeft);
    socket.on("peer-typing",     onPeerTyping);

    const pollTimer = setInterval(async () => {
      try {
        const data = await api.get(`/api/sessions/${sessionId}`, accessToken);
        if (data.data?.status === "ended") {
          clearInterval(pollTimer);
          if (!cancelled) navigate("/match?autostart=text");
        }
      } catch {}
    }, 3000);

    socket.emit("join-room", { sessionId });

    // fallback: if we joined second, peer-joined fires on the other peer
    // mark connected after 2s so we can start typing
    const connTimer = setTimeout(() => {
      if (!cancelled) setConnected(true);
    }, 2000);

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
    };
  }, [sessionId, navigate, accessToken]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const sendMessage = (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("send-message", { sessionId, text });
    socket.emit("typing", { sessionId, isTyping: false });
    setMessages((prev) => [...prev, { text, mine: true, timestamp: Date.now() }]);
    setMsgInput("");
  };

  const handleTyping = (e) => {
    setMsgInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;
    socket.emit("typing", { sessionId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing", { sessionId, isTyping: false });
    }, 1500);
  };

  const end = (reason = "completed") => {
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: reason }, accessToken).catch(() => {});
    navigate(reason === "skipped" ? "/match?autostart=text" : "/ended");
  };

  return (
    <div className="chat-page">
      <div className="chat-page-bg" />

      <header className="chat-page-header">
        <div className="logo-wrap">
          <img src="/android-chrome-192x192.png" alt="Chattrix" className="logo-img" />
          <span className="logo">Chattrix</span>
        </div>
        <div className="chat-page-status">
          <span className={`status-dot ${connected ? "online" : "waiting"}`} />
          <span>{connected ? `Connected · ${fmt(duration)}` : "Waiting for stranger..."}</span>
        </div>
        <div className="chat-page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => end("skipped")}><Icon name="skipForward" size={16} /> Skip</button>
          <button className="btn btn-danger btn-sm" onClick={() => end("completed")}><Icon name="phoneOff" size={16} /> End</button>
        </div>
      </header>

      <div className="chat-page-messages">
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
        <div ref={chatEndRef} />
      </div>

      <form className="chat-page-input-row" onSubmit={sendMessage}>
        <input
          ref={inputRef}
          className="input chat-page-input"
          placeholder={connected ? "Type a message..." : "Waiting to connect..."}
          value={msgInput}
          onChange={(e) => handleTyping(e)}
          disabled={!connected}
          autoComplete="off"
        />
        <button type="submit" className="chat-page-send" disabled={!connected || !msgInput.trim()}>
          <Icon name="chevronUp" size={18} />
        </button>
      </form>
    </div>
  );
}
