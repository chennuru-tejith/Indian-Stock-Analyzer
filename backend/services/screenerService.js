import fs from 'fs';
import path from 'path';
import { yahooFinance } from './dataService.js';

// Cache results file path
const RESULTS_CACHE_PATH = path.join(process.cwd(), 'scratch', 'daily_screener_results.json');

// Categorized screening symbols
export const LARGE_CAP_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS', 'HINDUNILVR.NS',
  'KOTAKBANK.NS', 'AXISBANK.NS', 'TATASTEEL.NS', 'WIPRO.NS'
];

export const MID_CAP_SYMBOLS = [
  'TATAPOWER.NS', 'FEDERALBANK.NS', 'IDFCFIRSTB.NS', 'SAIL.NS',
  'ASHOKLEY.NS', 'REC.NS', 'PFC.NS', 'NHPC.NS', 'GMRINFRA.NS',
  'IRFC.NS', 'HUDCO.NS'
];

export const PENNY_SYMBOLS = [
  'SUZLON.NS', 'IDEA.NS', 'YESBANK.NS', 'JPPOWER.NS', 'SOUTHBANK.NS',
  'ALOKTEXT.NS', 'RPOWER.NS', 'GTLINFRA.NS', 'URJA.NS'
];

const DEFAULT_SYMBOLS = [
  ...LARGE_CAP_SYMBOLS,
  ...MID_CAP_SYMBOLS,
  ...PENNY_SYMBOLS
];

/**
 * Runs the daily fundamental-price divergence screening audit.
 * @param {Array<string>} symbols - Array of stock symbols to screen
 * @returns {Promise<Object>} - Screener report summary
 */
export async function runFundamentalScreener(symbols = DEFAULT_SYMBOLS) {
  const results = [];
  const timestamp = new Date().toISOString();

  // Run fetches in parallel using Promise.allSettled to guarantee robustness
  const promises = symbols.map(async (sym) => {
    try {
      const summary = await yahooFinance.quoteSummary(sym, {
        modules: ['financialData', 'summaryDetail', 'defaultKeyStatistics']
      });

      const detail = summary.summaryDetail || {};
      const financials = summary.financialData || {};
      const stats = summary.defaultKeyStatistics || {};

      // Standardize fundamental inputs
      const currentPrice = financials.currentPrice || detail.previousClose || 100;
      const pe = detail.trailingPE || stats.forwardPE || 999;
      const pb = stats.priceToBook || 999;
      const roe = financials.returnOnEquity || stats.profitMargins || 0.0;
      const de = financials.debtToEquity || 0; // expressed as % in yahoo (e.g. 36.6 means 0.36 D/E)
      const debtToEquityRatio = de / 100;
      const revGrowth = financials.revenueGrowth || 0.0;
      const yrChange = stats['52WeekChange'] || 0.0; // 52 week price return as decimal (e.g. -0.15 for -15%)

      // 1. Calculate Fundamental Score (0 - 100)
      let peScore = 10;
      if (pe < 15) peScore = 30;
      else if (pe < 25) peScore = 20;
      else if (pe < 35) peScore = 15;

      let roeScore = 10;
      if (roe > 0.18) roeScore = 30;
      else if (roe > 0.12) roeScore = 20;
      else if (roe > 0.06) roeScore = 15;

      let deScore = 5;
      if (debtToEquityRatio < 0.5) deScore = 20;
      else if (debtToEquityRatio < 1.0) deScore = 15;
      else if (debtToEquityRatio < 1.5) deScore = 10;

      let growthScore = 5;
      if (revGrowth > 0.15) growthScore = 20;
      else if (revGrowth > 0.06) growthScore = 15;
      else if (revGrowth > 0.0) growthScore = 10;

      const fundamentalScore = peScore + roeScore + deScore + growthScore;

      // 2. Assess Price Lag / Underperformance
      const isPriceLagging = yrChange <= 0.05; // Less than 5% gain in 1 year (laggard)
      const discountTo200MA = detail.twoHundredDayAverage 
        ? ((detail.twoHundredDayAverage - currentPrice) / detail.twoHundredDayAverage) * 100
        : 0;

      // 3. Compute Divergence Score (0 - 100)
      // Higher score means stronger fundamentals + lower/depressed price action
      let divergenceScore = 0;
      if (fundamentalScore >= 60) {
        // Core Value Formula: Fundamental Strength modulated by lack of price return
        const priceLagMultiplier = yrChange <= -0.10 ? 1.3 : yrChange <= 0.0 ? 1.15 : yrChange <= 0.05 ? 1.0 : 0.6;
        const discountBonus = Math.max(0, discountTo200MA * 1.5); // extra weight if trading below 200 SMA
        divergenceScore = Math.round(Math.min(100, (fundamentalScore * priceLagMultiplier) + discountBonus));
      } else {
        // Weak fundamental stocks don't qualify for high value divergence play
        divergenceScore = Math.round(fundamentalScore * 0.5);
      }

      // 4. Rate Opportunity Grade
      let grade = 'HOLD';
      if (divergenceScore >= 80) grade = 'STRONG VALUE BUY (High Divergence)';
      else if (divergenceScore >= 65) grade = 'VALUE BUY (Moderate Divergence)';
      else if (divergenceScore >= 50) grade = 'NEUTRAL VALUE';
      else if (fundamentalScore >= 60) grade = 'FULLY VALUED / ALREADY PRICED IN';
      else grade = 'UNDERPERFORMING / WEAK FUNDAMENTALS';

      const category = PENNY_SYMBOLS.includes(sym) ? 'Penny' : MID_CAP_SYMBOLS.includes(sym) ? 'Medium' : 'Large';

      return {
        symbol: sym,
        success: true,
        category,
        currentPrice,
        pe: Number(pe.toFixed(1)),
        pb: Number(pb.toFixed(2)),
        roePercent: Number((roe * 100).toFixed(1)),
        debtToEquity: Number(debtToEquityRatio.toFixed(2)),
        revenueGrowthPercent: Number((revGrowth * 100).toFixed(1)),
        oneYearReturnPercent: Number((yrChange * 100).toFixed(1)),
        discountTo200MAPercent: Number(discountTo200MA.toFixed(1)),
        fundamentalScore,
        divergenceScore,
        grade
      };
    } catch (err) {
      return {
        symbol: sym,
        success: false,
        error: err.message
      };
    }
  });

  const settled = await Promise.all(promises);
  const successes = settled.filter(s => s.success);
  
  // Sort by highest divergence score (best value plays first)
  const sortedValuePicks = successes.sort((a, b) => b.divergenceScore - a.divergenceScore);

  const report = {
    timestamp,
    totalScreened: symbols.length,
    successCount: successes.length,
    topValuePicks: sortedValuePicks.slice(0, 5), // top 5 value plays
    fullResults: sortedValuePicks
  };

  // Cache/persist results to disk
  try {
    const parentDir = path.dirname(RESULTS_CACHE_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(RESULTS_CACHE_PATH, JSON.stringify(report, null, 2));
  } catch (err) {
    console.error("Failed to write daily screener cache results:", err.message);
  }

  return report;
}

/**
 * Loads cached daily screener results.
 * If cache is stale or empty, triggers a fresh run.
 * @returns {Promise<Object>}
 */
export async function getCachedScreenerResults() {
  try {
    if (fs.existsSync(RESULTS_CACHE_PATH)) {
      const data = fs.readFileSync(RESULTS_CACHE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if cache was written today
      const cacheDate = new Date(parsed.timestamp).toDateString();
      const today = new Date().toDateString();
      if (cacheDate === today) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Cache read failed, running fresh screener:", e.message);
  }
  
  // Run a fresh scan if cache doesn't exist or is from a previous day
  return runFundamentalScreener();
}
