const provider = process.env.RECORDING_PROVIDER || "idrive_e2";
const bucketName = process.env.RECORDING_S3_BUCKET;
const region = process.env.RECORDING_S3_REGION;
const accessKeyId = process.env.RECORDING_S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.RECORDING_S3_SECRET_ACCESS_KEY;
const rawEndpoint = (process.env.RECORDING_S3_ENDPOINT || "").trim();
const endpoint = rawEndpoint
  ? (/^https?:\/\//i.test(rawEndpoint) ? rawEndpoint : `https://${rawEndpoint}`)
  : undefined;
const forcePathStyle = String(process.env.RECORDING_S3_FORCE_PATH_STYLE || "false") === "true";
const publicBaseUrl = process.env.RECORDING_PUBLIC_BASE_URL || "";

let s3Client = null;
let awsModules = null;

const loadAwsSdk = () => {
  if (awsModules) return awsModules;

  try {
    // Lazy import so server can still boot even when recording deps are not yet installed.
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    awsModules = { S3Client, PutObjectCommand, getSignedUrl };
    return awsModules;
  } catch (error) {
    const err = new Error(
      "Recording dependencies missing. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner."
    );
    err.statusCode = 503;
    err.cause = error;
    throw err;
  }
};

const isConfigured = () =>
  Boolean(bucketName && region && accessKeyId && secretAccessKey);

const getClient = () => {
  if (s3Client) return s3Client;
  const { S3Client } = loadAwsSdk();

  s3Client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });

  return s3Client;
};

const normalizeExtension = (value) => {
  const ext = String(value || "webm").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return ext || "webm";
};

const normalizeObjectKey = (value) =>
  String(value || "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .trim();

const buildObjectKey = ({ chatSessionId, ownerUserId, extension = "webm" }) => {
  const safeExtension = normalizeExtension(extension);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = Math.random().toString(36).slice(2, 10);
  return normalizeObjectKey(`sessions/${chatSessionId}/${ownerUserId}/${stamp}-${nonce}.${safeExtension}`);
};

const buildFileUrl = (objectKey) => {
  const safeKey = normalizeObjectKey(objectKey);
  if (publicBaseUrl) {
    const trimmed = publicBaseUrl.replace(/\/+$/, "");
    return `${trimmed}/${safeKey}`;
  }
  if (endpoint) {
    const trimmed = endpoint.replace(/\/+$/, "");
    // Custom S3-compatible providers (like IDrive E2) commonly expose path-style object URLs.
    return `${trimmed}/${bucketName}/${safeKey}`;
  }
  return `https://${bucketName}.s3.${region}.amazonaws.com/${safeKey}`;
};

const getDefaultUploadExpiry = () => {
  const raw = Number(process.env.RECORDING_UPLOAD_EXPIRES_SECONDS || 900);
  if (!Number.isFinite(raw)) return 900;
  return Math.min(3600, Math.max(60, Math.floor(raw)));
};

const createPresignedUpload = async ({ objectKey, mimeType, expiresInSeconds }) => {
  if (!isConfigured()) {
    const err = new Error("Recording storage is not configured");
    err.statusCode = 503;
    throw err;
  }

  const safeKey = normalizeObjectKey(objectKey);
  const expiresIn = Number.isFinite(expiresInSeconds)
    ? Math.min(3600, Math.max(60, Math.floor(expiresInSeconds)))
    : getDefaultUploadExpiry();

  const { PutObjectCommand, getSignedUrl } = loadAwsSdk();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: safeKey,
    ContentType: mimeType || "video/webm",
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });

  return {
    provider,
    bucketName,
    region,
    objectKey: safeKey,
    fileUrl: buildFileUrl(safeKey),
    uploadUrl,
    expiresIn,
  };
};

module.exports = {
  buildObjectKey,
  createPresignedUpload,
  getDefaultUploadExpiry,
  isConfigured,
  provider,
};
