const mongoose = require("mongoose");

const { Schema } = mongoose;

const userPreferenceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preferredMinDistanceMeters: {
      type: Number,
      min: 0,
      default: 0,
    },
    preferredMaxDistanceMeters: {
      type: Number,
      min: 100,
      default: 10000,
    },
    preferredMode: {
      type: String,
      enum: ["audio", "video", "both"],
      default: "both",
    },
    languageCodes: {
      type: [String],
      default: [],
    },
    allowLocalMatching: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userPreferenceSchema.pre("validate", function validateDistanceRange(next) {
  if (this.preferredMinDistanceMeters > this.preferredMaxDistanceMeters) {
    return next(new Error("preferredMinDistanceMeters cannot be greater than preferredMaxDistanceMeters"));
  }

  return next();
});

module.exports = mongoose.model("UserPreference", userPreferenceSchema);
