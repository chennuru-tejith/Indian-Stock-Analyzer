import { jest } from '@jest/globals';
import request from 'supertest';
import { calculateSMA, calculateEMA, calculateRSI } from '../services/indicatorService.js';
import { detectPatterns } from '../services/patternService.js';
import { generateSignals } from '../services/signalService.js';

jest.unstable_mockModule('../services/dataService.js', () => ({
  fetchStockData: jest.fn(),
  fetchRealTimeQuote: jest.fn(),
  fetchStockNews: jest.fn(),
  yahooFinance: {
    search: jest.fn()
  }
}));

const { default: app } = await import('../server.js');
const dataService = await import('../services/dataService.js');

describe('Technical Indicator Calculations', () => {
  test('calculateSMA returns correct simple moving averages', () => {
    const values = [10, 20, 30, 40, 50];
    const period = 3;
    const result = calculateSMA(values, period);
    
    // Period is 3, first 2 should be null
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    // SMA = (10+20+30)/3 = 20
    expect(result[2]).toBeCloseTo(20);
    // SMA = (20+30+40)/3 = 30
    expect(result[3]).toBeCloseTo(30);
    // SMA = (30+40+50)/3 = 40
    expect(result[4]).toBeCloseTo(40);
  });

  test('calculateEMA returns correct exponential moving averages', () => {
    const values = [10, 12, 14, 16, 18];
    const period = 3;
    const result = calculateEMA(values, period);

    // Period is 3, first 2 should be null
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    // Initial EMA is SMA = (10+12+14)/3 = 12
    expect(result[2]).toBeCloseTo(12);
    
    // Next EMA = (16 - 12) * (2 / 4) + 12 = 14
    expect(result[3]).toBeCloseTo(14);
  });

  test('calculateRSI returns correct Relative Strength Index values', () => {
    // Standard upward trend should have high RSI
    const closes = [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175];
    const period = 14;
    const result = calculateRSI(closes, period);

    expect(result[0]).toBeNull();
    expect(result[14]).not.toBeNull();
    // Since price only goes up, RSI should be 100 or close to 100
    expect(result[15]).toBeCloseTo(100);
  });
});

describe('Candlestick Pattern Detection', () => {
  test('detects Bullish Engulfing pattern correctly', () => {
    const mockCandles = [
      { time: '2026-06-01', open: 100, high: 105, low: 95, close: 100, volume: 100 }, // dummy
      { time: '2026-06-02', open: 100, high: 105, low: 95, close: 100, volume: 100 }, // dummy
      { time: '2026-06-03', open: 100, high: 102, low: 88, close: 90, volume: 100 },  // Bearish candle
      { time: '2026-06-04', open: 89, high: 105, low: 88, close: 103, volume: 200 }   // Bullish candle engulfing body of 90-100
    ];

    const result = detectPatterns(mockCandles);
    const lastCandle = result[3];
    
    expect(lastCandle.patterns).toContainEqual(
      expect.objectContaining({ name: 'Bullish Engulfing', type: 'bullish' })
    );
  });

  test('detects Hammer Shape pattern correctly', () => {
    const mockCandles = [
      { time: '2026-06-01', open: 100, high: 105, low: 95, close: 100, volume: 100 }, // dummy
      { time: '2026-06-02', open: 100, high: 105, low: 95, close: 100, volume: 100 }, // dummy
      // Hammer: Open 100, Close 99, High 100, Low 90
      // Body = 1. Lower shadow = 9. Upper shadow = 0.
      { time: '2026-06-03', open: 100, high: 100, low: 90, close: 99, volume: 100 }
    ];

    const result = detectPatterns(mockCandles);
    const lastCandle = result[2];

    expect(lastCandle.patterns).toContainEqual(
      expect.objectContaining({ name: 'Hammer Shape', type: 'neutral' })
    );
  });
});

describe('Signal Fusion and Verification', () => {
  test('generates BUY signal for Bullish Engulfing in uptrend', () => {
    // Generate 60 candles so we have enough data for indicators (SMA200 requires 200, let's test short term trends or mock indicators directly)
    // To make it easy, let's create a mocked candle structure with pre-calculated indicators
    const mockCandles = Array.from({ length: 60 }, (_, idx) => ({
      time: `2026-06-${idx + 1}`,
      open: 100 + idx,
      high: 102 + idx,
      low: 99 + idx,
      close: 101 + idx,
      volume: 1000,
      sma200: 50, // close is 101+idx which is > 50 (above SMA200)
      ema20: 80,
      rsi: 30, // oversold
      macd: { histogram: 0.5 },
      volSma20: 1000,
      patterns: [{ name: 'Bullish Engulfing', type: 'bullish' }]
    }));

    const result = generateSignals(mockCandles);
    const lastCandle = result[59];

    expect(lastCandle.signal).toBe('BUY');
    expect(lastCandle.confidence).toBe('HIGH');
  });
});

describe('API Endpoint Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/stock/:symbol/history returns candles populated with indicators, signals, and patterns', async () => {
    // Generate 205 mock candles to calculate indicators (needs > 200 candles)
    const mockRawCandles = Array.from({ length: 205 }, (_, idx) => {
      const date = new Date(2026, 0, idx + 1).toISOString().split('T')[0];
      if (idx === 203) {
        // Bearish candle
        return { time: date, open: 100, high: 102, low: 88, close: 90, volume: 100 };
      }
      if (idx === 204) {
        // Engulfing Bullish
        return { time: date, open: 89, high: 105, low: 88, close: 103, volume: 200 };
      }
      return { time: date, open: 100, high: 100, low: 100, close: 100, volume: 100 };
    });

    dataService.fetchStockData.mockResolvedValue(mockRawCandles);
    dataService.fetchStockNews.mockResolvedValue({
      sentimentScore: 75,
      newsSentiment: 'BULLISH',
      metrics: { bullishCount: 3, bearishCount: 0, neutralCount: 1 },
      articles: []
    });

    const response = await request(app)
      .get('/api/stock/TCS.NS/history')
      .query({ interval: '1d', years: 1 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.symbol).toBe('TCS.NS');
    expect(response.body.interval).toBe('1d');
    expect(response.body.newsSentimentScore).toBe(75);
    expect(response.body.count).toBe(205);

    const candles = response.body.candles;
    expect(candles).toBeInstanceOf(Array);
    expect(candles.length).toBe(205);

    // Verify indicators are populated on later candles
    const lastCandle = candles[204];
    expect(lastCandle).toHaveProperty('sma200');
    expect(lastCandle).toHaveProperty('ema20');
    expect(lastCandle).toHaveProperty('rsi');
    expect(lastCandle).toHaveProperty('macd');
    expect(lastCandle).toHaveProperty('patterns');
    expect(lastCandle).toHaveProperty('signal');
    expect(lastCandle).toHaveProperty('score');

    // Verify the patterns field contains the detected pattern
    expect(lastCandle.patterns).toContainEqual(
      expect.objectContaining({ name: 'Bullish Engulfing', type: 'bullish' })
    );
  });
});
