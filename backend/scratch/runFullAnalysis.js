import { fetchStockData } from '../services/dataService.js';
import { enrichWithIndicators } from '../services/indicatorService.js';
import { detectPatterns } from '../services/patternService.js';
import { generateSignals } from '../services/signalService.js';
import { generateProjections } from '../services/predictiveEngine.js';
import { fetchGlobalIndicators, calculatePredictiveTrend } from '../services/macroService.js';
import fs from 'fs';
import path from 'path';

async function runFullAnalysis() {
  const tickers = ['INFY.NS', 'PFC.NS', 'IDEA.NS'];
  console.log(`Starting full AI Confluence & Predictive analysis for: ${tickers.join(', ')}\n`);
  
  let markdown = `# Aladdin AI Confluence & Predictive Projections Audit\n\n`;
  markdown += `*Generated on: ${new Date().toUTCString()}*\n`;
  markdown += `*Analysis Mode: Volatility-Scaled 90% Confidence Interval & Multi-Factor Score-Biasing*\n\n`;

  // Fetch global macro indicators first
  let globalMacro = [];
  try {
    globalMacro = await fetchGlobalIndicators();
  } catch (e) {
    console.error("Failed to fetch global macro indicators:", e.message);
  }

  for (const ticker of tickers) {
    try {
      console.log(`Analyzing ${ticker}...`);
      // 1. Fetch historical candles (250 daily candles to support SMA 200)
      const rawCandles = await fetchStockData(ticker, '1d', 1);
      if (rawCandles.length < 50) {
        console.warn(`Insufficient history for ${ticker}`);
        continue;
      }

      // 2. Calculate Indicators & Detect Patterns
      const indicatorCandles = enrichWithIndicators(rawCandles);
      const enrichedCandles = detectPatterns(indicatorCandles);

      // 3. Generate Confluence signals
      const signals = generateSignals(enrichedCandles);
      const latestSignal = signals[signals.length - 1];

      // 4. Macro correlation analysis
      const macroCorrelation = calculatePredictiveTrend(ticker, latestSignal.score, globalMacro);

      // 5. Calculate Daily Volatility (standard deviation of daily returns)
      let dailyReturns = [];
      for (let i = 1; i < rawCandles.length; i++) {
        const ret = (rawCandles[i].close - rawCandles[i - 1].close) / rawCandles[i - 1].close;
        dailyReturns.push(ret);
      }
      const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
      const dailyVol = Math.sqrt(variance);

      // 6. Generate Projections from Predictive Engine
      const currentPrice = latestSignal.close;
      const unifiedScore = latestSignal.score;
      const projections = generateProjections(currentPrice, dailyVol, [], unifiedScore, latestSignal);

      // 7. Append to markdown
      const cat = ticker === 'INFY.NS' ? 'LARGE-CAP' : ticker === 'PFC.NS' ? 'MEDIUM-CAP' : 'PENNY';
      markdown += `## 📈 Asset Audit: ${ticker} (${cat})\n\n`;
      markdown += `### 🌐 Macro Telemetry Diagnosis\n`;
      markdown += `* **Macro Score**: ${macroCorrelation.macroScore >= 0 ? '+' : ''}${macroCorrelation.macroScore}\n`;
      markdown += `* **Macro Sentiment**: **${macroCorrelation.macroSentiment}**\n`;
      markdown += `* **Projected Trend**: **${macroCorrelation.projectedTrend}** (${macroCorrelation.confidence}% Confidence)\n`;
      markdown += `* **Diagnosis Brief**: ${macroCorrelation.reasoning}\n\n`;

      markdown += `### 🔍 Technical Telemetry\n`;
      markdown += `* **Current Close Price**: ₹${currentPrice.toFixed(2)}\n`;
      markdown += `* **Unified Score**: ${unifiedScore}/100 (Signal: ${latestSignal.signal})\n`;
      markdown += `* **Daily Volatility (30-day)**: ${(dailyVol * 100).toFixed(2)}%\n`;
      markdown += `* **Oscillator Status (RSI)**: ${latestSignal.rsi ? latestSignal.rsi.toFixed(1) : 'N/A'}\n`;
      markdown += `* **MACD Histogram**: ${latestSignal.macd?.histogram ? latestSignal.macd.histogram.toFixed(2) : 'N/A'}\n`;
      markdown += `* **S/R Levels**: Support @ ₹${latestSignal.nearestSupport.toFixed(2)} | Resistance @ ₹${latestSignal.nearestResistance.toFixed(2)}\n\n`;

      markdown += `### 🎯 Algorithmic Projections (90% Confidence Interval)\n`;
      markdown += `#### 🗓️ Short-Term Horizon (5-Session Target)\n`;
      markdown += `* **Target Range**: **₹${projections.shortTerm.targetMin}** to **₹${projections.shortTerm.targetMax}**\n`;
      markdown += `* **Expected Change**: ${projections.shortTerm.expectedReturnPercent >= 0 ? '+' : ''}${projections.shortTerm.expectedReturnPercent}%\n`;
      markdown += `* **Forecasting Trend**: **${projections.shortTerm.trend}** (${projections.shortTerm.confidence}% Confidence)\n`;
      markdown += `* **Analysis Summary**: ${projections.shortTerm.analysis}\n\n`;

      markdown += `#### 🗓️ Medium-Term Horizon (20-Session / 4-Week Target)\n`;
      markdown += `* **Target Range**: **₹${projections.mediumTerm.targetMin}** to **₹${projections.mediumTerm.targetMax}**\n`;
      markdown += `* **Expected Change**: ${projections.mediumTerm.expectedReturnPercent >= 0 ? '+' : ''}${projections.mediumTerm.expectedReturnPercent}%\n`;
      markdown += `* **Forecasting Trend**: **${projections.mediumTerm.trend}** (${projections.mediumTerm.confidence}% Confidence)\n`;
      markdown += `* **Analysis Summary**: ${projections.mediumTerm.analysis}\n\n`;

      markdown += `### 💡 AI Analyst Highlights & Catalyst Warnings\n`;
      markdown += `* **Highlights**:\n`;
      projections.highlights.forEach(h => {
        markdown += `  * 🟢 ${h}\n`;
      });
      markdown += `* **Warnings**:\n`;
      projections.warnings.forEach(w => {
        markdown += `  * 🔴 ${w}\n`;
      });
      markdown += `\n---\n\n`;

    } catch (err) {
      console.error(`Failed to analyze ${ticker}:`, err);
    }
  }

  // Save report artifact
  const artifactPath = path.join(process.cwd(), '..', '..', 'brain', '2d33729f-74d2-4ecc-b13b-89656ce7f78b', 'live_market_ai_audit.md');
  fs.writeFileSync(artifactPath, markdown);
  console.log(`Successfully generated and cached report to: ${artifactPath}`);
}

runFullAnalysis();
