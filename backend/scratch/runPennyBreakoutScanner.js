/**
 * ============================================================================
 * ALADDIN AI — SECTOR-WIDE PENNY STOCK BREAKOUT EXPLOSION SCANNER
 * ============================================================================
 * 
 * Scans 100+ penny stocks (< ₹100) across ALL major Indian market sectors:
 *   - Energy & Power, Banking & Finance, Telecom, Metals & Mining,
 *   - Infrastructure, Real Estate, Textiles, Sugar, IT & Tech,
 *   - Pharma, Auto, Chemicals, Media & Entertainment
 * 
 * For each stock, the scanner evaluates 8 technical breakout signals:
 *   1. Volume Explosion (RVOL ≥ 2.0x in last 5 sessions)
 *   2. Price Compression → Expansion (Bollinger Squeeze breakout)
 *   3. 52-Week Low Reversal (bouncing off yearly low zone)
 *   4. Moving Average Crossover (20 EMA crossing above 50 SMA)
 *   5. RSI Momentum Shift (crossing above 50 from oversold territory)
 *   6. Accumulation Detection (rising OBV + bullish candle ratio)
 *   7. Base Breakout (price breaking above 20-day consolidation high)
 *   8. Institutional Footprint (large volume candles with tight close near high)
 * 
 * Output: Ranked list of penny stocks with "Explosion Probability" score (0-100)
 * ============================================================================
 */

import { yahooFinance } from '../services/dataService.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// SECTOR-WISE PENNY STOCK UNIVERSE (< ₹100)
// ============================================================================
const SECTOR_PENNY_STOCKS = {
  'Energy & Power': [
    'SUZLON.NS', 'JPPOWER.NS', 'RPOWER.NS', 'URJA.NS', 'NHPC.NS',
    'SJVN.NS', 'IREDA.NS', 'NTPC.NS', 'TATAPOWER.NS', 'ADANIGREEN.NS',
    'GREENPOWER.NS', 'ORIENTGREEN.NS', 'KPI.NS', 'GAIL.NS'
  ],
  'Banking & Finance': [
    'YESBANK.NS', 'SOUTHBANK.NS', 'IDFCFIRSTB.NS', 'BANDHANBNK.NS',
    'UJJIVANSFB.NS', 'EQUITASBNK.NS', 'CENTRALBK.NS', 'INDIANB.NS',
    'UCOBANK.NS', 'MAHABANK.NS', 'IOB.NS', 'BANKBARODA.NS',
    'CANBK.NS', 'PNBHOUSING.NS', 'SBIN.NS'
  ],
  'Telecom & Media': [
    'IDEA.NS', 'GTLINFRA.NS', 'HFCL.NS', 'TANLA.NS', 'TTML.NS',
    'ONMOBILE.NS', 'RAILTEL.NS'
  ],
  'Metals & Mining': [
    'SAIL.NS', 'NMDC.NS', 'NATIONALUM.NS', 'HINDALCO.NS', 'HINDCOPPER.NS',
    'COALINDIA.NS', 'MOIL.NS', 'VEDL.NS', 'GALLANTT.NS'
  ],
  'Infrastructure & Construction': [
    'GMRINFRA.NS', 'IRFC.NS', 'IRCON.NS', 'RVNL.NS', 'NBCC.NS',
    'HUDCO.NS', 'COCHINSHIP.NS', 'GRSE.NS', 'BEL.NS', 'BEML.NS',
    'JSWINFRA.NS', 'NCC.NS'
  ],
  'Real Estate': [
    'IBREALEST.NS', 'UNITECH.NS', 'JPASSOCIAT.NS', 'DLF.NS',
    'OBEROIRLTY.NS', 'GODREJPROP.NS', 'ANANTRAJ.NS', 'SOBHA.NS'
  ],
  'Textiles & Apparel': [
    'ALOKTEXT.NS', 'RTNPOWER.NS', 'ARVIND.NS', 'RAYMOND.NS',
    'WELSPUNLIV.NS', 'TRIDENT.NS', 'KITEX.NS'
  ],
  'Sugar & Ethanol': [
    'SHREERENUKA.NS', 'BALRAMCHIN.NS', 'DHAMPUR.NS', 'TRIVENI.NS',
    'RAJSREESUG.NS', 'DWARIKESH.NS'
  ],
  'IT & Tech': [
    'RATEGAIN.NS', 'ROUTE.NS', 'MAPMYINDIA.NS', 'NETWEB.NS'
  ],
  'Pharma & Healthcare': [
    'GRANULES.NS', 'MANKIND.NS', 'SUNPHARMA.NS', 'AUROPHARMA.NS',
    'GLENMARK.NS', 'ZYDUSLIFE.NS'
  ],
  'Auto & EV': [
    'ASHOKLEY.NS', 'OLECTRA.NS', 'TATAELXSI.NS', 'EXIDEIND.NS',
    'AMARARAJA.NS'
  ],
  'Chemicals & Fertilizers': [
    'DEEPAKFERT.NS', 'CHAMBLFERT.NS', 'RCF.NS', 'GNFC.NS',
    'FACT.NS', 'NFL.NS'
  ]
};

// Flatten all sectors into a single list
const ALL_PENNY_CANDIDATES = Object.values(SECTOR_PENNY_STOCKS).flat();
// Remove duplicates
const UNIQUE_CANDIDATES = [...new Set(ALL_PENNY_CANDIDATES)];

/**
 * Fetches historical price data for a symbol (last 90 days, daily).
 */
async function fetchHistory(symbol) {
  try {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 120); // ~4 months of daily data

    const result = await yahooFinance.chart(symbol, {
      period1: start.toISOString().split('T')[0],
      interval: '1d'
    });

    if (!result || !result.quotes || result.quotes.length < 20) {
      return null;
    }

    return result.quotes.filter(q => q.close && q.high && q.low && q.volume);
  } catch (err) {
    // Fallback: try historical API
    try {
      const now = new Date();
      const start = new Date();
      start.setDate(now.getDate() - 120);
      const result = await yahooFinance.historical(symbol, {
        period1: start,
        period2: now,
        interval: '1d'
      });
      if (!result || result.length < 20) return null;
      return result.filter(q => q.close && q.high && q.low && q.volume);
    } catch {
      return null;
    }
  }
}

/**
 * Fetches fundamental quote data for a symbol.
 */
async function fetchQuote(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    return quote;
  } catch {
    return null;
  }
}

/**
 * Core Breakout Explosion Analysis Engine.
 * Returns a score from 0-100 indicating "explosion probability" for the next week.
 */
function analyzeBreakoutPotential(candles, quote, symbol) {
  if (!candles || candles.length < 30) return null;

  const n = candles.length;
  const latest = candles[n - 1];
  const price = latest.close;

  // Skip if price > ₹100 (not a penny stock)
  if (price > 100) return null;

  // ---- Helper calculations ----
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Simple Moving Averages
  const sma = (arr, period) => {
    if (arr.length < period) return arr[arr.length - 1];
    const slice = arr.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // Exponential Moving Average
  const ema = (arr, period) => {
    const k = 2 / (period + 1);
    let val = arr[0];
    for (let i = 1; i < arr.length; i++) {
      val = arr[i] * k + val * (1 - k);
    }
    return val;
  };

  // Standard Deviation
  const stdev = (arr, period) => {
    const slice = arr.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slice.length;
    return Math.sqrt(variance);
  };

  // RSI
  const computeRSI = (arr, period = 14) => {
    let gains = 0, losses = 0;
    const slice = arr.slice(-period - 1);
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i] - slice[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // ======================================================================
  // SIGNAL 1: Volume Explosion (RVOL ≥ 2.0x in last 5 sessions)
  // ======================================================================
  const avgVol20 = sma(volumes.slice(-25, -5), 20) || 1;
  const recentVols = volumes.slice(-5);
  const maxRecentVol = Math.max(...recentVols);
  const avgRecentVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const rvol = avgRecentVol / (avgVol20 || 1);
  const rvolPeak = maxRecentVol / (avgVol20 || 1);

  let volumeScore = 0;
  if (rvolPeak >= 3.0) volumeScore = 100;
  else if (rvolPeak >= 2.5) volumeScore = 85;
  else if (rvol >= 2.0) volumeScore = 70;
  else if (rvol >= 1.5) volumeScore = 50;
  else if (rvol >= 1.2) volumeScore = 30;

  // ======================================================================
  // SIGNAL 2: Price Compression → Expansion (Bollinger Squeeze)
  // ======================================================================
  const bbStdev = stdev(closes, 20);
  const bbBasis = sma(closes, 20);
  const bbWidth = bbBasis > 0 ? (bbStdev * 4) / bbBasis * 100 : 10;

  // Check for historical squeeze: compare current BB width vs 50-period average
  const bbWidths = [];
  for (let i = 30; i < n; i++) {
    const slc = closes.slice(i - 20, i);
    const m = slc.reduce((a, b) => a + b, 0) / slc.length;
    const sd = Math.sqrt(slc.reduce((s, v) => s + Math.pow(v - m, 2), 0) / slc.length);
    bbWidths.push(m > 0 ? (sd * 4) / m * 100 : 10);
  }
  const avgBBWidth = bbWidths.length > 0 ? bbWidths.reduce((a, b) => a + b, 0) / bbWidths.length : 10;

  let squeezeScore = 0;
  const isSqueezing = bbWidth < avgBBWidth * 0.7;
  const isBreakingUp = price > bbBasis + bbStdev; // breaking above upper band
  if (isSqueezing && isBreakingUp) squeezeScore = 100;
  else if (isSqueezing) squeezeScore = 60;
  else if (isBreakingUp) squeezeScore = 40;

  // ======================================================================
  // SIGNAL 3: 52-Week Low Reversal (bouncing off yearly low zone)
  // ======================================================================
  const fiftyTwoWeekLow = quote?.fiftyTwoWeekLow || Math.min(...lows);
  const fiftyTwoWeekHigh = quote?.fiftyTwoWeekHigh || Math.max(...highs);
  const distFromLow = fiftyTwoWeekLow > 0 ? ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100 : 50;
  const distFromHigh = fiftyTwoWeekHigh > 0 ? ((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100 : 50;

  let lowReversalScore = 0;
  if (distFromLow <= 10 && distFromLow >= 2) lowReversalScore = 90; // Just bounced off the low
  else if (distFromLow <= 20) lowReversalScore = 60;
  else if (distFromLow <= 30) lowReversalScore = 40;
  // Stock near 52-week high? Less explosion potential (already moved)
  if (distFromHigh <= 5) lowReversalScore = Math.max(0, lowReversalScore - 30);

  // ======================================================================
  // SIGNAL 4: Moving Average Crossover (20 EMA crossing above 50 SMA)
  // ======================================================================
  const ema20 = ema(closes, 20);
  const sma50 = sma(closes, 50);

  // Check if crossover happened in last 5 bars
  let crossoverScore = 0;
  if (closes.length >= 55) {
    const prevEma20 = ema(closes.slice(0, -5), 20);
    const prevSma50 = sma(closes.slice(0, -5), 50);
    const wasBelowBefore = prevEma20 < prevSma50;
    const isAboveNow = ema20 > sma50;
    if (wasBelowBefore && isAboveNow) crossoverScore = 100; // Fresh golden cross!
    else if (isAboveNow) crossoverScore = 50;
  } else if (ema20 > sma50) {
    crossoverScore = 40;
  }

  // ======================================================================
  // SIGNAL 5: RSI Momentum Shift (crossing above 50 from oversold)
  // ======================================================================
  const rsi = computeRSI(closes, 14);
  const prevRSI = computeRSI(closes.slice(0, -3), 14);

  let rsiMomentumScore = 0;
  if (prevRSI < 40 && rsi > 50) rsiMomentumScore = 90; // Massive momentum shift
  else if (prevRSI < 45 && rsi > 55) rsiMomentumScore = 70;
  else if (rsi > 50 && rsi < 70) rsiMomentumScore = 50;
  else if (rsi >= 70) rsiMomentumScore = 20; // Already overbought, less room

  // ======================================================================
  // SIGNAL 6: Accumulation Detection (rising buying pressure)
  // ======================================================================
  // Approximate OBV trend over last 10 candles
  let obvTrend = 0;
  for (let i = n - 10; i < n; i++) {
    if (i > 0) {
      const c = candles[i];
      const prevC = candles[i - 1];
      if (c.close > prevC.close) obvTrend += c.volume;
      else if (c.close < prevC.close) obvTrend -= c.volume;
    }
  }

  // Bullish candle ratio in last 10 bars
  let bullishCandles = 0;
  for (let i = n - 10; i < n; i++) {
    if (candles[i].close > candles[i].open) bullishCandles++;
  }
  const bullRatio = bullishCandles / 10;

  let accumulationScore = 0;
  if (obvTrend > 0 && bullRatio >= 0.7) accumulationScore = 90;
  else if (obvTrend > 0 && bullRatio >= 0.5) accumulationScore = 60;
  else if (obvTrend > 0) accumulationScore = 40;

  // ======================================================================
  // SIGNAL 7: Base Breakout (price breaking above 20-day consolidation high)
  // ======================================================================
  const consolidationHigh = Math.max(...highs.slice(-20, -1));
  const consolidationLow = Math.min(...lows.slice(-20, -1));
  const consolidationRange = consolidationHigh > 0 ? ((consolidationHigh - consolidationLow) / consolidationHigh) * 100 : 10;
  const isTightBase = consolidationRange < 15; // less than 15% range = tight consolidation
  const isBreakingBase = price > consolidationHigh;

  let baseBreakoutScore = 0;
  if (isTightBase && isBreakingBase) baseBreakoutScore = 100; // Tight base breakout!
  else if (isBreakingBase) baseBreakoutScore = 60;
  else if (isTightBase && price > consolidationLow + (consolidationHigh - consolidationLow) * 0.8) baseBreakoutScore = 40;

  // ======================================================================
  // SIGNAL 8: Institutional Footprint (large vol candles with close near high)
  // ======================================================================
  let institutionalScore = 0;
  const recent5 = candles.slice(-5);
  const bigVolCandles = recent5.filter(c => c.volume > avgVol20 * 1.5);
  const strongCloseCandles = bigVolCandles.filter(c => {
    const range = c.high - c.low;
    return range > 0 && (c.close - c.low) / range > 0.7;
  });

  if (strongCloseCandles.length >= 2) institutionalScore = 90;
  else if (strongCloseCandles.length >= 1) institutionalScore = 60;
  else if (bigVolCandles.length >= 2) institutionalScore = 30;

  // ======================================================================
  // COMPOSITE EXPLOSION PROBABILITY SCORE
  // ======================================================================
  const weights = {
    volume: 0.20,
    squeeze: 0.12,
    lowReversal: 0.12,
    crossover: 0.12,
    rsiMomentum: 0.12,
    accumulation: 0.12,
    baseBreakout: 0.10,
    institutional: 0.10
  };

  const explosionScore = Math.round(
    volumeScore * weights.volume +
    squeezeScore * weights.squeeze +
    lowReversalScore * weights.lowReversal +
    crossoverScore * weights.crossover +
    rsiMomentumScore * weights.rsiMomentum +
    accumulationScore * weights.accumulation +
    baseBreakoutScore * weights.baseBreakout +
    institutionalScore * weights.institutional
  );

  // Classify grade
  let explosionGrade = '⬜ LOW POTENTIAL';
  let emoji = '⬜';
  if (explosionScore >= 75) { explosionGrade = '🔴 EXTREME BREAKOUT IMMINENT'; emoji = '🔴'; }
  else if (explosionScore >= 60) { explosionGrade = '🟠 HIGH EXPLOSION POTENTIAL'; emoji = '🟠'; }
  else if (explosionScore >= 45) { explosionGrade = '🟡 MODERATE BREAKOUT SETUP'; emoji = '🟡'; }
  else if (explosionScore >= 30) { explosionGrade = '🟢 EARLY ACCUMULATION'; emoji = '🟢'; }

  // Detect which sector this stock belongs to
  let sector = 'Unknown';
  for (const [sec, syms] of Object.entries(SECTOR_PENNY_STOCKS)) {
    if (syms.includes(symbol)) {
      sector = sec;
      break;
    }
  }

  return {
    symbol,
    sector,
    price: Number(price.toFixed(2)),
    fiftyTwoWeekLow: Number((fiftyTwoWeekLow || 0).toFixed(2)),
    fiftyTwoWeekHigh: Number((fiftyTwoWeekHigh || 0).toFixed(2)),
    distFromLowPct: Number(distFromLow.toFixed(1)),
    distFromHighPct: Number(distFromHigh.toFixed(1)),
    rsi: Number(rsi.toFixed(1)),
    rvol: Number(rvol.toFixed(2)),
    rvolPeak: Number(rvolPeak.toFixed(2)),
    signals: {
      volumeExplosion: volumeScore,
      bollingerSqueeze: squeezeScore,
      lowReversal: lowReversalScore,
      maCrossover: crossoverScore,
      rsiMomentumShift: rsiMomentumScore,
      accumulation: accumulationScore,
      baseBreakout: baseBreakoutScore,
      institutionalFootprint: institutionalScore
    },
    explosionScore,
    explosionGrade,
    emoji
  };
}

// ============================================================================
// MAIN EXECUTION: SECTOR-WIDE SCAN
// ============================================================================
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   🚀 ALADDIN AI — SECTOR-WIDE PENNY STOCK BREAKOUT SCANNER 🚀');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`   Scanning ${UNIQUE_CANDIDATES.length} penny stock candidates across ${Object.keys(SECTOR_PENNY_STOCKS).length} sectors...`);
  console.log(`   Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const results = [];
  const errors = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < UNIQUE_CANDIDATES.length; i += batchSize) {
    const batch = UNIQUE_CANDIDATES.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(UNIQUE_CANDIDATES.length / batchSize);
    process.stdout.write(`   [Batch ${batchNum}/${totalBatches}] Scanning: ${batch.map(s => s.replace('.NS', '')).join(', ')}...`);

    const promises = batch.map(async (sym) => {
      try {
        const [candles, quote] = await Promise.all([
          fetchHistory(sym),
          fetchQuote(sym)
        ]);
        if (!candles) return null;
        return analyzeBreakoutPotential(candles, quote, sym);
      } catch (err) {
        errors.push({ symbol: sym, error: err.message });
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    const valid = batchResults.filter(r => r !== null);
    results.push(...valid);
    console.log(` ✅ (${valid.length} penny stocks found)`);

    // Small delay between batches to be respectful to API
    if (i + batchSize < UNIQUE_CANDIDATES.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Sort by explosion score (highest first)
  results.sort((a, b) => b.explosionScore - a.explosionScore);

  // ======================================================================
  // PRINT RESULTS
  // ======================================================================
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   🏆 TOP PENNY STOCKS — NEXT-WEEK EXPLOSION RANKINGS 🏆');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const top20 = results.slice(0, 20);
  top20.forEach((stock, idx) => {
    const rank = idx + 1;
    console.log(`   ${stock.emoji} #${rank}. ${stock.symbol.replace('.NS', '')} — ₹${stock.price} | Score: ${stock.explosionScore}/100 | ${stock.explosionGrade}`);
    console.log(`      Sector: ${stock.sector} | RSI: ${stock.rsi} | RVOL: ${stock.rvol}x (Peak: ${stock.rvolPeak}x)`);
    console.log(`      52W Range: ₹${stock.fiftyTwoWeekLow} — ₹${stock.fiftyTwoWeekHigh} | From Low: +${stock.distFromLowPct}% | From High: -${stock.distFromHighPct}%`);
    console.log(`      Signals: Vol=${stock.signals.volumeExplosion} | Squeeze=${stock.signals.bollingerSqueeze} | LowBounce=${stock.signals.lowReversal} | MA-Cross=${stock.signals.maCrossover} | RSI-Mom=${stock.signals.rsiMomentumShift} | Accum=${stock.signals.accumulation} | BaseBreak=${stock.signals.baseBreakout} | Inst=${stock.signals.institutionalFootprint}`);
    console.log('');
  });

  // Sector breakdown
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   📊 SECTOR BREAKDOWN — HOTTEST SECTORS THIS WEEK');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const sectorScores = {};
  results.forEach(r => {
    if (!sectorScores[r.sector]) sectorScores[r.sector] = [];
    sectorScores[r.sector].push(r.explosionScore);
  });

  const sectorRanking = Object.entries(sectorScores)
    .map(([sector, scores]) => ({
      sector,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      topScore: Math.max(...scores),
      count: scores.length
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  sectorRanking.forEach((s, idx) => {
    const emoji = s.avgScore >= 50 ? '🔥' : s.avgScore >= 35 ? '⚡' : '💤';
    console.log(`   ${emoji} ${idx + 1}. ${s.sector} — Avg Score: ${s.avgScore}/100 | Top Score: ${s.topScore} | Stocks: ${s.count}`);
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`   ✅ Scan Complete: ${results.length} penny stocks analyzed | ${errors.length} errors`);
  console.log('═══════════════════════════════════════════════════════════════════');

  // Save results to disk
  const reportPath = path.join(process.cwd(), 'scratch', 'penny_breakout_scanner_results.json');
  const parentDir = path.dirname(reportPath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    totalScanned: UNIQUE_CANDIDATES.length,
    pennyStocksFound: results.length,
    errorsCount: errors.length,
    top20Breakouts: top20,
    sectorRanking,
    fullResults: results,
    errors
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`   📁 Full report saved to: ${reportPath}`);
  console.log('');

  return report;
}

main().catch(err => {
  console.error('Fatal error in Penny Breakout Scanner:', err);
  process.exit(1);
});
