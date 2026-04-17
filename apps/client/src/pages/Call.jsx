import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, getPendingPeerLeft, clearPendingPeerLeft, getPendingPeerJoined, clearPendingPeerJoined } from "../lib/socket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import Icon from "../components/Icon";
import EmojiPicker from "../components/EmojiPicker";
import ReportModal from "../components/ReportModal";
import "./Call.css";

export default function Call() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();

  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const queueRef = useRef([]);
  const offeredRef = useRef(false);
  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);
  const callInputRowRef = useRef(null);
  const peerUserIdRef = useRef(null);
  const recordingRef = useRef(null);
  const recordingUploadingRef = useRef(false);
  const connectedRef = useRef(false);
  const onPeerJoinedRef = useRef(null); // store handler ref for replay

  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [connQuality, setConnQuality] = useState(null);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [blockedMsg,  setBlockedMsg]  = useState("");
  const [showReport,  setShowReport]  = useState(false);
  const showReportRef = useRef(false);
  const moderationTimer = useRef(null);

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnread(0);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    showReportRef.current = showReport;
  }, [showReport]);

  // ── Frame moderation — capture remote video frame every N seconds ──
  const captureAndCheckFrame = useCallback(async () => {
    const video = remoteRef.current;
    const peerId = peerUserIdRef.current;
    if (!video || !peerId || !sessionId || !accessToken) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d").drawImage(video, 0, 0, 320, 240);
      const frameBase64 = canvas.toDataURL("image/jpeg", 0.7);
      await api.post("/api/moderation/check-frame", {
        frameBase64,
        sessionId,
        reportedUserId: peerId,
      }, accessToken);
    } catch { /* fail silently — never disrupt the call */ }
  }, [sessionId, accessToken]);

  useEffect(() => {
    if (!connected) return;
    const intervalMs = Number(import.meta.env.VITE_MODERATION_INTERVAL_MS) || 30000;
    moderationTimer.current = setInterval(captureAndCheckFrame, intervalMs);
    return () => clearInterval(moderationTimer.current);
  }, [connected, captureAndCheckFrame]);

  const cleanupRecordingState = useCallback((state) => {
    if (!state) return;

    if (state.drawIntervalId) clearInterval(state.drawIntervalId);

    state.canvasStream?.getTracks().forEach((track) => track.stop());
    state.recordingStream?.getTracks().forEach((track) => track.stop());

    if (state.audioContext && state.audioContext.state !== "closed") {
      state.audioContext.close().catch(() => {});
    }
  }, []);

  const startRecordingIfNeeded = useCallback(() => {
    // Recording is disabled — no tab indicator, upload endpoint not yet active
    return;
  }, []);

  const stopRecordingAndUpload = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording || activeRecording.stopping) return;

    activeRecording.stopping = true;
    recordingRef.current = null;

    const stopPromise = new Promise((resolve) => {
      activeRecording.mediaRecorder.addEventListener("stop", resolve, { once: true });
    });

    if (activeRecording.mediaRecorder.state !== "inactive") {
      try {
        activeRecording.mediaRecorder.stop();
      } catch (error) {
        void error;
      }
      await stopPromise.catch(() => {});
    }

    const endedAt = new Date();
    const startedAt = activeRecording.startedAt || endedAt;
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
    );
    const mimeType = activeRecording.mimeType || "video/webm";
    const blob = new Blob(activeRecording.chunks, { type: mimeType });

    cleanupRecordingState(activeRecording);

    if (!blob.size || !accessToken) return;
    recordingUploadingRef.current = true;

    let presignData = null;
    try {
      const presignResponse = await api.post(
        "/api/recordings/presign",
        {
          chatSessionId: sessionId,
          mimeType,
          extension: "webm",
        },
        accessToken
      );
      presignData = presignResponse.data;

      const uploadResponse = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      await api.post(
        "/api/recordings/finalize",
        {
          chatSessionId: sessionId,
          provider: presignData.provider,
          bucketName: presignData.bucketName,
          objectKey: presignData.objectKey,
          fileUrl: presignData.fileUrl,
          region: presignData.region,
          mimeType,
          sizeBytes: blob.size,
          durationSeconds,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          status: "available",
          metadata: {
            recorderRole: "primary_peer",
            userAgent: navigator.userAgent.slice(0, 240),
          },
        },
        accessToken
      );
    } catch (error) {
      if (presignData) {
        await api
          .post(
            "/api/recordings/finalize",
            {
              chatSessionId: sessionId,
              provider: presignData.provider,
              bucketName: presignData.bucketName,
              objectKey: presignData.objectKey,
              fileUrl: presignData.fileUrl,
              region: presignData.region,
              mimeType,
              sizeBytes: blob.size,
              durationSeconds,
              startedAt: startedAt.toISOString(),
              endedAt: endedAt.toISOString(),
              status: "failed",
              uploadError: error?.message || "Upload failed",
              metadata: {
                recorderRole: "primary_peer",
              },
            },
            accessToken
          )
          .catch(() => {});
      }
      void error;
    } finally {
      recordingUploadingRef.current = false;
    }
  }, [accessToken, cleanupRecordingState, sessionId]);

  // ── connection quality via getStats ───────────────────────────
  const checkQuality = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !connected) return;
    try {
      const stats = await pc.getStats();
      let rtt = null;
      stats.forEach((s) => {
        if (s.type === "candidate-pair" && s.state === "succeeded" && s.currentRoundTripTime != null) {
          rtt = s.currentRoundTripTime * 1000; // ms
        }
      });
      if (rtt === null) return;
      if (rtt < 100) setConnQuality("good");
      else if (rtt < 300) setConnQuality("fair");
      else setConnQuality("poor");
    } catch (error) {
      void error;
    }
  }, [connected]);

  useEffect(() => {
    const t = setInterval(checkQuality, 3000);
    return () => clearInterval(t);
  }, [checkQuality]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      navigate("/match");
      return;
    }

    if (getPendingPeerLeft()) {
      clearPendingPeerLeft();
      navigate("/match?autostart=video&instant=1");
      return;
    }

    let cancelled = false;
    let exited = false;

    const exitToMatch = async (endReason = "timeout") => {
      if (cancelled || exited) return;
      exited = true;
      void stopRecordingAndUpload();
      let endedViaApi = false;
      await api
        .patch(`/api/sessions/${sessionId}/end`, { endReason }, accessToken)
        .then(() => { endedViaApi = true; })
        .catch(() => {});
      if (!endedViaApi) {
        socket.emit("leave-room");
      }
      navigate("/match?autostart=video&instant=1");
    };

    const drainQueue = async (pc) => {
      for (const c of queueRef.current) {
        try {
          await pc.addIceCandidate(c);
        } catch (error) {
          void error;
        }
      }
      queueRef.current = [];
    };

    // ── create / recreate PC (used for reconnect too) ──────────
    const createPC = (iceServers) => {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (cancelled) return;
        const [stream] = e.streams;
        if (stream) {
          remoteStreamRef.current = stream;
          if (remoteRef.current) remoteRef.current.srcObject = stream;
          startRecordingIfNeeded();
        }
        setConnected(true);
      };

      pc.onicecandidate = (e) => {
        if (cancelled || !e.candidate) return;
        socket.emit("ice-candidate", { sessionId, candidate: e.candidate });
      };

      // #7 — reconnect on ICE failure with exponential backoff
      let iceRestartAttempts = 0;
      pc.oniceconnectionstatechange = () => {
        if (cancelled) return;
        const state = pc.iceConnectionState;
        if (state === "disconnected") {
          setConnected(false);
          setConnQuality(null);
          // brief grace period — mobile network handoff can cause transient disconnect
          setTimeout(async () => {
            if (cancelled || !pcRef.current) return;
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
              try {
                iceRestartAttempts++;
                offeredRef.current = false;
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                socket.emit("offer", { sessionId, offer });
              } catch (error) {
                void error;
              }
            }
          }, Math.min(1000 * iceRestartAttempts, 5000));
        }
        if (state === "failed") {
          setConnected(false);
          setConnQuality(null);
          setTimeout(async () => {
            if (cancelled || !pcRef.current) return;
            try {
              iceRestartAttempts++;
              offeredRef.current = false;
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              socket.emit("offer", { sessionId, offer });
            } catch (error) {
              void error;
            }
          }, Math.min(1500 * iceRestartAttempts, 8000));
        }
        if (state === "connected" || state === "completed") {
          iceRestartAttempts = 0;
          setConnected(true);
        }
      };

      return pc;
    };

    const onPeerJoined = async ({ userId: otherId }) => {
      if (cancelled || offeredRef.current) return;
      peerUserIdRef.current = otherId;
      startRecordingIfNeeded();
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
    onPeerJoinedRef.current = onPeerJoined;

    const onOffer = async ({ offer }) => {
      if (cancelled) return;
      const pc = pcRef.current;
      if (!pc) return;
      // Handle offer glare: if we also sent an offer, rollback ours
      if (pc.signalingState === "have-local-offer") {
        await pc.setLocalDescription({ type: "rollback" });
      }
      if (pc.signalingState !== "stable") return;
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
      if (!pc || !pc.remoteDescription) {
        queueRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        void error;
      }
    };

    const onIceConfig = (cfg) => {
      socket.iceServers = cfg.iceServers;
    };
    const onPeerLeft = () => {
      if (cancelled) return;
      void stopRecordingAndUpload();
      clearPendingPeerLeft();
      remoteStreamRef.current = null;
      if (remoteRef.current) remoteRef.current.srcObject = null;
      // don't navigate if report modal is showing
      if (!showReportRef.current) navigate("/match?autostart=video&instant=1");
    };
    const onReceiveMessage = ({ text, fromUserId, timestamp }) => {
      if (cancelled) return;
      setMessages((prev) => [...prev, { text, fromUserId, timestamp, mine: false }]);
      setUnread((n) => n + 1);
    };

    // #5 — typing indicator
    const onPeerTyping = ({ isTyping }) => {
      if (cancelled) return;
      setPeerTyping(isTyping);
    };
    const onSocketError = ({ message }) => {
      if (!cancelled && message?.includes("blocked")) {
        setBlockedMsg(message);
        setTimeout(() => setBlockedMsg(""), 4000);
      }
    };
    const onModerationBan = ({ message }) => {
      if (cancelled) return;
      alert(message);
      navigate("/");
    };

    socket.on("ice-config", onIceConfig);
    socket.on("peer-joined", onPeerJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("peer-left", onPeerLeft);
    socket.on("receive-message", onReceiveMessage);
    socket.on("peer-typing", onPeerTyping);
    socket.on("error", onSocketError);
    socket.on("moderation-ban", onModerationBan);

    const pollTimer = setInterval(async () => {
      try {
        const data = await api.get(`/api/sessions/${sessionId}`, accessToken);
        if (data.data?.status === "ended") {
          clearInterval(pollTimer);
          void stopRecordingAndUpload();
          exited = true;
          // don't navigate if report modal is showing — user is filling reason
          if (!cancelled && !showReportRef.current) navigate("/match?autostart=video&instant=1");
        }
      } catch (error) {
        void error;
      }
    }, 1500);

    const connectTimeout = setTimeout(() => {
      const iceState = pcRef.current?.iceConnectionState;
      const isConnected =
        connectedRef.current ||
        iceState === "connected" ||
        iceState === "completed";

      if (!isConnected) {
        void exitToMatch("timeout");
      }
    }, 25000);

    const start = async () => {
      const defaultStun = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ];
      // Merge TURN servers from Metered with STUN fallbacks
      const turnServers = socket.iceServers || [];
      const iceServers = [...turnServers, ...defaultStun];
      const pc = createPC(iceServers);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (error) {
        void error;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (fallbackError) {
          void fallbackError;
          await exitToMatch("error");
          pc.close();
          return;
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        pc.close();
        return;
      }

      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      startRecordingIfNeeded();
      socket.emit("join-room", { sessionId });

      // if peer-joined fired during StrictMode first mount, replay it now
      const cached = getPendingPeerJoined();
      if (cached) {
        clearPendingPeerJoined();
        setTimeout(() => onPeerJoinedRef.current?.(cached), 100);
      }
    };

    start();
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);

    return () => {
      cancelled = true;
      exited = true;
      void stopRecordingAndUpload();
      clearInterval(timer);
      clearInterval(pollTimer);
      clearTimeout(connectTimeout);
      offeredRef.current = false;
      queueRef.current = [];
      clearPendingPeerJoined();
      socket.off("ice-config", onIceConfig);
      socket.off("peer-joined", onPeerJoined);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("peer-left", onPeerLeft);
      socket.off("receive-message", onReceiveMessage);
      socket.off("peer-typing", onPeerTyping);
      socket.off("error", onSocketError);
      socket.off("moderation-ban", onModerationBan);
      pcRef.current?.close();
      pcRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      remoteStreamRef.current = null;
    };
  }, [
    accessToken,
    navigate,
    sessionId,
    startRecordingIfNeeded,
    stopRecordingAndUpload,
    user,
  ]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const end = (reason = "completed") => {
    void stopRecordingAndUpload();
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: reason }, accessToken).catch(() => {});
    // for skip: go directly to match with autostart — no idle screen
    navigate(reason === "skipped" ? "/match?autostart=video&instant=1" : "/ended");
  };

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

  const handleEmojiSelect = (emoji) => {
    setMsgInput((prev) => prev + emoji);
  };

  const blockPeer = () => {
    // Step 1: immediately disconnect from peer
    const socket = getSocket();
    if (socket) socket.emit("leave-room");
    api.patch(`/api/sessions/${sessionId}/end`, { endReason: "skipped" }, accessToken).catch(() => {});
    // Step 2: show report reason modal
    setShowReport(true);
  };

  const submitReport = async (reason) => {
    if (peerUserIdRef.current) {
      await api.post(`/api/users/block/${peerUserIdRef.current}`, { reason }, accessToken).catch(() => {});
    }
    setShowReport(false);
    navigate("/match?autostart=video&instant=1");
  };

  const skipReport = () => {
    setShowReport(false);
    navigate("/match?autostart=video&instant=1");
  };

  const qualityColor = { good: "var(--green)", fair: "var(--orange)", poor: "var(--red)" };
  const qualityLabel = { good: "Good", fair: "Fair", poor: "Poor" };

  return (
    <div className={"call-page" + (chatOpen ? " chat-open" : "")}>
      {showReport && (
        <ReportModal onSubmit={submitReport} onSkip={skipReport} />
      )}
      <div className="call-remote">
        <video ref={remoteRef} autoPlay playsInline className="call-video" />
        {!connected && (
          <div className="call-waiting">
            <div className="pulse-dot" style={{ width: 56, height: 56 }} />
            <p>Connecting...</p>
          </div>
        )}
      </div>

      {/* connection quality badge */}
      {connected && connQuality && (
        <div className="conn-quality" style={{ color: qualityColor[connQuality] }}>
          <span className="conn-dot" style={{ background: qualityColor[connQuality] }} />
          {qualityLabel[connQuality]}
        </div>
      )}

      <div className={`call-local-wrap ${chatOpen ? "chat-open" : ""}`}>
        <video ref={localRef} autoPlay playsInline muted className="call-local" />
      </div>

      {/* chat panel */}
      <div className={`chat-panel ${chatOpen ? "open" : ""}${showEmoji ? " emoji-open" : ""}`}>
        <div className="chat-header">
          <span>💬 Chat</span>
          <button className="chat-close" onClick={() => setChatOpen(false)}>
            ✕
          </button>
        </div>
        <div className="chat-messages">
          {messages.length === 0 && <p className="chat-empty">Say hi 👋</p>}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>
              <span className="chat-bubble">{m.text}</span>
            </div>
          ))}
          {peerTyping && (
            <div className="chat-msg theirs">
              <span className="chat-bubble typing-indicator">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input-row" onSubmit={sendMessage} ref={callInputRowRef}>
          {blockedMsg && <div className="chat-blocked-msg">🚫 {blockedMsg}</div>}
          <div className="emoji-btn-wrap">
            <button
              type="button"
              className="emoji-toggle-btn"
              onClick={() => setShowEmoji((v) => !v)}
              title="Emoji"
            >
              <Icon name="smile" size={20} color="rgba(255,255,255,0.7)" />
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>
          <input
            className="chat-input"
            placeholder="Type a message..."
            value={msgInput}
            onChange={handleTyping}
            autoComplete="off"
          />
          <button type="submit" className="chat-send"
            onMouseDown={(e) => e.preventDefault()}>
            <Icon name="send" size={15} />
          </button>
        </form>
      </div>

      <div className="call-hud">
        <div className="call-timer">{fmt(duration)}</div>
        <div className="call-controls">

          <button className={`ctrl-btn ${muted ? "active" : ""}`}
            onClick={() => { streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; }); setMuted((v) => !v); }}>
            <div className="ctrl-btn-circle"><Icon name={muted ? "micOff" : "mic"} size={22} /></div>
            <span className="ctrl-btn-label">{muted ? "Unmute" : "Mute"}</span>
          </button>

          <button className="ctrl-btn chat-btn"
            onClick={() => { setChatOpen((v) => !v); setUnread(0); }}>
            <div className="ctrl-btn-circle">
              <Icon name="messageCircle" size={22} />
              {unread > 0 && !chatOpen && <span className="unread-badge">{unread}</span>}
            </div>
            <span className="ctrl-btn-label">Chat</span>
          </button>

          <button className="ctrl-btn block-btn" onClick={blockPeer}>
            <div className="ctrl-btn-circle"><Icon name="ban" size={20} /></div>
            <span className="ctrl-btn-label">Block</span>
          </button>

          <button className="ctrl-btn skip" onClick={() => end("skipped")}>
            <div className="ctrl-btn-circle"><Icon name="skipForward" size={22} /></div>
            <span className="ctrl-btn-label">Next</span>
          </button>

          <button className="ctrl-btn end" onClick={() => end("completed")}>
            <div className="ctrl-btn-circle"><Icon name="endCall" size={24} /></div>
            <span className="ctrl-btn-label">End</span>
          </button>

        </div>
      </div>
    </div>
  );
}
