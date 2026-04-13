const mongoose = require("mongoose");

const { Schema } = mongoose;

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length === 2 &&
            v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
        },
        message: "coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-z0-9_]+$/, "username can only contain lowercase letters, numbers, and underscores"],
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    avatarUrl:  { type: String, trim: true, default: null },
    languages:  { type: [String], default: [] },
    location: { type: geoPointSchema, required: true },
    locationSource: { type: String, enum: ["gps", "ip"], default: "ip" },
    locationUpdatedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["offline", "online", "searching", "in_call"],
      default: "online",
      index: true,
    },
    isDiscoverable: { type: Boolean, default: true, index: true },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // session expiry — MongoDB TTL auto-deletes after this timestamp
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + Number(process.env.SESSION_TTL_MS)),
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ status: 1, isDiscoverable: 1 });
userSchema.index({ username: 1 });
// TTL index — MongoDB auto-deletes document when expiresAt is reached
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("User", userSchema);
