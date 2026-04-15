const mongoose = require("mongoose");

async function connectMongo() {
  try {
    console.log("🟡 Trying to connect to MongoDB...");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("🟢 MongoDB connected successfully!");
  } catch (err) {
    console.error("🔴 MongoDB connection error:", err.message);
  }
}

module.exports = connectMongo;
