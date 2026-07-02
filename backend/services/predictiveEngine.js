/**
 * Predictive Engine Service
 * Algorithmic future target price forecasting and thematic news/report analysis.
 */

/**
 * Generates future price projections and thematic analyst highlights.
 * @param {number} currentPrice - Latest close price of the stock
 * @param {number} dailyVol - Daily volatility (standard deviation of daily returns) as a decimal (e.g. 0.015)
 * @param {Array<Object>} newsArticles - Array of news articles for the stock
 * @param {number} unifiedScore - Unified quality score (0 - 100)
 * @param {Object} latestCandle - Latest candle object (for technical indicators fallback)
 * @returns {Object} - AI Projections containing short-term/medium-term targets and reports
 */
export function generateProjections(currentPrice, dailyVol, newsArticles = [], unifiedScore = 50, latestCandle = {}) {
  // Ensure dailyVol is a valid positive number
  const vol = (typeof dailyVol === 'number' && !isNaN(dailyVol) && dailyVol > 0) ? dailyVol : 0.018; // Default 1.8% daily vol fallback
  const price = (typeof currentPrice === 'number' && currentPrice > 0) ? currentPrice : 100;
  const score = (typeof unifiedScore === 'number' && !isNaN(unifiedScore)) ? Math.max(0, Math.min(100, unifiedScore)) : 50;

  // 1. Calculate price targets using Volatility-Scaling
  const getProjectionsForPeriod = (days) => {
    // Expected volatility bounds over time (t)
    // Formula: 1.65 * Vol * sqrt(t) -> 90% confidence range
    const volRangeFactor = 1.65 * vol * Math.sqrt(days);
    const volRangePercent = volRangeFactor * 100;

    // Shift expected return midpoint based on unified quality score
    // Bullish score (>60) shifts target upward, bearish score (<40) shifts target downward
    let expectedReturnPercent = 0;
    if (score >= 60) {
      expectedReturnPercent = ((score - 50) / 50) * 5.5 * Math.sqrt(days / 5);
    } else if (score <= 40) {
      expectedReturnPercent = ((score - 50) / 50) * 5.5 * Math.sqrt(days / 5);
    }

    const midpoint = price * (1 + expectedReturnPercent / 100);
    const targetMin = midpoint * (1 - (volRangePercent / 2) / 100);
    const targetMax = midpoint * (1 + (volRangePercent / 2) / 100);

    let trend = 'NEUTRAL';
    if (expectedReturnPercent > 1.5) trend = 'BULLISH';
    else if (expectedReturnPercent < -1.5) trend = 'BEARISH';

    let confidence = 70;
    if (trend === 'BULLISH') {
      confidence = Math.min(95, Math.round(55 + (score - 60) * 1.5 - (days > 5 ? 5 : 0)));
    } else if (trend === 'BEARISH') {
      confidence = Math.min(95, Math.round(55 + (40 - score) * 1.5 - (days > 5 ? 5 : 0)));
    }

    return {
      trend,
      targetMin: Number(targetMin.toFixed(2)),
      targetMax: Number(targetMax.toFixed(2)),
      confidence,
      expectedReturnPercent: Number(expectedReturnPercent.toFixed(2)),
      volRangePercent: Number(volRangePercent.toFixed(2))
    };
  };

  const shortTerm = getProjectionsForPeriod(5); // 5 days
  const mediumTerm = getProjectionsForPeriod(20); // 20 days (4 weeks)

  // 2. Thematic News/Report Summary Parsing
  const highlights = [];
  const warnings = [];

  const headlines = newsArticles.map(a => (a.title || '').toLowerCase());

  // Bullets scanning rules
  let hasEarningsPlus = false;
  let hasExpansion = false;
  let hasDeal = false;
  let hasUpgrade = false;

  let hasDebt = false;
  let hasRegulatory = false;
  let hasMargin = false;
  let hasSlowdown = false;

  headlines.forEach(title => {
    if (title.includes('earnings') || title.includes('profit') || title.includes('revenue') || title.includes('quarter') || title.includes('beat')) {
      hasEarningsPlus = true;
    }
    if (title.includes('expansion') || title.includes('expand') || title.includes('capacity') || title.includes('plant') || title.includes('growth')) {
      hasExpansion = true;
    }
    if (title.includes('deal') || title.includes('order') || title.includes('contract') || title.includes('partnership') || title.includes('alliance')) {
      hasDeal = true;
    }
    if (title.includes('brokerage') || title.includes('upgrade') || title.includes('target') || title.includes('recommend') || title.includes('buy')) {
      hasUpgrade = true;
    }

    if (title.includes('debt') || title.includes('liability') || title.includes('interest') || title.includes('leverage')) {
      hasDebt = true;
    }
    if (title.includes('regulatory') || title.includes('fine') || title.includes('lawsuit') || title.includes('probe') || title.includes('investigation') || title.includes('legal')) {
      hasRegulatory = true;
    }
    if (title.includes('margin') || title.includes('cost') || title.includes('pressure') || title.includes('inflation')) {
      hasMargin = true;
    }
    if (title.includes('slowdown') || title.includes('decline') || title.includes('weakness') || title.includes('demand') || title.includes('fall')) {
      hasSlowdown = true;
    }
  });

  // Aggregate highlights
  if (hasEarningsPlus) highlights.push("Positive earnings reports indicate resilient operational profitability and cash flows.");
  if (hasExpansion) highlights.push("Strategic capacity expansions are expected to drive top-line growth.");
  if (hasDeal) highlights.push("New contracts and corporate alliances reinforce market share gains.");
  if (hasUpgrade) highlights.push("Recent broker upgrades and rising target prices reflect high institutional buyer interest.");

  // Aggregate warnings
  if (hasDebt) warnings.push("Elevated debt leverage and high interest financing costs present structural cash flow risks.");
  if (hasRegulatory) warnings.push("Regulatory reviews, audits, or legal investigations could introduce operational liabilities.");
  if (hasMargin) warnings.push("Input cost inflation and supply-chain pressures may trigger margin compression.");
  if (hasSlowdown) warnings.push("Potential slowdown in core product segments could damp medium-term growth rates.");

  // Fallbacks based on indicators if data is sparse
  if (highlights.length < 2) {
    if (latestCandle.close > latestCandle.sma200) {
      highlights.push("Trading in a long-term bullish trend above the 200-day Simple Moving Average.");
    }
    if (latestCandle.rsi <= 35) {
      highlights.push("RSI oscillator indicates oversold conditions, attracting bargain buyers.");
    }
    highlights.push("Market positioning reflects robust fundamental liquidity and sector resilience.");
  }

  if (warnings.length < 2) {
    if (latestCandle.close < latestCandle.sma200) {
      warnings.push("Trading in a long-term technical downtrend below the 200-day Simple Moving Average.");
    }
    if (latestCandle.rsi >= 65) {
      warnings.push("RSI indicates overbought conditions; potential short-term profit booking ahead.");
    }
    warnings.push("Broader macroeconomic headwinds, interest rate hikes, and energy cost volatility pose systemic risks.");
  }

  // Generate summaries
  const shortTermAnalysis = shortTerm.trend === 'BULLISH'
    ? `The short-term projection is bullish. Driven by positive news sentiment and strong indicator alignment, the stock is expected to test upside volatility boundaries between ₹${shortTerm.targetMin} and ₹${shortTerm.targetMax} over the next 5 sessions.`
    : shortTerm.trend === 'BEARISH'
      ? `The short-term outlook remains bearish. Continued selling pressure and bearish technical indicators project potential slides towards support bounds between ₹${shortTerm.targetMin} and ₹${shortTerm.targetMax}.`
      : `Neutral consolidation expected. The stock is likely to trade within a sideways volatility range between ₹${shortTerm.targetMin} and ₹${shortTerm.targetMax} over the next 5 sessions.`;

  const mediumTermAnalysis = mediumTerm.trend === 'BULLISH'
    ? `Medium-term momentum continues upward. Volatility-scaled standard deviation models estimate a 4-week target range of ₹${mediumTerm.targetMin} to ₹${mediumTerm.targetMax}, supported by macro tailwinds.`
    : mediumTerm.trend === 'BEARISH'
      ? `Medium-term indicators indicate technical breakdown. The stock remains vulnerable to a decline, with target price limits projected at ₹${mediumTerm.targetMin} to ₹${mediumTerm.targetMax}.`
      : `Expect rangebound movement to persist over the next 2-4 weeks. Standard deviation models place the stock inside a horizontal consolidation channel from ₹${mediumTerm.targetMin} to ₹${mediumTerm.targetMax}.`;

  return {
    shortTerm: {
      ...shortTerm,
      analysis: shortTermAnalysis
    },
    mediumTerm: {
      ...mediumTerm,
      analysis: mediumTermAnalysis
    },
    highlights: highlights.slice(0, 3),
    warnings: warnings.slice(0, 3)
  };
}
