import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchStockData, fetchRealTimeQuote, fetchStockNews, yahooFinance } from './services/dataService.js';
import { enrichWithIndicators, calculateSupportResistance } from './services/indicatorService.js';
import { detectPatterns } from './services/patternService.js';
import { generateSignals } from './services/signalService.js';
import { runBacktest } from './services/backtestService.js';
import { fetchGlobalIndicators, calculatePredictiveTrend } from './services/macroService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so the React frontend (running on a different port like 5173) can access the API
app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/**
 * Route: GET /api/stock/:symbol/history
 * Query params:
 * - interval: '1m' | '5m' | '15m' | '1h' | '1d' (default: '1d')
 * - years: number (default: 5)
 */
app.get('/api/stock/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1d', years = 5 } = req.query;

  try {
    // Fetch news sentiment first to pass to signals
    const newsData = await fetchStockNews(symbol);
    const newsSentimentScore = newsData ? newsData.sentimentScore : 50;

    const rawCandles = await fetchStockData(symbol, interval, Number(years));
    const enrichedCandles = enrichWithIndicators(rawCandles);
    const patternedCandles = detectPatterns(enrichedCandles);
    const signaledCandles = generateSignals(patternedCandles, { newsSentimentScore });

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      interval,
      count: signaledCandles.length,
      candles: signaledCandles,
      newsSentimentScore
    });
  } catch (error) {
    console.error(`Error in /api/stock/${symbol}/history:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route: GET /api/stock/:symbol/intelligence
 */
app.get('/api/stock/:symbol/intelligence', async (req, res) => {
  const { symbol } = req.params;

  try {
    const newsData = await fetchStockNews(symbol);
    
    // Fetch 1 year of daily historical candles to compute support & resistance and range
    const rawCandles = await fetchStockData(symbol, '1d', 1);
    const enrichedCandles = enrichWithIndicators(rawCandles);
    const patternedCandles = detectPatterns(enrichedCandles);
    const signaledCandles = generateSignals(patternedCandles, { newsSentimentScore: newsData.sentimentScore });

    const latestCandle = signaledCandles[signaledCandles.length - 1];
    const { support, resistance } = calculateSupportResistance(signaledCandles);

    // Calculate 52-week High and Low extremes
    const highs = signaledCandles.map(c => c.high);
    const lows = signaledCandles.map(c => c.low);
    const yearlyHigh = Math.max(...highs);
    const yearlyLow = Math.min(...lows);

    // Map numerical score to friendly recommendation label
    // Scale: Strong Buy (>=75), Buy (>=60), Hold (41-59), Sell (<=40), Strong Sell (<=25)
    let label = 'HOLD';
    if (latestCandle.score >= 75) label = 'STRONG BUY';
    else if (latestCandle.score >= 60) label = 'BUY';
    else if (latestCandle.score <= 25) label = 'STRONG SELL';
    else if (latestCandle.score <= 40) label = 'SELL';

    // Fetch and calculate global macroeconomic predictive trends
    const globalMacro = await fetchGlobalIndicators();
    const predictiveTrend = calculatePredictiveTrend(symbol, {
      unifiedScore: latestCandle.score,
      recommendation: label,
      price: latestCandle.close
    }, globalMacro);

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      price: latestCandle.close,
      support,
      resistance,
      yearlyHigh,
      yearlyLow,
      unifiedScore: latestCandle.score,
      recommendation: label,
      newsSentiment: newsData.newsSentiment,
      newsSentimentScore: newsData.sentimentScore,
      newsMetrics: newsData.metrics,
      articles: newsData.articles,
      predictiveTrend
    });
  } catch (error) {
    console.error(`Error in /api/stock/${symbol}/intelligence:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route: GET /api/stock/:symbol/backtest
 * Query params:
 * - interval: '1m' | '5m' | '15m' | '1h' | '1d' (default: '1d')
 * - years: number (default: 5)
 * - sl: stop loss percent (default: 2.5)
 * - tp: take profit percent (default: 5.0)
 * - confidence: comma separated string e.g. "HIGH,MEDIUM" (default: "HIGH,MEDIUM")
 */
app.get('/api/stock/:symbol/backtest', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1d', years = 5, sl = 2.5, tp = 5.0, confidence = 'HIGH,MEDIUM' } = req.query;

  try {
    const rawCandles = await fetchStockData(symbol, interval, Number(years));
    const enrichedCandles = enrichWithIndicators(rawCandles);
    const patternedCandles = detectPatterns(enrichedCandles);
    const signaledCandles = generateSignals(patternedCandles);

    const confidenceFilter = confidence.split(',');
    const results = runBacktest(signaledCandles, {
      stopLossPercent: Number(sl),
      takeProfitPercent: Number(tp),
      confidenceFilter
    });

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      interval,
      parameters: {
        stopLossPercent: Number(sl),
        takeProfitPercent: Number(tp),
        confidenceFilter
      },
      results
    });
  } catch (error) {
    console.error(`Error in /api/stock/${symbol}/backtest:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route: GET /api/stock/:symbol/quote
 */
app.get('/api/stock/:symbol/quote', async (req, res) => {
  const { symbol } = req.params;

  try {
    const quote = await fetchRealTimeQuote(symbol);
    res.json({
      success: true,
      quote
    });
  } catch (error) {
    console.error(`Error in /api/stock/${symbol}/quote:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route: GET /api/stock/search
 * Query params:
 * - q: search query string
 */
app.get('/api/stock/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
  }

  try {
    const rawResult = await yahooFinance.search(q);
    
    // Filter out equities in NSE and BSE
    const equities = (rawResult.quotes || [])
      .filter(item => item.quoteType === 'EQUITY' && item.symbol && (item.symbol.endsWith('.NS') || item.symbol.endsWith('.BO')))
      .map(item => ({
        symbol: item.symbol,
        name: item.shortname || item.longname || item.symbol,
        exchange: item.exchange
      }));

    res.json({
      success: true,
      query: q,
      results: equities
    });
  } catch (error) {
    console.error(`Error in /api/stock/search for query "${q}":`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong on the server'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
