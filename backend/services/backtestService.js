/**
 * Runs a simulated backtest on historical stock data based on generated signals.
 * Rules:
 * - When BUY signal occurs, enter a LONG trade on the next candle's OPEN price.
 * - Exit trade when:
 *   1. SELL signal occurs (Exit at next candle's OPEN)
 *   2. Stop Loss (SL) is hit during the candle's low (Exit at SL price)
 *   3. Take Profit (TP) is hit during the candle's high (Exit at TP price)
 * 
 * @param {Array<Object>} signaledCandles - Candles with 'signal' and 'confidence' properties
 * @param {Object} options - Backtest options (capital, stopLossPercent, takeProfitPercent)
 * @returns {Object} - Backtest results (summary statistics and trade log)
 */
export function runBacktest(signaledCandles, options = {}) {
  const initialCapital = options.initialCapital || 100000;
  const stopLossPercent = options.stopLossPercent || 2.5; // default 2.5% SL
  const takeProfitPercent = options.takeProfitPercent || 5.0; // default 5% TP (1:2 R:R)
  const confidenceFilter = options.confidenceFilter || ['HIGH', 'MEDIUM']; // Only trade high/medium confidence

  let capital = initialCapital;
  let activeTrade = null;
  const trades = [];
  const equityCurve = [{ time: signaledCandles[0]?.time || '', value: initialCapital }];

  for (let i = 0; i < signaledCandles.length - 1; i++) {
    const candle = signaledCandles[i];
    const nextCandle = signaledCandles[i + 1];

    // Check if we need to exit an active trade
    if (activeTrade) {
      const entryPrice = activeTrade.entryPrice;
      const targetSLPrice = entryPrice * (1 - stopLossPercent / 100);
      const targetTPPrice = entryPrice * (1 + takeProfitPercent / 100);

      // Check Stop Loss hit
      if (nextCandle.low <= targetSLPrice) {
        const exitPrice = nextCandle.open <= targetSLPrice ? nextCandle.open : targetSLPrice;
        const profit = exitPrice - entryPrice;
        const returnPercent = (profit / entryPrice) * 100;
        capital = capital * (1 + returnPercent / 100);

        trades.push({
          entryTime: activeTrade.entryTime,
          entryPrice: entryPrice,
          exitTime: nextCandle.time,
          exitPrice: exitPrice,
          returnPercent: returnPercent,
          exitReason: 'Stop Loss',
          duration: i - activeTrade.index
        });
        activeTrade = null;
        equityCurve.push({ time: nextCandle.time, value: capital });
      } 
      // Check Take Profit hit
      else if (nextCandle.high >= targetTPPrice) {
        const exitPrice = nextCandle.open >= targetTPPrice ? nextCandle.open : targetTPPrice;
        const profit = exitPrice - entryPrice;
        const returnPercent = (profit / entryPrice) * 100;
        capital = capital * (1 + returnPercent / 100);

        trades.push({
          entryTime: activeTrade.entryTime,
          entryPrice: entryPrice,
          exitTime: nextCandle.time,
          exitPrice: exitPrice,
          returnPercent: returnPercent,
          exitReason: 'Take Profit',
          duration: i - activeTrade.index
        });
        activeTrade = null;
        equityCurve.push({ time: nextCandle.time, value: capital });
      } 
      // Check Exit on Opposite Signal (SELL)
      else if (candle.signal === 'SELL') {
        const exitPrice = nextCandle.open; // Exit at next open
        const profit = exitPrice - entryPrice;
        const returnPercent = (profit / entryPrice) * 100;
        capital = capital * (1 + returnPercent / 100);

        trades.push({
          entryTime: activeTrade.entryTime,
          entryPrice: entryPrice,
          exitTime: nextCandle.time,
          exitPrice: exitPrice,
          returnPercent: returnPercent,
          exitReason: 'Sell Signal',
          duration: i - activeTrade.index
        });
        activeTrade = null;
        equityCurve.push({ time: nextCandle.time, value: capital });
      }
    }

    // Check if we can enter a new LONG trade
    if (!activeTrade && candle.signal === 'BUY' && confidenceFilter.includes(candle.confidence)) {
      activeTrade = {
        entryTime: nextCandle.time,
        entryPrice: nextCandle.open, // buy on next open
        index: i + 1
      };
    }
  }

  // Force close any remaining open trade at the end of data set
  if (activeTrade && signaledCandles.length > 0) {
    const finalCandle = signaledCandles[signaledCandles.length - 1];
    const entryPrice = activeTrade.entryPrice;
    const exitPrice = finalCandle.close;
    const profit = exitPrice - entryPrice;
    const returnPercent = (profit / entryPrice) * 100;
    capital = capital * (1 + returnPercent / 100);

    trades.push({
      entryTime: activeTrade.entryTime,
      entryPrice: entryPrice,
      exitTime: finalCandle.time,
      exitPrice: exitPrice,
      returnPercent: returnPercent,
      exitReason: 'Data End (Forced)',
      duration: signaledCandles.length - 1 - activeTrade.index
    });
    equityCurve.push({ time: finalCandle.time, value: capital });
  }

  // Compute metrics
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.returnPercent > 0).length;
  const losingTrades = totalTrades - winningTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const grossProfit = trades.filter(t => t.returnPercent > 0).reduce((sum, t) => sum + t.returnPercent, 0);
  const grossLoss = trades.filter(t => t.returnPercent <= 0).reduce((sum, t) => sum + Math.abs(t.returnPercent), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.0 : 0.0;

  const netProfitPercent = ((capital - initialCapital) / initialCapital) * 100;

  // Max Drawdown Calculation
  let peak = initialCapital;
  let maxDrawdown = 0;
  for (const eq of equityCurve) {
    if (eq.value > peak) {
      peak = eq.value;
    }
    const dd = ((peak - eq.value) / peak) * 100;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  return {
    summary: {
      initialCapital,
      finalCapital: capital,
      netProfitPercent,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      maxDrawdownPercent: maxDrawdown,
      avgTradeReturnPercent: totalTrades > 0 ? trades.reduce((sum, t) => sum + t.returnPercent, 0) / totalTrades : 0
    },
    trades,
    equityCurve
  };
}
