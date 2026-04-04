import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, getPendingPeerLeft, clearPendingPeerLeft } from "../lib/socket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import "./Call.css";

export default function Call() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { accessToken, user } = useAuthStore();

  const localRef   = useRef(null);
  const remoteRef  = useRef(null);
  const pcRef      = useRef(null);
  const streamRef  = useRef(null);
  const queueRef   = useRef([]);
  const offeredRef = useRef(false);
  const chatEndRef = useRef(null);

  const [connected,  setConnected]  = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [camOff,     setCamOff]     = useState(false);
  const [duration,   setDuration]   = useState(0);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [msgInput,   setMsgInput]   = useState("");
  const [unread,     setUnread]     = useState(0);

  // scroll chat to bottom on new message
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnread(0);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigate("/match"); return; }

    if (getPendingPeerLeft()) {
      clearPendingPeerLeft();
      navigate("/ended");
      return;
    }

    let cancelled = false;

    const drainQueue = async (pc) => {
      for (const c of queueRef.current) {
        try { await pc.addIceCandidate(c); } catch {}
      }
      queueRef.current = [];
    };

    const onPeerJoined = async ({ userId: otherId }) => {
      if (cancelled || offeredRef.current) return;
      const iAmOfferer = (user?._id ?? "") < otherId;
      if (!iAmOfferer) return;
      offeredRef.current = true;
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== "stable") return;
      const offer = await pc.createOffer();
      if (cancelled) return;
      await pc.setLocalDescription(offer);
      socket.emit("offer", { sessionId, offer });
    };

    const onOffer = async ({ offer }) => {
      if (cancelled) return;
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== "stable") return;
      await pc.setRemoteDescription(offer);
      await drainQueue(pc);
      const answer = await pc.createAnswer();
      if (cancelled) return;
      await pc.setLocalDescription(answer);
      socket.emit("answer", { sessionId, answer });
    };

    const onAnswer = async ({ answer }) => {
      if (cancelled) return;
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(answer);
      await drainQueue(pc);
    };

    const onIceCandidate = async ({ candidate }) => {
      if (cancelled) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) { queueRef.current.push(candidate); return; }
      try { await pc.addIceCandidate(candidate); } catch {}
    };

    const onIceConfig = (cfg) => { socket.iceServers = cfg.iceServers; };

    const onPeerLeft = () => {
      if (cancelled) return;
      clearPendingPeerLeft();
      if (remoteRef.current) remoteRef.current.srcObject = null;
      navigate("/match?autostart=video");
    };

    const onReceiveMessage = ({ text, fromUserId, timestamp }) => {
      if (cancelled) return;
      setMessages((prev) => [...prev, { text, fromUserId, timestamp, mine: false }]);
      setUnread((n) => n + 1);
    };

    socket.on("ice-config",       onIceConfig);
    socket.on("peer-joined",      onPeerJoined);
    socket.on("offer",            onOffer);
    socket.on("answer",           onAnswer);
    socket.on("ice-candidate",    onIceCandidate);
    socket.on("peer-left",        onPeerLeft);
    socket.on("receive-message",  onReceiveMessage);

    const pollTimer = setInterval(async () => {
      try {
        const data = await api.get(`/api/sessions/${sessionId}`, accessToken);
        if (data.data?.status === "ended") {
          clearInterval(pollTimer);
          if (!cancelled) navigate("/match?autostart=video");
        }
      } catch {}
    }, 3000);

    const start = async () => {
      const iceServers = socket.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (cancelled) return;
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        setConnected(true);
      };

      pc.onicecandidate = (e) => {
        if (cancelled || !e.candidate) return;
        socket.emit("ice-candidate", { sessionId, candidate: e.candidate });
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        pc.close();
        return;
      }

      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      socket.emit("join-room", { sessionId });
    };

    start();

    const timer = setInterval(() => setDuration((d) => d + 1), 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(pollTimer);
      offeredRef.current = false;
      queueRef.current = [];
      socket.off("ice-config",      onIceConfig);
      socket.off("peer-joined",     onPeerJoined);
      socket.off("offer",           onOffer);
      socket.off("answer",          onAnswer);
      socket.off("ice-candidate",   onIceCandidate);
      socket.off("peer-left",       onPeerLeft);
      socket.off("receive-message", onReceiveMessage);
      pcRef.current?.close();
      pcRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [sessionId, navigate, user, accessToken]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const end = (reason = "completed") => {
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: reason }, accessToken).catch(() => {});
    // skip → auto-search next match, end → show ended screen
    navigate(reason === "skipped" ? "/match?autostart=video" : "/ended");
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("send-message", { sessionId, text });
    setMessages((prev) => [...prev, { text, fromUserId: user?._id, timestamp: Date.now(), mine: true }]);
    setMsgInput("");
  };

  const toggleChat = () => {
    setChatOpen((v) => !v);
    if (!chatOpen) setUnread(0);
  };

  return (
    <div className="call-page">
      {/* remote video — fullscreen bg */}
      <div className="call-remote">
        <video ref={remoteRef} autoPlay playsInline className="call-video" />
        {!connected && (
          <div className="call-waiting">
            <div className="pulse-dot" style={{ width: 56, height: 56 }} />
            <p>Connecting...</p>
          </div>
        )}
      </div>

      {/* local video PiP */}
      <div className={`call-local-wrap ${chatOpen ? "chat-open" : ""}`}>
        <video ref={localRef} autoPlay playsInline muted className="call-local" />
      </div>

      {/* chat panel */}
      <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
        <div className="chat-header">
          <span>💬 Chat</span>
          <button className="chat-close" onClick={toggleChat}>✕</button>
        </div>
        <div className="chat-messages">
          {messages.length === 0 && (
            <p className="chat-empty">Say hi 👋</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>
              <span className="chat-bubble">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input-row" onSubmit={sendMessage}>
          <input
            className="chat-input"
            placeholder="Type a message..."
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="chat-send">↑</button>
        </form>
      </div>

      {/* HUD */}
      <div className="call-hud">
        <div className="call-timer">{fmt(duration)}</div>
        <div className="call-controls">
          <button
            className={`ctrl-btn ${muted ? "active" : ""}`}
            onClick={() => {
              streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
              setMuted((v) => !v);
            }}
          >
            {muted ? "🔇" : "🎙"}
          </button>
          <button
            className={`ctrl-btn ${camOff ? "active" : ""}`}
            onClick={() => {
              streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
              setCamOff((v) => !v);
            }}
          >
            {camOff ? "📷" : "📹"}
          </button>
          <button className="ctrl-btn chat-btn" onClick={toggleChat}>
            💬
            {unread > 0 && !chatOpen && <span className="unread-badge">{unread}</span>}
          </button>
          <button className="ctrl-btn skip" onClick={() => end("skipped")}>⏭</button>
          <button className="ctrl-btn end"  onClick={() => end("completed")}>📵</button>
        </div>
      </div>
    </div>
  );
}
