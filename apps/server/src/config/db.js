const mongoose = require("mongoose");

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required in environment variables");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
};

module.exports = {
  connectDatabase,
};

