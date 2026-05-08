const { WebSocket } = require('ws');
const Trade = require('../models/Trade');

let latestPrices = {};
let activeSockets = {};

// Subscribe to Binance WebSocket
function subscribeToPair(pair) {
  if (activeSockets[pair]) return; // already subscribed

  const symbol = pair.toLowerCase();

  const connect = () => {
   const ws = new WebSocket(
  `wss://fstream.binance.com/ws/${symbol}@trade`
);

    ws.on('open', () => {
      console.log(`${pair} WebSocket connected`);
    });

    ws.on('message', async (msg) => {
      const data = JSON.parse(msg);
      if (!data.p) return;

      const price = parseFloat(data.p);
      latestPrices[pair] = price;

      // Update all open trades
      const openTrades = await Trade.find({ status: 'OPEN', pair });
      for (let trade of openTrades) {
        let profitLossPercent = 0;

        if (trade.direction === 'LONG') {
          profitLossPercent = ((price - trade.entryPrice) / trade.entryPrice) * 100;
        } else if (trade.direction === 'SHORT') {
          profitLossPercent = ((trade.entryPrice - price) / trade.entryPrice) * 100;
        }

        const profitLossUSDT = (profitLossPercent / 100) * trade.quantity;

        trade.profitLossPercent = profitLossPercent.toFixed(2);
        trade.profitLossUSDT = profitLossUSDT.toFixed(2);
        await trade.save();
      }
    });

    ws.on('close', () => {
      console.log(`${pair} WebSocket closed. Reconnecting in 3 seconds...`);
      delete activeSockets[pair];
      setTimeout(connect, 3000); // reconnect after 3 seconds
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${pair}:`, err.message);
      ws.close();
    });

    activeSockets[pair] = ws;
  };

  connect();
}

module.exports = { subscribeToPair, latestPrices };
