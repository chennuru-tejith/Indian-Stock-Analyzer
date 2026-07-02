import { yahooFinance } from './dataService.js';

/**
 * Fetches real-time quotes for global macroeconomic indicators.
 * @returns {Promise<Array<Object>>} - Array of global indicators with current price and changes.
 */
export async function fetchGlobalIndicators() {
  const symbols = ['^GSPC', '^IXIC', 'CL=F', 'USDINR=X', 'GC=F', '^TNX'];
  const nameMapping = {
    '^GSPC': 'S&P 500',
    '^IXIC': 'NASDAQ Composite',
    'CL=F': 'Crude Oil Futures',
    'USDINR=X': 'USD / INR',
    'GC=F': 'Gold Futures',
    '^TNX': 'US 10Y Bond Yield'
  };

  try {
    const quotes = await yahooFinance.quote(symbols);
    const quotesList = Array.isArray(quotes) ? quotes : (quotes ? [quotes] : []);
    
    return symbols.map(symbol => {
      const q = quotesList.find(item => item.symbol === symbol) || {};
      return {
        symbol,
        name: nameMapping[symbol] || symbol,
        price: q.regularMarketPrice || q.postMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0
      };
    });
  } catch (error) {
    console.error('Error fetching global indicators in macroService:', error.message);
    // Fallback in case of API error, return empty/placeholder structures
    return symbols.map(symbol => ({
      symbol,
      name: nameMapping[symbol] || symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      error: true
    }));
  }
}

/**
 * Combines local technical data with global macro data to project the stock's next trend.
 * @param {string} stockSymbol - Active stock symbol (e.g. "RELIANCE.NS")
 * @param {Object} localIntel - Results from local indicators & sentiment calculation
 * @param {Array<Object>} globalMacro - List of global macroeconomic indicators
 * @returns {Object} - Next trend projection, macro score, confidence, and reasoning
 */
export function calculatePredictiveTrend(stockSymbol, localIntel, globalMacro) {
  const symbolMap = {};
  globalMacro.forEach(asset => {
    symbolMap[asset.symbol] = asset;
  });

  const sp500 = symbolMap['^GSPC'] || { price: 0, changePercent: 0 };
  const nasdaq = symbolMap['^IXIC'] || { price: 0, changePercent: 0 };
  const crude = symbolMap['CL=F'] || { price: 0, changePercent: 0 };
  const usdinr = symbolMap['USDINR=X'] || { price: 0, changePercent: 0 };
  const gold = symbolMap['GC=F'] || { price: 0, changePercent: 0 };
  const us10y = symbolMap['^TNX'] || { price: 0, changePercent: 0 };

  // 1. Calculate weighted scores from -100 to 100 for each asset
  // Volatility scaling: We scale the percentage changes to map typical daily moves to -100..100
  const scoreSP500 = Math.max(-100, Math.min(100, (sp500.changePercent || 0) * 60)); // Typical move: 1.5%
  const scoreNasdaq = Math.max(-100, Math.min(100, (nasdaq.changePercent || 0) * 50)); // Typical move: 2.0%
  const scoreCrude = Math.max(-100, Math.min(100, -(crude.changePercent || 0) * 30)); // High oil is BEARISH (inverse correlation)
  const scoreUsdInr = Math.max(-100, Math.min(100, -(usdinr.changePercent || 0) * 150)); // Depreciating Rupee is BEARISH (inverse correlation)
  const scoreGold = Math.max(-100, Math.min(100, -(gold.changePercent || 0) * 40)); // Safe haven rise is BEARISH (inverse correlation)
  const scoreYields = Math.max(-100, Math.min(100, -(us10y.changePercent || 0) * 30)); // High yields are BEARISH (inverse correlation)

  // 2. Global Macro Sentiment Score as a weighted average
  // Weights: S&P 500 (25%), Nasdaq (20%), Crude Oil (15%), USD/INR (20%), Gold (10%), US 10Y Yield (10%)
  const macroScore = Math.round(
    (scoreSP500 * 0.25) +
    (scoreNasdaq * 0.20) +
    (scoreCrude * 0.15) +
    (scoreUsdInr * 0.20) +
    (scoreGold * 0.10) +
    (scoreYields * 0.10)
  );

  let macroSentiment = 'NEUTRAL';
  if (macroScore >= 15) macroSentiment = 'BULLISH';
  else if (macroScore <= -15) macroSentiment = 'BEARISH';

  // 3. Predictive Next Trend Alignment
  const localScore = localIntel.unifiedScore || 50;
  let projectedTrend = 'SIDEWAYS CONSOLIDATION';
  let direction = 'SIDEWAYS';
  let confidence = 70;

  if (localScore >= 60) { // Local is Bullish
    if (macroScore >= 15) {
      projectedTrend = 'BULLISH CONTINUATION';
      direction = 'UP';
      confidence = Math.min(98, Math.round(localScore + macroScore * 0.2));
    } else if (macroScore <= -15) {
      projectedTrend = 'BULLISH BUT MACRO HEADWINDS';
      direction = 'SIDEWAYS_UP';
      confidence = Math.max(50, Math.round(localScore + macroScore * 0.3));
    } else {
      projectedTrend = 'BULLISH ACCELERATION';
      direction = 'UP';
      confidence = Math.round(localScore);
    }
  } else if (localScore <= 40) { // Local is Bearish
    if (macroScore <= -15) {
      projectedTrend = 'BEARISH CONTINUATION';
      direction = 'DOWN';
      confidence = Math.min(98, Math.round((100 - localScore) + Math.abs(macroScore) * 0.2));
    } else if (macroScore >= 15) {
      projectedTrend = 'BEARISH BUT MACRO CUSHIONED';
      direction = 'SIDEWAYS_DOWN';
      confidence = Math.max(50, Math.round((100 - localScore) - macroScore * 0.3));
    } else {
      projectedTrend = 'BEARISH PRESSURE';
      direction = 'DOWN';
      confidence = Math.round(100 - localScore);
    }
  } else { // Local is Neutral
    if (macroScore >= 25) {
      projectedTrend = 'BULLISH REVERSAL (MACRO DRIVEN)';
      direction = 'SIDEWAYS_UP';
      confidence = Math.min(95, Math.round(50 + macroScore * 0.5));
    } else if (macroScore <= -25) {
      projectedTrend = 'BEARISH BREAKDOWN (MACRO DRIVEN)';
      direction = 'SIDEWAYS_DOWN';
      confidence = Math.min(95, Math.round(50 + Math.abs(macroScore) * 0.5));
    } else {
      projectedTrend = 'SIDEWAYS CONSOLIDATION';
      direction = 'SIDEWAYS';
      confidence = 70;
    }
  }

  // 4. Econ-Correlation Reasoning Generator
  const cleanSymbol = stockSymbol.split('.')[0];
  const localStrength = localScore >= 75 ? 'exceptionally strong' : localScore >= 60 ? 'bullish' : localScore <= 25 ? 'exceptionally weak' : localScore <= 40 ? 'bearish' : 'neutral, rangebound';
  const macroSummary = macroScore >= 25 ? 'strongly supportive' : macroScore >= 15 ? 'mildly bullish' : macroScore <= -25 ? 'severe macroeconomic headwinds' : macroScore <= -15 ? 'bearish' : 'relatively neutral';

  let reasoning = `${cleanSymbol} exhibits a ${localStrength} technical structure locally, with a Local Quality Score of ${localScore}/100. `;

  if (macroSentiment === 'BULLISH') {
    reasoning += `This momentum is reinforced by a ${macroSummary} global macroeconomic setup (Macro Score: +${macroScore}). `;
    reasoning += `Positive trading in the S&P 500 (${(sp500.changePercent || 0).toFixed(2)}%) and NASDAQ (${(nasdaq.changePercent || 0).toFixed(2)}%) suggests high global risk-on appetite, which typically increases Foreign Institutional Investor (FII) equity inflows into India. `;
    if (crude.changePercent < 0) {
      reasoning += `Moreover, easing Brent Crude prices (${(crude.changePercent || 0).toFixed(2)}%) reduce input cost pressures and trade deficits for the Indian economy, acting as a tailwind. `;
    }
  } else if (macroSentiment === 'BEARISH') {
    reasoning += `However, global factors are introducing ${macroSummary} (Macro Score: ${macroScore}). `;
    reasoning += `A downturn in the US indices (S&P 500: ${(sp500.changePercent || 0).toFixed(2)}%) indicates risk-off global sentiment. `;
    if (crude.changePercent > 0) {
      reasoning += `This is compounded by rising crude oil prices (+${(crude.changePercent || 0).toFixed(2)}%), which increase domestic inflation and strain the current account. `;
    }
    if (usdinr.changePercent > 0) {
      reasoning += `Additionally, a depreciating Indian Rupee against the USD (+${(usdinr.changePercent || 0).toFixed(2)}%) increases the risk of FII capital flight from Emerging Markets. `;
    }
  } else {
    reasoning += `Meanwhile, global indices and currencies are stable and trading in a tight band, meaning domestic triggers and local indicators will primary dictate price actions. `;
  }

  if (us10y.changePercent > 0.8) {
    reasoning += `The sharp increase in the US 10-Year Bond Yield (+${(us10y.changePercent || 0).toFixed(2)}% to ${(us10y.price || 0).toFixed(3)}%) serves as a macro warning, creating valuation pressures on high-growth companies. `;
  }

  reasoning += `Considering these factors, our predictive model projects a ${projectedTrend.toLowerCase()} with a confidence level of ${confidence}%.`;

  return {
    macroScore,
    macroSentiment,
    projectedTrend,
    direction,
    confidence,
    reasoning,
    indicators: globalMacro
  };
}
