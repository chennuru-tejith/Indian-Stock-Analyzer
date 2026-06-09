import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchStockData, fetchRealTimeQuote } from './services/dataService.js';
import { enrichWithIndicators } from './services/indicatorService.js';
import { detectPatterns } from './services/patternService.js';
import { generateSignals } from './services/signalService.js';
import { runBacktest } from './services/backtestService.js';

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
    const rawCandles = await fetchStockData(symbol, interval, Number(years));
    const enrichedCandles = enrichWithIndicators(rawCandles);
    const patternedCandles = detectPatterns(enrichedCandles);
    const signaledCandles = generateSignals(patternedCandles);

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      interval,
      count: signaledCandles.length,
      candles: signaledCandles
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
