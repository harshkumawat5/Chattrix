const { UserPreference } = require("../models");

const getPreferences = async (req, res, next) => {
  try {
    const pref = await UserPreference.findOne({ user: req.user._id });
    if (!pref) return res.status(404).json({ message: "Preferences not found" });
    return res.status(200).json({ data: pref });
  } catch (error) {
    return next(error);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const { preferredMinDistanceMeters, preferredMaxDistanceMeters, preferredMode, languageCodes, allowLocalMatching } =
      req.body;

    const pref = await UserPreference.findOneAndUpdate(
      { user: req.user._id },
      { preferredMinDistanceMeters, preferredMaxDistanceMeters, preferredMode, languageCodes, allowLocalMatching },
      { new: true, runValidators: true, omitUndefined: true }
    );
    if (!pref) return res.status(404).json({ message: "Preferences not found" });

    return res.status(200).json({ data: pref });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getPreferences, updatePreferences };
