const mongoose = require("mongoose");

const { Schema } = mongoose;

const chatSessionSchema = new Schema(
  {
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: "participants must contain exactly two user ids",
      },
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    matchRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "MatchRequest",
      },
    ],
    recordings: [
      {
        type: Schema.Types.ObjectId,
        ref: "CallRecording",
      },
    ],
    distanceMeters: {
      type: Number,
      min: 0,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "ended", "failed"],
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    endedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    endReason: {
      type: String,
      enum: ["completed", "skipped", "disconnect", "timeout", "error"],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

chatSessionSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model("ChatSession", chatSessionSchema);
