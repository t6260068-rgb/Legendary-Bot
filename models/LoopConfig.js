const mongoose = require("mongoose");

const loopConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    yap: {
      channelId: { type: String, default: null },
      intervalMs: { type: Number, default: 1800000 },
      active: { type: Boolean, default: false },
    },
    rumors: {
      channelId: { type: String, default: null },
      intervalMs: { type: Number, default: 3600000 },
      active: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.LoopConfig || mongoose.model("LoopConfig", loopConfigSchema);
