/**
 * Fuses candlestick patterns and technical indicators to generate trading signals.
 * @param {Array<Object>} enrichedCandles - OHLCV candles enriched with indicators and patterns
 * @returns {Array<Object>} - Candles with buy/sell/hold signals attached
 */
export function generateSignals(enrichedCandles) {
  if (enrichedCandles.length === 0) return [];

  return enrichedCandles.map((candle, idx) => {
    // Need enough history for indicator comparisons
    if (idx < 50) {
      return {
        ...candle,
        signal: 'HOLD',
        confidence: null,
        reason: 'Insufficient historical data for signal generation (needs 50+ candles).'
      };
    }

    const {
      open, high, low, close, volume,
      ema20, sma50, sma200, rsi, macd, volSma20,
      patterns
    } = candle;

    // Default signal state
    let signal = 'HOLD';
    let confidence = null;
    let reasons = [];
    let score = 0;

    // Trend definitions
    const isAboveSma200 = sma200 ? close > sma200 : false;
    const isAboveEma20 = ema20 ? close > ema20 : false;
    const isAboveSma50 = sma50 ? close > sma50 : false;

    // Indicators validation
    const isRsiOversold = rsi ? rsi <= 35 : false;
    const isRsiOverbought = rsi ? rsi >= 65 : false;
    const isMacdBullish = macd ? macd.histogram > 0 : false;
    const isMacdBearish = macd ? macd.histogram < 0 : false;
    const hasVolumeExpansion = volSma20 ? volume > volSma20 * 1.2 : false;

    // Iterate through patterns detected on this candle
    for (const p of patterns) {
      if (p.name === 'Hammer Shape') {
        // If hammer shape occurs when short-term oversold or below EMA20, it's a Bullish Hammer
        if (!isAboveEma20 || isRsiOversold) {
          signal = 'BUY';
          reasons.push(`Bullish Hammer candlestick pattern detected near support/oversold.`);
          score += 2; // High weight for Hammer at bottom
          if (isRsiOversold) score += 1;
        } else {
          // Hammer at top is Hanging Man (bearish)
          signal = 'SELL';
          reasons.push(`Bearish Hanging Man candlestick pattern detected at top of trend.`);
          score += 1;
        }
      }

      else if (p.name === 'Inverted Hammer Shape') {
        if (!isAboveEma20 || isRsiOversold) {
          signal = 'BUY';
          reasons.push(`Bullish Inverted Hammer candlestick pattern detected.`);
          score += 1;
        } else {
          // Inverted Hammer at top is a Shooting Star (strong bearish reversal)
          signal = 'SELL';
          reasons.push(`Bearish Shooting Star candlestick pattern detected.`);
          score += 2;
          if (isRsiOverbought) score += 1;
        }
      }

      else if (p.type === 'bullish') {
        signal = 'BUY';
        reasons.push(`Bullish pattern (${p.name}) detected.`);
        score += 2;
      }

      else if (p.type === 'bearish') {
        signal = 'SELL';
        reasons.push(`Bearish pattern (${p.name}) detected.`);
        score += 2;
      }

      else if (p.name === 'Doji') {
        // Doji indicates indecision, wait for confirmation, unless extremely overbought/oversold
        if (isRsiOversold) {
          signal = 'BUY';
          reasons.push(`Doji indecision pattern detected in oversold zone (RSI: ${rsi?.toFixed(1)}).`);
          score += 1;
        } else if (isRsiOverbought) {
          signal = 'SELL';
          reasons.push(`Doji indecision pattern detected in overbought zone (RSI: ${rsi?.toFixed(1)}).`);
          score += 1;
        }
      }
    }

    // If we have a potential trade setup, verify it with technical indicator fusion
    if (signal === 'BUY') {
      // 1. Long-term trend confirmation
      if (isAboveSma200) {
        score += 1;
        reasons.push(`Aligned with major uptrend (above SMA 200).`);
      } else {
        reasons.push(`Counter-trend trade (below SMA 200) - higher risk.`);
      }

      // 2. MACD cross / positive histogram
      if (isMacdBullish) {
        score += 1;
        reasons.push(`MACD histogram is positive (bullish momentum).`);
      }

      // 3. Volume expansion
      if (hasVolumeExpansion) {
        score += 1;
        reasons.push(`Volume expands to ${((volume / volSma20) || 1).toFixed(1)}x of 20-period average (buying pressure).`);
      }

      // Determine confidence
      if (score >= 4) {
        confidence = 'HIGH';
      } else if (score >= 2) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }
    } 
    
    else if (signal === 'SELL') {
      // 1. Long-term trend confirmation
      if (!isAboveSma200) {
        score += 1;
        reasons.push(`Aligned with major downtrend (below SMA 200).`);
      } else {
        reasons.push(`Counter-trend trade (above SMA 200) - higher risk.`);
      }

      // 2. MACD momentum
      if (isMacdBearish) {
        score += 1;
        reasons.push(`MACD histogram is negative (bearish momentum).`);
      }

      // 3. Volume expansion
      if (hasVolumeExpansion) {
        score += 1;
        reasons.push(`Volume expands to ${((volume / volSma20) || 1).toFixed(1)}x of 20-period average (selling pressure).`);
      }

      // Determine confidence
      if (score >= 4) {
        confidence = 'HIGH';
      } else if (score >= 2) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }
    }

    // Default cleanup for no signal
    if (signal === 'HOLD' || score < 2) {
      signal = 'HOLD';
      confidence = null;
      reasons = reasons.length > 0 ? reasons : ['No pattern or indicator crossover detected.'];
    }

    return {
      ...candle,
      signal,
      confidence,
      reason: reasons.join(' ')
    };
  });
}
