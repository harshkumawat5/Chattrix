import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, getPendingPeerLeft, clearPendingPeerLeft, getPendingPeerJoined, clearPendingPeerJoined } from "../lib/socket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import Icon from "../components/Icon";
import EmojiPicker from "../components/EmojiPicker";
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
  const peerUserIdRef = useRef(null);
  const recordingRef = useRef(null);
  const recordingUploadingRef = useRef(false);
  const connectedRef = useRef(false);
  const onPeerJoinedRef = useRef(null); // store handler ref for replay

  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [connQuality, setConnQuality] = useState(null);
  const [showEmoji,   setShowEmoji]   = useState(false);

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnread(0);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

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
    if (recordingRef.current || recordingUploadingRef.current) return;
    if (typeof MediaRecorder === "undefined") return;

    const localStream = streamRef.current;
    const remoteStream = remoteStreamRef.current;
    if (!localStream || !remoteStream) return;

    const localUserId = String(user?._id || "");
    const peerUserId = String(peerUserIdRef.current || "");
    if (localUserId && peerUserId && localUserId > peerUserId) return;

    const recordingStream = new MediaStream();
    const localAudioTracks = localStream.getAudioTracks();
    const remoteAudioTracks = remoteStream.getAudioTracks();
    const hasAnyVideo = localStream.getVideoTracks().length > 0 || remoteStream.getVideoTracks().length > 0;

    let audioContext = null;
    if (localAudioTracks.length || remoteAudioTracks.length) {
      try {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        if (localAudioTracks.length) {
          const source = audioContext.createMediaStreamSource(new MediaStream(localAudioTracks));
          source.connect(destination);
        }
        if (remoteAudioTracks.length) {
          const source = audioContext.createMediaStreamSource(new MediaStream(remoteAudioTracks));
          source.connect(destination);
        }

        destination.stream.getAudioTracks().forEach((track) => recordingStream.addTrack(track));
      } catch {
        audioContext = null;
      }
    }

    let canvasStream = null;
    let drawIntervalId = null;
    if (hasAnyVideo && localRef.current && remoteRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const render = () => {
          const width = canvas.width;
          const height = canvas.height;
          const remoteVideo = remoteRef.current;
          const localVideo = localRef.current;

          ctx.fillStyle = "#0b0d12";
          ctx.fillRect(0, 0, width, height);

          if (remoteVideo && remoteVideo.readyState >= 2) {
            ctx.drawImage(remoteVideo, 0, 0, width, height);
          }

          if (localVideo && localVideo.readyState >= 2) {
            const insetWidth = Math.floor(width * 0.28);
            const insetHeight = Math.floor(height * 0.28);
            const margin = 24;
            const x = width - insetWidth - margin;
            const y = height - insetHeight - margin;
            ctx.drawImage(localVideo, x, y, insetWidth, insetHeight);
          }

        };

        render();
        drawIntervalId = setInterval(render, 1000 / 24);
        canvasStream = canvas.captureStream(24);
        const [videoTrack] = canvasStream.getVideoTracks();
        if (videoTrack) recordingStream.addTrack(videoTrack);
      }
    }

    if (!recordingStream.getTracks().length) {
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      return;
    }

    const hasVideoTrack = recordingStream.getVideoTracks().length > 0;
    const candidates = hasVideoTrack
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/webm;codecs=opus", "audio/webm"];
    const supportedMime = candidates.find(
      (mime) =>
        typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(mime)
    );

    let recorder;
    try {
      recorder = supportedMime
        ? new MediaRecorder(recordingStream, { mimeType: supportedMime })
        : new MediaRecorder(recordingStream);
    } catch {
      recorder = new MediaRecorder(recordingStream);
    }

    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.start(1000);

    recordingRef.current = {
      mediaRecorder: recorder,
      recordingStream,
      canvasStream,
      audioContext,
      drawIntervalId,
      chunks,
      startedAt: new Date(),
      mimeType: recorder.mimeType || supportedMime || (hasVideoTrack ? "video/webm" : "audio/webm"),
      stopping: false,
    };
  }, [user?._id]);

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
      console.error("Recording upload failed:", error);
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

      // #7 — reconnect on ICE failure
      pc.oniceconnectionstatechange = () => {
        if (cancelled) return;
        const state = pc.iceConnectionState;
        if (state === "disconnected" || state === "failed") {
          setConnected(false);
          setConnQuality(null);
          // attempt restart after 2s
          setTimeout(async () => {
            if (cancelled || !pcRef.current) return;
            try {
              offeredRef.current = false;
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              socket.emit("offer", { sessionId, offer });
            } catch (error) {
              void error;
            }
          }, 2000);
        }
        if (state === "connected" || state === "completed") {
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
      navigate("/match?autostart=video&instant=1");
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

    socket.on("ice-config", onIceConfig);
    socket.on("peer-joined", onPeerJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("peer-left", onPeerLeft);
    socket.on("receive-message", onReceiveMessage);
    socket.on("peer-typing", onPeerTyping);

    const pollTimer = setInterval(async () => {
      try {
        const data = await api.get(`/api/sessions/${sessionId}`, accessToken);
        if (data.data?.status === "ended") {
          clearInterval(pollTimer);
          void stopRecordingAndUpload();
          exited = true;
          if (!cancelled) navigate("/match?autostart=video&instant=1");
        }
      } catch (error) {
        void error;
      }
    }, 3000);

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
      const iceServers = socket.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
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

  const blockPeer = async () => {
    if (!peerUserIdRef.current) return;
    await api.post(`/api/users/block/${peerUserIdRef.current}`, null, accessToken).catch(() => {});
    end("completed");
  };

  const qualityColor = { good: "var(--green)", fair: "var(--orange)", poor: "var(--red)" };
  const qualityLabel = { good: "Good", fair: "Fair", poor: "Poor" };

  return (
    <div className={"call-page" + (chatOpen ? " chat-open" : "")}>
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
      <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
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
        <form className="chat-input-row" onSubmit={sendMessage}>
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
          <button type="submit" className="chat-send">
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

          <button className={`ctrl-btn ${camOff ? "active" : ""}`}
            onClick={() => { streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; }); setCamOff((v) => !v); }}>
            <div className="ctrl-btn-circle"><Icon name={camOff ? "videoOff" : "video"} size={22} /></div>
            <span className="ctrl-btn-label">{camOff ? "Cam On" : "Cam Off"}</span>
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
