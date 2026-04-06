const mongoose = require("mongoose");

const { Schema } = mongoose;

const callRecordingSchema = new Schema(
  {
    chatSession: {
      type: Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
      index: true,
    },
    ownerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    participantUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    provider: {
      type: String,
      enum: ["aws_s3", "idrive_e2", "gcp_storage", "azure_blob", "cloudflare_r2", "other"],
      required: true,
    },
    bucketName: {
      type: String,
      trim: true,
      required: true,
    },
    objectKey: {
      type: String,
      trim: true,
      required: true,
    },
    fileUrl: {
      type: String,
      trim: true,
      required: true,
    },
    region: {
      type: String,
      trim: true,
      default: null,
    },
    mimeType: {
      type: String,
      trim: true,
      default: "video/webm",
    },
    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },
    durationSeconds: {
      type: Number,
      min: 0,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["uploading", "available", "failed", "deleted"],
      default: "available",
      index: true,
    },
    uploadError: {
      type: String,
      default: null,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callRecordingSchema.index({ ownerUser: 1, createdAt: -1 });
callRecordingSchema.index({ chatSession: 1, createdAt: -1 });
callRecordingSchema.index({ provider: 1, bucketName: 1, objectKey: 1 }, { unique: true });

module.exports = mongoose.model("CallRecording", callRecordingSchema);
