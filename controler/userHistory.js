const TransactionHistory = require("../models/userTradeHistory");
const mongoose = require("mongoose");

exports.getUserTradeHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const history = await TransactionHistory.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate(
        "userTradeId",
        "pair entryPrice closePrice profitLossPercent profitLossUSDT status"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching transaction history:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching transaction history.",
    });
  }
};