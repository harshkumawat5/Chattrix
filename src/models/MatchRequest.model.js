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

const matchRequestSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    minDistanceMeters: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxDistanceMeters: {
      type: Number,
      min: 100,
      required: true,
    },
    status: {
      type: String,
      enum: ["searching", "matched", "cancelled", "expired"],
      default: "searching",
      index: true,
    },
    locationSnapshot: {
      type: geoPointSchema,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    matchedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 120000),
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

matchRequestSchema.pre("validate", function validateDistanceRange(next) {
  if (this.minDistanceMeters > this.maxDistanceMeters) {
    return next(new Error("minDistanceMeters cannot be greater than maxDistanceMeters"));
  }

  return next();
});

matchRequestSchema.index({ locationSnapshot: "2dsphere" });
matchRequestSchema.index({ status: 1, mode: 1, requestedAt: 1 });
matchRequestSchema.index(
  { user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "searching",
    },
  }
);

module.exports = mongoose.model("MatchRequest", matchRequestSchema);
