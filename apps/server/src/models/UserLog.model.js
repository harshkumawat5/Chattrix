const mongoose = require("mongoose");
const { Schema } = mongoose;

// Permanent log — never TTL deleted — for law enforcement compliance
// IT (Intermediary Guidelines) Rules 2021 requires 180-day minimum retention
// We retain permanently as a safety measure
const userLogSchema = new Schema(
  {
    username:       { type: String, required: true },
    ipAddress:      { type: String, required: true },
    coordinates:    { type: [Number], default: null }, // [lon, lat]
    locationSource: { type: String, enum: ["gps", "ip"], default: "ip" },
    userAgent:      { type: String, default: null },
    action:         { type: String, enum: ["register", "session_start", "block_report"], default: "register" },
    sessionUserId:  { type: Schema.Types.ObjectId, ref: "User", default: null },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reportReason:   { type: String, default: null },
    createdAt:      { type: Date, default: Date.now },
  },
  { versionKey: false }
);

userLogSchema.index({ ipAddress: 1 });
userLogSchema.index({ username: 1 });
userLogSchema.index({ createdAt: 1 });

module.exports = mongoose.model("UserLog", userLogSchema);
