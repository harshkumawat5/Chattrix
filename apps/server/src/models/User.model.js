const mongoose = require("mongoose");

const { Schema } = mongoose;

const geoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: "coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    languages: {
      type: [String],
      default: [],
    },
    location: {
      type: geoPointSchema,
      required: true,
    },
    locationSource: {
      type: String,
      enum: ["gps", "ip"],
      default: "ip",
    },
    locationUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["offline", "online", "searching", "in_call"],
      default: "offline",
      index: true,
    },
    isDiscoverable: {
      type: Boolean,
      default: true,
      index: true,
    },
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ status: 1, isDiscoverable: 1 });

module.exports = mongoose.model("User", userSchema);
