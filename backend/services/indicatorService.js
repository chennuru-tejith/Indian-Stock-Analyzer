/**
 * Calculates Simple Moving Average (SMA) for an array of numbers.
 * @param {Array<number>} values - Input data
 * @param {number} period - SMA period
 * @returns {Array<number|null>} - SMA values of the same length
 */
export function calculateSMA(values, period) {
  const sma = new Array(values.length).fill(null);
  if (values.length < period) return sma;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  sma[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    sum = sum - values[i - period] + values[i];
    sma[i] = sum / period;
  }

  return sma;
}

/**
 * Calculates Exponential Moving Average (EMA) for an array of numbers.
 * @param {Array<number>} values - Input data
 * @param {number} period - EMA period
 * @returns {Array<number|null>} - EMA values of the same length
 */
export function calculateEMA(values, period) {
  const ema = new Array(values.length).fill(null);
  if (values.length < period) return ema;

  // Start with SMA for the first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEma = sum / period;
  ema[period - 1] = prevEma;

  const multiplier = 2 / (period + 1);

  for (let i = period; i < values.length; i++) {
    const currentEma = (values[i] - prevEma) * multiplier + prevEma;
    ema[i] = currentEma;
    prevEma = currentEma;
  }

  return ema;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing.
 * @param {Array<number>} closes - Closing prices
 * @param {number} period - RSI period (default 14)
 * @returns {Array<number|null>} - RSI values of the same length
 */
export function calculateRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;

  let gains = [];
  let losses = [];

  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Calculate first average gain and loss (SMA)
  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 0; i < period; i++) {
    sumGain += gains[i];
    sumLoss += losses[i];
  }

  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;

  // RSI for period-th element (1-indexed index in original array is `period`)
  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    let rs = avgGain / avgLoss;
    rsi[period] = 100 - 100 / (1 + rs);
  }

  // Calculate rest using Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const gain = gains[i - 1];
    const loss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * @param {Array<number>} values - Closing prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line EMA period (default 9)
 * @returns {Array<Object|null>} - Array containing { macd, signal, histogram } or null
 */
export function calculateMACD(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const macd = new Array(values.length).fill(null);
  if (values.length < slowPeriod) return macd;

  const fastEma = calculateEMA(values, fastPeriod);
  const slowEma = calculateEMA(values, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < values.length; i++) {
    if (fastEma[i] === null || slowEma[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  // Filter out nulls from the beginning of macdLine for the signal calculation
  const validMacdStartIndex = macdLine.findIndex(val => val !== null);
  const validMacdLine = macdLine.slice(validMacdStartIndex);
  const validSignalEma = calculateEMA(validMacdLine, signalPeriod);

  // Re-align signal EMA back to the original index space
  const signalLine = new Array(values.length).fill(null);
  for (let i = 0; i < validSignalEma.length; i++) {
    signalLine[validMacdStartIndex + i] = validSignalEma[i];
  }

  // Populate output
  for (let i = 0; i < values.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      macd[i] = null;
    } else {
      macd[i] = {
        macdLine: macdLine[i],
        signalLine: signalLine[i],
        histogram: macdLine[i] - signalLine[i]
      };
    }
  }

  return macd;
}

/**
 * Enriches a candles array with technical indicators.
 * @param {Array<Object>} candles - Array of { time, open, high, low, close, volume }
 * @returns {Array<Object>} - Enriched candles array
 */
export function enrichWithIndicators(candles) {
  if (candles.length === 0) return [];
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ema20 = calculateEMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const volSma20 = calculateSMA(volumes, 20);

  return candles.map((candle, idx) => ({
    ...candle,
    ema20: ema20[idx],
    sma50: sma50[idx],
    sma200: sma200[idx],
    rsi: rsi[idx],
    macd: macd[idx],
    volSma20: volSma20[idx]
  }));
}
