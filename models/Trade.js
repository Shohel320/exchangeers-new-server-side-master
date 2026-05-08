const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  pair: { type: String, required: true },
  direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
  
  // NOTE: This is the leveraged trade size (e.g., $500 * 10x = 5000)
  quantity: { type: Number, required: true }, 

  // ✅ NEW FIELD: The actual capital used (e.g., $500). This is crucial for P&L %.

  entryPrice: { type: Number, default: null },
  openAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  baseQuantity: { type: Number, required: true },
  closePrice: { type: Number, default: null },
  profitLossPercent: { type: Number, default: null },
  profitLossUSDT: { type: Number, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  leverage: {
    type: Number,
    default: 3,
  },
   visibilityType: {
    type: String,
    enum: ["ALL", "INCLUDE", "EXCLUDE"],
    default: "ALL",
  },
   selectedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

module.exports = mongoose.model('Trade', tradeSchema);