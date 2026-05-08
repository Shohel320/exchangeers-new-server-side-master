const mongoose = require('mongoose');

const userTradeSchema = new mongoose.Schema({
  tradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trade",
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  pair: String,

  direction: {
    type: String,
    enum: ["LONG", "SHORT"],
  },

  status: {
    type: String,
    enum: ["OPEN", "CLOSED"],
    default: "OPEN",
  },

  entryPrice: Number,
  closePrice: Number,

  capital: Number,
  leverage: Number,

  profitLossPercent: Number,
  profitLossUSDT: Number,
   closeTime: Date,

  isManuallyClosed: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserTrade", userTradeSchema); 