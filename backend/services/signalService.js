import { calculateSupportResistance } from './indicatorService.js';

/**
 * Fuses candlestick patterns, support/resistance, oscillators, and news sentiment into a unified recommendation.
 * @param {Array<Object>} enrichedCandles - OHLCV candles enriched with indicators and patterns
 * @param {Object} options - Configuration options (such as newsSentimentScore)
 * @returns {Array<Object>} - Candles with unified score, buy/sell recommendations, and levels
 */
export function generateSignals(enrichedCandles, options = {}) {
  if (enrichedCandles.length === 0) return [];
  
  const newsSentimentScore = options.newsSentimentScore !== undefined ? options.newsSentimentScore : 50;

  return enrichedCandles.map((candle, idx) => {
    // Need enough history for indicator comparisons
    if (idx < 50) {
      return {
        ...candle,
        signal: 'HOLD',
        confidence: null,
        score: 50,
        reason: 'Insufficient historical data for signal generation (needs 50+ candles).',
        nearestSupport: candle.close * 0.95,
        nearestResistance: candle.close * 1.05
      };
    }

    const {
      open, high, low, close, volume,
      ema20, sma50, sma200, rsi, macd, volSma20,
      patterns
    } = candle;

    // 1. Calculate Support & Resistance up to this candle to prevent look-ahead bias
    const historyUpToCurrent = enrichedCandles.slice(0, idx + 1);
    const { support, resistance } = calculateSupportResistance(historyUpToCurrent);
    const nearestSupport = support[0] || close * 0.95;
    const nearestResistance = resistance[0] || close * 1.05;

    const distToSupportPercent = ((close - nearestSupport) / nearestSupport) * 100;
    const distToResistancePercent = ((nearestResistance - close) / close) * 100;

    const isNearSupport = distToSupportPercent <= 1.8;
    const isNearResistance = distToResistancePercent <= 1.8;

    // 2. Trend Pillar Score (0 - 100)
    let trendComponent = 0;
    if (sma200 && close > sma200) trendComponent += 30;
    if (sma50 && close > sma50) trendComponent += 20;
    if (ema20 && close > ema20) trendComponent += 20;
    if (macd && macd.histogram > 0) trendComponent += 30;
    const trendScore = trendComponent;

    // 3. Oscillator Pillar Score (0 - 100)
    let oscillatorScore = 50; // default neutral
    if (rsi) {
      if (rsi <= 30) {
        oscillatorScore = 100; // highly bullish oversold
      } else if (rsi >= 70) {
        oscillatorScore = 0; // highly bearish overbought
      } else {
        // Linear mapping from 30 (100) to 70 (0)
        oscillatorScore = Math.max(0, Math.min(100, Math.round(100 - ((rsi - 30) * (100 / 40)))));
      }
    }

    // 4. Pattern & Pivot Volume Pillar Score (0 - 100)
    let patternComponent = 50; // default neutral
    let signal = 'HOLD';
    let reasons = [];
    const hasVolumeExpansion = volSma20 ? volume > volSma20 * 1.25 : false;

    // Breakout detection
    const isResistanceBreakout = close > nearestResistance && hasVolumeExpansion;
    const isSupportBreakdown = close < nearestSupport && hasVolumeExpansion;

    if (isResistanceBreakout) {
      signal = 'BUY';
      patternComponent += 30;
      reasons.push(`Resistance Breakout: Price closed above historical resistance level (₹${nearestResistance.toFixed(2)}) on high volume.`);
    } else if (isSupportBreakdown) {
      signal = 'SELL';
      patternComponent -= 30;
      reasons.push(`Support Breakdown: Price closed below historical support level (₹${nearestSupport.toFixed(2)}) on high volume.`);
    }

    // Candlestick Pattern matches S/R check
    patterns.forEach(p => {
      if (p.name === 'Hammer Shape') {
        if (isNearSupport || rsi <= 40) {
          signal = 'BUY';
          patternComponent += 35;
          reasons.push(`Bullish Hammer candlestick pattern detected near support level (₹${nearestSupport.toFixed(2)}).`);
        } else {
          signal = 'SELL';
          patternComponent -= 20;
          reasons.push(`Bearish Hanging Man candlestick pattern detected near peak.`);
        }
      }
      else if (p.name === 'Inverted Hammer Shape') {
        if (isNearSupport || rsi <= 40) {
          signal = 'BUY';
          patternComponent += 25;
          reasons.push(`Bullish Inverted Hammer candlestick pattern detected near support.`);
        } else {
          signal = 'SELL';
          patternComponent -= 35;
          reasons.push(`Bearish Shooting Star candlestick pattern detected near resistance level (₹${nearestResistance.toFixed(2)}).`);
        }
      }
      else if (p.type === 'bullish') {
        signal = 'BUY';
        patternComponent += isNearSupport ? 40 : 20;
        reasons.push(`Bullish pattern (${p.name}) detected${isNearSupport ? ' near support level' : ''}.`);
      }
      else if (p.type === 'bearish') {
        signal = 'SELL';
        patternComponent -= isNearResistance ? 40 : 20;
        reasons.push(`Bearish pattern (${p.name}) detected${isNearResistance ? ' near resistance level' : ''}.`);
      }
      else if (p.name === 'Doji') {
        if (rsi <= 35) {
          signal = 'BUY';
          patternComponent += 20;
          reasons.push(`Doji indecision pattern detected in oversold area.`);
        } else if (rsi >= 65) {
          signal = 'SELL';
          patternComponent -= 20;
          reasons.push(`Doji indecision pattern detected in overbought area.`);
        }
      }
    });

    // Volume validation
    if (signal === 'BUY' && hasVolumeExpansion) {
      patternComponent += 10;
      reasons.push(`Volume expands to ${((volume / volSma20) || 1).toFixed(1)}x of 20-period average (buying pressure).`);
    } else if (signal === 'SELL' && hasVolumeExpansion) {
      patternComponent -= 10;
      reasons.push(`Volume expands to ${((volume / volSma20) || 1).toFixed(1)}x of 20-period average (selling pressure).`);
    }

    const patternScore = Math.max(0, Math.min(100, patternComponent));

    // 5. News Sentiment Pillar Score (0 - 100)
    // Only apply live news sentiment to the active live candle
    const isLatestCandle = idx === enrichedCandles.length - 1;
    const finalNewsScore = isLatestCandle ? newsSentimentScore : 50;

    // 6. Calculate Unified Score (0 - 100)
    const finalScore = Math.round((trendScore + oscillatorScore + patternScore + finalNewsScore) / 4);

    // 7. Map Unified Score back to Signal Recommendations
    // >= 75: Strong Buy, >= 60: Buy, <= 25: Strong Sell, <= 40: Sell, 41-59: Hold
    if (finalScore >= 60) {
      signal = 'BUY';
    } else if (finalScore <= 40) {
      signal = 'SELL';
    } else {
      signal = 'HOLD';
    }

    // Determine confidence based on final score alignment
    let confidence = null;
    if (signal === 'BUY') {
      confidence = finalScore >= 75 ? 'HIGH' : finalScore >= 65 ? 'MEDIUM' : 'LOW';
      if (finalScore >= 75) reasons.push('Strong Buy recommendation: Technical trend, indicators, and volume pattern match key support.');
    } else if (signal === 'SELL') {
      confidence = finalScore <= 25 ? 'HIGH' : finalScore <= 35 ? 'MEDIUM' : 'LOW';
      if (finalScore <= 25) reasons.push('Strong Sell recommendation: Technical indicators indicate trend failure near resistance.');
    }

    if (signal === 'HOLD') {
      confidence = null;
      reasons = reasons.length > 0 ? reasons : ['Stock is trading in range. Wait for breakout or support retest.'];
    }

    return {
      ...candle,
      signal,
      confidence,
      score: finalScore,
      reason: reasons.join(' '),
      nearestSupport,
      nearestResistance
    };
  });
}
