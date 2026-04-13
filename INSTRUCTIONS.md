# 📋 Chattrix — Contributor Instructions

> **This file must be read before making any changes to this codebase.**
> Applies to: AI agents, developers, contributors.

---

## 🔴 Before You Touch Any Code

### Step 1 — Read README.md first

The [`README.md`](./README.md) is the single source of truth for this project. It contains:

- All **database schemas** with exact field names, types, enums, and defaults
- All **API endpoints** with methods, bodies, and responses
- All **socket events** (client→server and server→client) with payloads
- All **frontend routes** and guard rules
- All **navigation rules** (what navigates where and when)
- **Zustand store** shape and persistence behavior
- **Socket client** singleton rules and cached events

**If a field name, enum value, or endpoint is not in README.md — it does not exist.**

---

### Step 2 — Check the LLD diagrams

| Diagram | What it shows |
|---------|---------------|
| [`docs/lld_backend.uml`](./docs/lld_backend.uml) | Full backend flow — auth, matching, socket, jobs, rate limits |
| [`docs/lld_frontend.uml`](./docs/lld_frontend.uml) | Full frontend flow — pages, state, WebRTC, chat, navigation |

Rendered PNGs are in [`docs/lld_backend.png`](./docs/lld_backend.png) and [`docs/lld_frontend.png`](./docs/lld_frontend.png).

---

## 🟡 Critical Rules — Do Not Break These

### Backend

| Rule | Why |
|------|-----|
| `mode` enum is `"video"` or `"text"` only — **audio was removed** | MatchRequest and ChatSession both enforce this |
| `req.user._id` comes from JWT middleware — **never trust userId from request body** | All protected controllers use `req.user._id` |
| All env values read from `process.env` — **nothing hardcoded** | Rate limits, TTLs, STUN servers, JWT secrets all in `.env` |
| `UserPreference` is created via **upsert** on register — not `create()` | Prevents duplicate key errors on retry |
| `MatchRequest` has a **unique partial index** on `user+status=searching` | One active search per user at a time |
| Mongoose 9.x `pre("validate")` hooks use **`throw`** not `next()` | `next` is not a function in Mongoose 9 |
| `User.expiresAt` is extended on **every authenticated request** via `auth.middleware.js` | Keep-alive — 15 min idle = session expires |
| `username` is **permanent** for the session — cannot be changed | It is the identity for that session |

### Frontend

| Rule | Why |
|------|-----|
| `socket.js` is a **singleton** — `connectSocket()` returns existing if alive | Never replace a connected socket |
| `pendingMatchFound` and `pendingPeerLeft` are **cached at socket.js level** | Survive React StrictMode double-invoke |
| All socket handlers use **named function references** for `socket.off()` | `socket.off("event")` without ref removes ALL listeners |
| `cancelled` flag in `useEffect` prevents **stale async callbacks** | Set to `true` in cleanup, checked before every state update |
| WebRTC offerer is determined by **`myUserId < otherId`** (lexicographic) | Deterministic — prevents both peers creating offers |
| ICE candidates are **queued** until `remoteDescription` is set | Prevents `addIceCandidate` errors |
| On **401** — `clearAuth()` + redirect `/` | No refresh token — session expired, user must re-enter username |
| `main.jsx` checks JWT expiry on load — clears stale tokens | Prevents using expired token from localStorage |

---

## 🟢 When You Make Changes

### If you add/modify a backend model field:

1. Update the schema in `apps/server/src/models/`
2. Update the **Schema Reference** table in `README.md`
3. Update `docs/lld_backend.uml` if the field affects flow
4. Regenerate PNG: `plantuml docs/lld_backend.uml`

### If you add/modify an API endpoint:

1. Add controller logic in `apps/server/src/controllers/`
2. Add route in `apps/server/src/routes/`
3. Update the **API Reference** table in `README.md`
4. Update `docs/lld_backend.uml` quick reference section

### If you add/modify a socket event:

1. Add handler in `apps/server/src/socket/handlers/`
2. Update **Socket Events** tables in `README.md` (both client→server and server→client)
3. Update `docs/lld_backend.uml` and `docs/lld_frontend.uml`

### If you add/modify a frontend page or route:

1. Add page in `apps/client/src/pages/`
2. Register route in `apps/client/src/App.jsx`
3. Update **Routes & Guards** table in `README.md`
4. Update `docs/lld_frontend.uml`
5. Regenerate PNG: `plantuml docs/lld_frontend.uml`

### If you add/modify navigation logic:

1. Update the **Navigation Rules** table in `README.md`
2. Update `docs/lld_frontend.uml`

---

## 📁 Project Structure

```
Chattrix/
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── config/         ← db.js
│   │       ├── controllers/    ← business logic
│   │       ├── jobs/           ← matchExpiry.job.js
│   │       ├── middlewares/    ← auth, rateLimiter
│   │       ├── models/         ← Mongoose schemas
│   │       ├── routes/         ← Express routers
│   │       ├── socket/         ← Socket.io handlers + registry
│   │       ├── utils/          ← geoip.js, jwt.js
│   │       ├── app.js
│   │       └── server.js
│   └── client/
│       └── src/
│           ├── lib/            ← api.js, socket.js
│           ├── pages/          ← React pages + CSS
│           ├── store/          ← Zustand auth store
│           ├── App.jsx         ← router
│           └── main.jsx        ← entry point
├── docs/
│   ├── lld_backend.uml / .png
│   └── lld_frontend.uml / .png
├── INSTRUCTIONS.md             ← you are here
├── README.md                   ← source of truth
└── package.json
```

---

## 🔧 Running the App

```bash
# Start MongoDB
brew services start mongodb/brew/mongodb-community

# Run both server + client
cd Chattrix
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3000 |
| Health | http://localhost:3000/health |

---

## 📝 Regenerating Diagrams

After updating any `.uml` file:

```bash
plantuml docs/lld_backend.uml
plantuml docs/lld_frontend.uml
```

Commit both the `.uml` source and the `.png` output together.

---

## ⚠️ Known Limitations (Do Not Implement Without Discussion)

| Limitation | Notes |
|------------|-------|
| Socket registry is process-bound | Needs Redis adapter for multi-instance deployment |
| No TURN server | ~15% of users behind strict NAT can't connect via STUN only |
| IP geolocation on localhost = `[0,0]` | All local dev users match regardless of distance |
| Recordings not implemented | Model + API exists, but no MediaRecorder or cloud storage yet |
| Face detection not implemented | Planned future feature |
| No email verification | Anyone can register with any email |
