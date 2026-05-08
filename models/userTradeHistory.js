const mongoose = require("mongoose");

const transactionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trade",
    required: true,
  },
  type: {
    type: String,
    enum: ["PROFIT", "LOSS"],
    required: true,
  },

  agentCommission: { type: Number, default: 0 },
  adminCommission: { type: Number, default: 0 },


  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
  },
  description: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  userTradeId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "UserTrade",
},

});

module.exports = mongoose.model("TransactionHistory", transactionHistorySchema);
