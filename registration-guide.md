# 🔧 Registration Guide — All Free, No Credit Card (except AWS)

---

## 1. Upstash Redis (Socket.IO scaling + BullMQ queues)

**Register:** https://console.upstash.com — **No CC required**

1. Click **Sign Up** → use GitHub or Google
2. Click **Create Database**
3. Region: **ap-south-1** (Mumbai — closest to India)
4. Type: **Regional**
5. Plan: **Free** (10K commands/day, 256MB)
6. Copy the **Redis URL** (starts with `redis://` or `rediss://`)
7. Paste into your `.env`:

```
UPSTASH_REDIS_URL=redis://default:xxxx@your-region.upstash.io:6379
```

---

## 2. TURN Server (Video Relay) — Metered.ca

**Already configured** — no new registration needed. **No CC required.**

- Free tier: **500 MB/month** TURN relay bandwidth
- ~85–90% of video calls connect via **STUN (free, unlimited)** — TURN is only used as a fallback for users behind strict NATs (mobile carriers, corporate firewalls)
- 500 MB ≈ **~14 TURN-relayed video calls/month** (each ~35 MB)
- **Text chat is unaffected** — it uses WebSocket, not WebRTC

**If you need more later:** Metered paid plan is $5/month for 10 GB.

---

## 3. MongoDB Atlas M0 — Already Configured

**No changes needed. No CC required.**

| Resource | M0 Limit | Your Usage (~300 users) |
|----------|----------|------------------------|
| Storage | 512 MB | ~50–100 MB |
| Connections | 100 max | ~20–40 (with pooling) |

---

## 4. AWS Account Setup (Rekognition + S3) — ⚠️ CC Required

> AWS requires a credit card at signup but **will NOT charge you** within free tier limits.
> You can set `MODERATION_ENABLED=false` and `RECORDING_ENABLED=false` to skip AWS entirely.

### Step 1 — Create AWS Account

1. Go to https://aws.amazon.com → **Create an AWS Account**
2. Enter email, password, account name (e.g. `Chattrix`)
3. Choose **Personal** account type
4. Enter credit card (required but won't be charged for free tier)
5. Phone verification → enter OTP
6. Select **Basic Support (Free)**
7. Sign in at https://console.aws.amazon.com

### Step 2 — Create IAM User (never use root account)

1. AWS Console → search **IAM** → click it
2. Left sidebar → **Users** → **Create user**
3. Username: `chattrix-app`
4. Click **Next** → select **Attach policies directly**
5. Search and check:
   - ✅ `AmazonRekognitionReadOnlyAccess` (for video moderation)
   - ✅ `AmazonS3FullAccess` (for recording storage)
6. Click **Next** → **Create user**
7. Click on user `chattrix-app` → **Security credentials** tab
8. Scroll to **Access keys** → **Create access key**
9. Use case: **Application running outside AWS**
10. **COPY BOTH KEYS NOW** — you won't see the secret again:
    - Access key ID: `AKIAIOSFODNN7EXAMPLE`
    - Secret access key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

### Step 3 — Rekognition (No extra setup)

Rekognition is serverless — no setup needed. The IAM credentials with `AmazonRekognitionReadOnlyAccess` are enough. It works immediately.

Recommended region: **ap-south-1 (Mumbai)** — lowest latency from India.

### Step 4 — Create S3 Bucket (for recordings)

1. AWS Console → search **S3** → click it
2. **Create bucket**
3. Bucket name: `chattrix-recordings-xxxxx` (must be globally unique)
4. Region: **Asia Pacific (Mumbai) ap-south-1**
5. Uncheck "Block all public access" → check the acknowledgment
6. Click **Create bucket**
7. Click your bucket → **Permissions** → **CORS** → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://chattrix-ochre.vercel.app"],
    "ExposeHeaders": []
  }
]
```

---

## 5. Understanding the Two Sets of AWS Keys

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAME IAM USER (chattrix-app)                 │
│                    SAME access key + secret key                 │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   AWS_ACCESS_KEY_ID  │    │  RECORDING_S3_ACCESS_KEY_ID  │   │
│  │   AWS_SECRET_...     │    │  RECORDING_S3_SECRET_...     │   │
│  │   AWS_REGION         │    │  RECORDING_S3_REGION         │   │
│  │                      │    │  RECORDING_S3_BUCKET         │   │
│  │  Used by:            │    │                              │   │
│  │  → Rekognition ONLY  │    │  Used by:                    │   │
│  │    (image moderation) │    │  → S3 ONLY (file storage)   │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                 │
│  WHY SEPARATE?                                                  │
│  → If you use IDrive E2 / MinIO instead of AWS S3,              │
│    RECORDING_S3_* keys will be DIFFERENT from AWS_* keys.       │
│  → If using AWS for both, use the SAME key in both places.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Enable/Disable Toggles in .env

| Feature | Env Var | `true` | `false` |
|---------|---------|--------|---------|
| **Video moderation** | `MODERATION_ENABLED` | Rekognition scans video frames | No scanning, no AWS calls |
| **Call recording** | `RECORDING_ENABLED` | Calls are recorded + stored in S3 | All recording endpoints return 503 |

**Start with both disabled if you don't have AWS yet:**
```
MODERATION_ENABLED=false
RECORDING_ENABLED=false
```

**Enable later when ready:**
```
MODERATION_ENABLED=true
RECORDING_ENABLED=true
```

---

## 7. Full .env for Render (add these to your existing vars)

```
# ── AWS Rekognition (video moderation) ───────────────────
MODERATION_ENABLED=false
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-iam-access-key
AWS_SECRET_ACCESS_KEY=your-iam-secret-key
MODERATION_CONFIDENCE_THRESHOLD=80
MODERATION_FRAME_INTERVAL_MS=30000

# ── Call Recording (S3 storage) ──────────────────────────
RECORDING_ENABLED=false
RECORDING_PROVIDER=aws_s3
RECORDING_S3_BUCKET=chattrix-recordings-xxxxx
RECORDING_S3_REGION=ap-south-1
RECORDING_S3_ACCESS_KEY_ID=your-iam-access-key
RECORDING_S3_SECRET_ACCESS_KEY=your-iam-secret-key
RECORDING_S3_ENDPOINT=
RECORDING_S3_FORCE_PATH_STYLE=false
RECORDING_PUBLIC_BASE_URL=
RECORDING_UPLOAD_EXPIRES_SECONDS=900

# ── Upstash Redis ────────────────────────────────────────
UPSTASH_REDIS_URL=redis://default:xxxx@your-region.upstash.io:6379
```

---

## 8. AWS Free Tier Limits (won't be charged for small usage)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Rekognition | 5,000 images/month free for 12 months | $0.001/image (₹0.08) |
| S3 Storage | 5 GB free for 12 months | $0.023/GB/month (₹1.9/GB) |
| S3 Requests | 20,000 GET + 2,000 PUT free | Very cheap |

For early launch with ~100 users/day → **₹0 cost**, well within free tier.

---

## 9. Security Notes

- ❌ **Never** commit AWS keys to GitHub
- ✅ Keys go **only** in Render environment variables
- ✅ IAM user has minimum permissions (Rekognition read + S3 only)
- 🚨 If keys are ever exposed → AWS Console → IAM → user → Security credentials → **Deactivate immediately**

---

## Capacity Summary

| Mode | Simultaneous | Monthly Ceiling |
|------|-------------|-----------------|
| **Text only** | **400–500** | Upstash 10K cmd/day |
| **Video (STUN — 85–90%)** | **150–200** | Unlimited |
| **Video (TURN — 10–15%)** | Depends | Metered 500 MB/month (~14 calls) |
| **Moderated video** | — | 5K frames/month (~83 hours) |
| **Recorded video** | — | 5 GB S3 storage (12 months free) |
