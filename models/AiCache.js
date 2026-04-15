const mongoose = require("mongoose");

const rumorItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    gifQuery: { type: String, required: true },
  },
  { _id: false }
);

const aiCacheSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    yaps: {
      type: [String],
      default: [],
    },
    rumors: {
      type: [rumorItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.AiCache || mongoose.model("AiCache", aiCacheSchema);
