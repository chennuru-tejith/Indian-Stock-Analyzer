/**
 * Analyzes a candle and returns shape dimensions.
 * @param {Object} candle - { open, high, low, close }
 * @returns {Object} - Candle metrics
 */
function getCandleMetrics(candle) {
  const open = Number(candle.open);
  const close = Number(candle.close);
  const high = Number(candle.high);
  const low = Number(candle.low);

  const range = high - low;
  const body = Math.abs(close - open);
  const isBullish = close >= open;
  const isBearish = close < open;

  const bodyTop = Math.max(open, close);
  const bodyBottom = Math.min(open, close);

  const upperShadow = high - bodyTop;
  const lowerShadow = bodyBottom - low;

  return {
    range,
    body,
    isBullish,
    isBearish,
    bodyTop,
    bodyBottom,
    upperShadow,
    lowerShadow
  };
}

/**
 * Detects candlestick patterns on a series of candles.
 * Returns the candles array with a 'patterns' array attached to each candle.
 * @param {Array<Object>} candles - Standard OHLCV array
 * @returns {Array<Object>} - Array with patterns
 */
export function detectPatterns(candles) {
  if (candles.length === 0) return [];

  return candles.map((candle, idx) => {
    const patterns = [];
    if (idx < 2) {
      return { ...candle, patterns }; // Need at least 3 candles for star patterns
    }

    const current = getCandleMetrics(candle);
    const prev = getCandleMetrics(candles[idx - 1]);
    const prev2 = getCandleMetrics(candles[idx - 2]);

    // Average body size of last 10 candles to evaluate relative size
    const sliceStart = Math.max(0, idx - 10);
    const averageRange = candles.slice(sliceStart, idx).reduce((sum, c) => sum + (c.high - c.low), 0) / (idx - sliceStart || 1);

    // Skip patterns if there is no volatility/range (avoid division by zero or flat days)
    if (current.range === 0) {
      return { ...candle, patterns };
    }

    // 1. DOJI (Body is less than 5% of total range)
    if (current.body <= current.range * 0.05 && current.range > averageRange * 0.2) {
      patterns.push({ name: 'Doji', type: 'neutral' });
    }

    // 2. HAMMER or HANGING MAN (Small body, long lower shadow, tiny upper shadow)
    // - Lower shadow is >= 2x body size
    // - Upper shadow is <= 10% of total range
    if (
      current.lowerShadow >= current.body * 2 &&
      current.upperShadow <= current.range * 0.1 &&
      current.range > averageRange * 0.4
    ) {
      // We will label it as Hammer shape. The Signal service determines if it is a Bullish Hammer or Bearish Hanging Man based on trend.
      patterns.push({ name: 'Hammer Shape', type: 'neutral' });
    }

    // 3. INVERTED HAMMER or SHOOTING STAR (Small body, long upper shadow, tiny lower shadow)
    // - Upper shadow is >= 2x body size
    // - Lower shadow is <= 10% of total range
    if (
      current.upperShadow >= current.body * 2 &&
      current.lowerShadow <= current.range * 0.1 &&
      current.range > averageRange * 0.4
    ) {
      patterns.push({ name: 'Inverted Hammer Shape', type: 'neutral' });
    }

    // 4. BULLISH ENGULFING
    // - Previous was bearish
    // - Current is bullish
    // - Current body fully engulfs previous body
    if (
      prev.isBearish &&
      current.isBullish &&
      candle.open <= candles[idx - 1].close &&
      candle.close >= candles[idx - 1].open &&
      current.body > prev.body
    ) {
      patterns.push({ name: 'Bullish Engulfing', type: 'bullish' });
    }

    // 5. BEARISH ENGULFING
    if (
      prev.isBullish &&
      current.isBearish &&
      candle.open >= candles[idx - 1].close &&
      candle.close <= candles[idx - 1].open &&
      current.body > prev.body
    ) {
      patterns.push({ name: 'Bearish Engulfing', type: 'bearish' });
    }

    // 6. MORNING STAR (3-candle pattern)
    // - 2nd candle ago was large Bearish
    // - 1st candle ago was small body (gap down preferred)
    // - Current candle is large Bullish and closes > 50% into the 2nd candle ago's body
    if (
      prev2.isBearish &&
      prev2.body > averageRange * 0.5 &&
      prev.body <= averageRange * 0.4 &&
      current.isBullish &&
      current.body > averageRange * 0.5 &&
      candle.close >= candles[idx - 2].close + prev2.body * 0.5
    ) {
      patterns.push({ name: 'Morning Star', type: 'bullish' });
    }

    // 7. EVENING STAR
    if (
      prev2.isBullish &&
      prev2.body > averageRange * 0.5 &&
      prev.body <= averageRange * 0.4 &&
      current.isBearish &&
      current.body > averageRange * 0.5 &&
      candle.close <= candles[idx - 2].close - prev2.body * 0.5
    ) {
      patterns.push({ name: 'Evening Star', type: 'bearish' });
    }

    // 8. MARUBOZU (Large body, wicks < 5% of range)
    if (
      current.body >= current.range * 0.9 &&
      current.range > averageRange * 0.8
    ) {
      if (current.isBullish) {
        patterns.push({ name: 'Bullish Marubozu', type: 'bullish' });
      } else {
        patterns.push({ name: 'Bearish Marubozu', type: 'bearish' });
      }
    }

    // 9. HARAMI (Inside Bar)
    // - Previous body engulfs current body
    if (
      prev.body > current.body &&
      current.bodyTop <= prev.bodyTop &&
      current.bodyBottom >= prev.bodyBottom
    ) {
      if (prev.isBearish && current.isBullish) {
        patterns.push({ name: 'Bullish Harami', type: 'bullish' });
      } else if (prev.isBullish && current.isBearish) {
        patterns.push({ name: 'Bearish Harami', type: 'bearish' });
      }
    }

    // 10. PIERCING LINE
    if (
      prev.isBearish &&
      current.isBullish &&
      prev.body > averageRange * 0.4 &&
      current.body > averageRange * 0.4 &&
      candle.open < candles[idx - 1].close &&
      candle.close > prev.bodyBottom + prev.body * 0.5 &&
      candle.close < candles[idx - 1].open
    ) {
      patterns.push({ name: 'Piercing Line', type: 'bullish' });
    }

    // 11. DARK CLOUD COVER
    if (
      prev.isBullish &&
      current.isBearish &&
      prev.body > averageRange * 0.4 &&
      current.body > averageRange * 0.4 &&
      candle.open > candles[idx - 1].close &&
      candle.close < prev.bodyBottom + prev.body * 0.5 &&
      candle.close > candles[idx - 1].open
    ) {
      patterns.push({ name: 'Dark Cloud Cover', type: 'bearish' });
    }

    // 12. THREE WHITE SOLDIERS
    if (
      prev2.isBullish && prev.isBullish && current.isBullish &&
      prev2.body > averageRange * 0.3 && prev.body > averageRange * 0.3 && current.body > averageRange * 0.3 &&
      candles[idx - 1].open > candles[idx - 2].open && candles[idx - 1].open < candles[idx - 2].close &&
      candle.open > candles[idx - 1].open && candle.open < candles[idx - 1].close &&
      candles[idx - 1].close > candles[idx - 2].close &&
      candle.close > candles[idx - 1].close &&
      current.upperShadow <= current.range * 0.25 &&
      prev.upperShadow <= prev.range * 0.25 &&
      prev2.upperShadow <= prev2.range * 0.25
    ) {
      patterns.push({ name: 'Three White Soldiers', type: 'bullish' });
    }

    // 13. THREE BLACK CROWS
    if (
      prev2.isBearish && prev.isBearish && current.isBearish &&
      prev2.body > averageRange * 0.3 && prev.body > averageRange * 0.3 && current.body > averageRange * 0.3 &&
      candles[idx - 1].open < candles[idx - 2].open && candles[idx - 1].open > candles[idx - 2].close &&
      candle.open < candles[idx - 1].open && candle.open > candles[idx - 1].close &&
      candles[idx - 1].close < candles[idx - 2].close &&
      candle.close < candles[idx - 1].close &&
      current.lowerShadow <= current.range * 0.25 &&
      prev.lowerShadow <= prev.range * 0.25 &&
      prev2.lowerShadow <= prev2.range * 0.25
    ) {
      patterns.push({ name: 'Three Black Crows', type: 'bearish' });
    }

    // 14. TWEEZER BOTTOM
    if (
      prev.isBearish &&
      current.isBullish &&
      Math.abs(candle.low - candles[idx - 1].low) / candle.low <= 0.0005 &&
      candle.low > 0
    ) {
      patterns.push({ name: 'Tweezer Bottom', type: 'bullish' });
    }

    // 15. TWEEZER TOP
    if (
      prev.isBullish &&
      current.isBearish &&
      Math.abs(candle.high - candles[idx - 1].high) / candle.high <= 0.0005 &&
      candle.high > 0
    ) {
      patterns.push({ name: 'Tweezer Top', type: 'bearish' });
    }

    // 16. SPINNING TOP
    if (
      current.body >= current.range * 0.05 &&
      current.body <= current.range * 0.25 &&
      current.upperShadow >= current.body * 1.2 &&
      current.lowerShadow >= current.body * 1.2 &&
      current.range > averageRange * 0.3
    ) {
      patterns.push({ name: 'Spinning Top', type: 'neutral' });
    }

    return {
      ...candle,
      patterns
    };
  });
}
