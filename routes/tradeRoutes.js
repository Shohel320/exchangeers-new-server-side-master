const express = require('express');
const Trade = require('../models/Trade');
const axios = require('axios');
const { subscribeToPair } = require('../Services/PriceBridge');
const User = require('../models/user');
const Agent = require('../models/agent')
const AdminCommission = require('../models/AdminCommission');
const TransactionHistory  = require('../models/userTradeHistory')
const authMiddleware = require("../middleware/profileMiddleware");
const UserTrade = require('../models/userTrade')



const router = express.Router();

// ✅ 1. Open Trade (Admin Only)
router.post('/open', async (req, res) => {
  try {
    const {
      pair,
      direction,
      quantity,
      baseQuantity,
      leverage,
      visibilityType,
      selectedUsers
    } = req.body;

    if (!pair || !direction || !quantity) {
      return res.status(400).json({
        message: 'pair, direction, quantity required'
      });
    }

    // Binance price
    const response = await axios.get(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${pair}`
    );

    const entryPrice = parseFloat(response.data.price);

    // Create main trade
    const trade = new Trade({
      pair,
      direction,
      leverage,
      quantity,
      baseQuantity,
      entryPrice,
      visibilityType: visibilityType || "ALL",
      selectedUsers: selectedUsers || [],
      status: 'OPEN'
    });

    await trade.save();

    // ====================================
    // USER FILTERING LOGIC
    // ====================================


    let usersToAssign = [];

    // 🌍 ALL USERS
    if (visibilityType === "ALL") {
      usersToAssign = await User.find({}, "_id");
    }

    // ✅ INCLUDE ONLY
    else if (visibilityType === "INCLUDE") {
      usersToAssign = await User.find({
        _id: { $in: selectedUsers }
      }, "_id");
    }

    // ❌ EXCLUDE USERS
    else if (visibilityType === "EXCLUDE") {
      usersToAssign = await User.find({
        _id: { $nin: selectedUsers }
      }, "_id");
    }

    // ====================================
    // CREATE USER TRADES
    // ====================================

    const userTrades = usersToAssign.map((user) => ({
  tradeId: trade._id,
  userId: user._id,

  pair: trade.pair,
  direction: trade.direction,

  status: "OPEN",

  entryPrice: trade.entryPrice,

  capital: trade.baseQuantity,
  leverage: trade.leverage,

  profitLossPercent: 0,
  profitLossUSDT: 0,
}));

    await UserTrade.insertMany(userTrades);

    // websocket subscribe
    subscribeToPair(pair);

    res.json({
      message: 'Trade opened successfully',
      trade,
      assignedUsers: usersToAssign.length
    });

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// ✅ 2. Close Trade (Admin Only)
router.post('/close/:id', async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    if (trade.status === 'CLOSED') return res.status(400).json({ message: 'Trade already closed' });
    const {
  closePrice,
  visibilityType,
  selectedUsers,
} = req.body;

    if (!closePrice || Number(closePrice) <= 0) {
      return res
        .status(400)
        .json({ message: "Manual closing price is required" });
    }
  

   // ✅ Profit/Loss হিসাব
let profitLossUsd = 0;
let profitLossPercent = 0;

// Entry & Close Price
const entry = Number(trade.entryPrice);
const close = Number(closePrice);

// Quantity (Base এবং Leverage)
const baseQty = Number(trade.baseQuantity || 0);
const leverage = Number(trade.leverage || 3);
const leveragedQty = baseQty * leverage; // মোট এক্সপোজার

if (entry > 0 && baseQty > 0) {
  let priceDiffRatio = 0;

  if (trade.direction === 'LONG') {
    priceDiffRatio = (close - entry) / entry;
  } else if (trade.direction === 'SHORT') {
    priceDiffRatio = (entry - close) / entry;
  }

  // ✅ Profit/Loss (USDT) লেভারেজড কোয়ান্টিটি অনুযায়ী
  profitLossUsd = priceDiffRatio * leveragedQty;

  // ✅ Profit/Loss (%) বেস কোয়ান্টিটি অনুযায়ী
  profitLossPercent = (profitLossUsd / baseQty) * 100;
}



    // ✅ Trade এ Save করা
    //trade.status = 'CLOSED';
   // trade.closePrice = close;
   // trade.profitLossPercent = profitLossPercent.toFixed(2);
  //  trade.profitLossUSDT = profitLossUsd.toFixed(2);
    //await trade.save();

    // ✅ User trades close
let query = {
  tradeId: trade._id,
  status: "OPEN",
};

if (
  visibilityType === "INCLUDE" &&
  selectedUsers?.length
) {
  query.userId = {
    $in: selectedUsers,
  };
}

if (
  visibilityType === "EXCLUDE" &&
  selectedUsers?.length
) {
  query.userId = {
    $nin: selectedUsers,
  };
}

    // ✅ সব ইউজারের ব্যালেন্স আপডেট + এজেন্ট & এডমিন কমিশন
    // ✅ সব ইউজারের ব্যালেন্স আপডেট + এজেন্ট & এডমিন কমিশন
//const userTrades = await UserTrade.find({
  //tradeId: trade._id
//});

const userTrades = await UserTrade.find(query);

for (const ut of userTrades) {
  ut.status = "CLOSED";
  ut.closePrice = closePrice;
  ut.closeTime = new Date();
  ut.isManuallyClosed = true;

  ut.profitLossPercent = profitLossPercent.toFixed(2);
  ut.profitLossUSDT = profitLossUsd.toFixed(2);

  await ut.save();
}

// ✅ closed users remove from master trade selectedUsers
const closedUserIds = userTrades.map((t) =>
  t.userId.toString()
);

trade.selectedUsers = trade.selectedUsers.filter(
  (id) => !closedUserIds.includes(id.toString())
);

await trade.save();

const userIds = userTrades.map(t => t.userId);


const remainingOpenTrades = await UserTrade.countDocuments({
  tradeId: trade._id,
  status: "OPEN",
});


if (remainingOpenTrades === 0) {
  trade.status = "CLOSED";
  trade.closePrice = closePrice;
  trade.profitLossPercent = profitLossPercent.toFixed(2);
  trade.profitLossUSDT = profitLossUsd.toFixed(2);

  await trade.save();
}

const users = await User.find({
  _id: { $in: userIds }
}).populate("referredBy");

for (let user of users) {

    const currentUserTrade = userTrades.find(
    (t) => t.userId.toString() === user._id.toString()
  );

  const walletBefore = user.defaultWalletBalance || 0;
  const change = (walletBefore * profitLossPercent) / 100;

  if (change > 0) {
  let agentCommission = 0;
  let adminCommission = 0;

  if (user.referredBy) {
    // 🔹 রেফারড ইউজারের ক্ষেত্রে
    agentCommission = (change * 4) / 100;
    adminCommission = (change * 17) / 100;
  } else {
    // 🔹 রেফারড না থাকলে
    agentCommission = 0;
    adminCommission = (change * 21) / 100;
  }

  const userNetProfit = change - (agentCommission + adminCommission);

  // ✅ ইউজারের ওয়ালেট আপডেট
  user.defaultWalletBalance = walletBefore + userNetProfit;
  await user.save();

  // ✅ TransactionHistory এ সেভ
  await TransactionHistory.create({
    userId: user._id,
    tradeId: trade._id,
    userTradeId: currentUserTrade?._id,
    type: "PROFIT",
    amount: userNetProfit,
    agentCommission,
    adminCommission,
    balanceAfter: user.defaultWalletBalance,
    description: `Trade profit: ${userNetProfit.toFixed(2)} | Agent: ${agentCommission.toFixed(2)} | Admin: ${adminCommission.toFixed(2)}`,
  });

  // ✅ এজেন্ট কমিশন (যদি থাকে)
  if (user.referredBy && agentCommission > 0) {
    const agent = await Agent.findById(user.referredBy);
    if (agent) {
      agent.commissionBalance = (agent.commissionBalance || 0) + agentCommission;
      await agent.save();
    }
  }

  // ✅ এডমিন কমিশন আপডেট
  let admin = await AdminCommission.findOne();
  if (!admin) {
    admin = new AdminCommission({ totalCommission: 0, history: [] });
  }
  admin.totalCommission += adminCommission;
  admin.history.push({
    amount: adminCommission,
    fromUser: user._id,
    tradeId: trade._id,
  });
  await admin.save();

  } else {
    // 🔻 LOSS
    user.defaultWalletBalance = walletBefore + change;
    await user.save();

    await TransactionHistory.create({
      userId: user._id,
      tradeId: trade._id,
      userTradeId: currentUserTrade?._id,
      type: "LOSS",
      amount: change,
      balanceAfter: user.defaultWalletBalance,
      agentCommission: 0,
      adminCommission: 0,
      description: `Trade loss deducted.`,
    });
  }
}

res.json({
  message: 'Trade closed successfully, balances & commissions updated',
  trade,
  profitLossPercent
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// ✅ 3. Get All Trades (User View)
router.get('/', authMiddleware, async (req, res) => {
  try {

    const trades = await UserTrade.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    res.json(trades);

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});


router.get('/mastertrade', async (req, res) => {
  try {

    const trades = await Trade.find()
      .populate("selectedUsers", "username email")
      .sort({ createdAt: -1 });

    res.json(trades);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/commission", async (req, res) => {
  try {
    const adminCommission = await AdminCommission.findOne().populate("history.fromUser", "name email");

    if (!adminCommission) {
      return res.json({
        totalCommission: 0,
        history: []
      });
    }

    res.json({
      totalCommission: adminCommission.totalCommission,
      history: adminCommission.history
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
