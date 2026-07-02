import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchStockData, fetchRealTimeQuote, fetchStockNews, yahooFinance } from './services/dataService.js';
import { enrichWithIndicators, calculateSupportResistance } from './services/indicatorService.js';
import { detectPatterns } from './services/patternService.js';
import { generateSignals } from './services/signalService.js';
import { runBacktest } from './services/backtestService.js';
import { fetchGlobalIndicators, calculatePredictiveTrend } from './services/macroService.js';
import { generateProjections } from './services/predictiveEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Backend news caching to speed up polling and prevent Yahoo Finance rate limits
const newsCache = {};
const NEWS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes TTL

async function getNewsSentimentCached(symbol) {
  const sym = symbol.trim().toUpperCase();
  const cached = newsCache[sym];
  if (cached && (Date.now() - cached.timestamp < NEWS_CACHE_TTL)) {
    return cached.data;
  }

  const newsData = await fetchStockNews(sym);
  newsCache[sym] = {
    data: newsData,
    timestamp: Date.now()
  };
  return newsData;
}

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
    // Fetch news sentiment from cache first to pass to signals
    const newsData = await getNewsSentimentCached(symbol);
    const newsSentimentScore = newsData ? newsData.sentimentScore : 50;

    const rawCandles = await fetchStockData(symbol, interval, Number(years));
    if (!rawCandles || rawCandles.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No historical candles found for symbol ${symbol.toUpperCase()} at interval ${interval}.`
      });
    }
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
    const newsData = await getNewsSentimentCached(symbol);
    
    // Fetch 1 year of daily historical candles to compute support & resistance and range
    const rawCandles = await fetchStockData(symbol, '1d', 1);
    if (!rawCandles || rawCandles.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Insufficient historical data to analyze symbol ${symbol.toUpperCase()}.`
      });
    }
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

    // Calculate daily returns volatility over the last 30 daily sessions
    const last30 = signaledCandles.slice(-30);
    const returns = [];
    for (let i = 1; i < last30.length; i++) {
      if (last30[i - 1].close > 0) {
        returns.push((last30[i].close - last30[i - 1].close) / last30[i - 1].close);
      }
    }
    let dailyVol = 0.018; // default 1.8% daily standard deviation
    if (returns.length > 5) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      dailyVol = Math.sqrt(variance);
    }

    const projections = generateProjections(latestCandle.close, dailyVol, newsData.articles, latestCandle.score, latestCandle);

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
      newsMetrics: newsData.newsMetrics || newsData.metrics,
      articles: newsData.articles,
      predictiveTrend,
      projections
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
    if (!rawCandles || rawCandles.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Insufficient historical data to backtest symbol ${symbol.toUpperCase()}.`
      });
    }
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

/**
 * Route: GET /api/stock/:symbol/multi-timeframe
 */
app.get('/api/stock/:symbol/multi-timeframe', async (req, res) => {
  const { symbol } = req.params;
  const intervals = ['5m', '15m', '1h', '1d'];

  try {
    const results = await Promise.all(intervals.map(async (interval) => {
      try {
        const rawCandles = await fetchStockData(symbol, interval, 1);
        const enrichedCandles = enrichWithIndicators(rawCandles);
        const patternedCandles = detectPatterns(enrichedCandles);
        const signaledCandles = generateSignals(patternedCandles);
        const latest = signaledCandles[signaledCandles.length - 1] || {};
        
        return {
          interval,
          price: latest.close || 0,
          score: latest.score || 50,
          rsi: latest.rsi || null,
          macd: latest.macd || null,
          signal: latest.signal || 'HOLD',
          pattern: latest.patterns?.[0]?.name || 'None'
        };
      } catch (err) {
        console.error(`Error loading multi-timeframe for ${symbol} at ${interval}:`, err.message);
        return {
          interval,
          error: err.message
        };
      }
    }));

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      timeframes: results
    });
  } catch (error) {
    console.error(`Error in /api/stock/${symbol}/multi-timeframe:`, error.message);
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
