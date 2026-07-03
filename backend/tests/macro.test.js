import { calculatePredictiveTrend } from '../services/macroService.js';

describe('Global Macro Sentiment and Predictive Next Trend Engine', () => {
  const mockStockSymbol = 'TCS.NS';

  test('projects BULLISH CONTINUATION with high confidence when both local indicators and global macro factors are strong', () => {
    const mockLocalIntel = {
      unifiedScore: 78, // Strong local technicals
      recommendation: 'BUY',
      price: 3450
    };

    // S&P 500 up +1.2%, Nasdaq up +1.5%, Oil down -1.5%, USD/INR down -0.25%, Gold down -0.5%, Yields down -0.8%
    const mockGlobalMacro = [
      { symbol: '^NSEI', name: 'Nifty 50', price: 22000, change: 264, changePercent: 1.2 },
      { symbol: '^BSESN', name: 'BSE Sensex', price: 72000, change: 864, changePercent: 1.2 },
      { symbol: '^GSPC', name: 'S&P 500', price: 5100, change: 60, changePercent: 1.2 },
      { symbol: '^IXIC', name: 'NASDAQ Composite', price: 16200, change: 240, changePercent: 1.5 },
      { symbol: 'CL=F', name: 'Crude Oil Futures', price: 78.5, change: -1.2, changePercent: -1.5 },
      { symbol: 'USDINR=X', name: 'USD / INR', price: 83.2, change: -0.2, changePercent: -0.25 },
      { symbol: 'GC=F', name: 'Gold Futures', price: 2150, change: -10, changePercent: -0.5 },
      { symbol: '^TNX', name: 'US 10Y Bond Yield', price: 4.25, change: -0.03, changePercent: -0.8 }
    ];

    const result = calculatePredictiveTrend(mockStockSymbol, mockLocalIntel, mockGlobalMacro);

    expect(result.macroScore).toBeGreaterThanOrEqual(15);
    expect(result.macroSentiment).toBe('BULLISH');
    expect(result.projectedTrend).toBe('BULLISH CONTINUATION');
    expect(result.direction).toBe('UP');
    expect(result.confidence).toBeGreaterThan(75);
    expect(result.reasoning).toContain('reinforced by a');
    expect(result.reasoning).toContain('NASDAQ');
  });

  test('projects BULLISH BUT MACRO HEADWINDS when local indicators are strong but global macro is weak', () => {
    const mockLocalIntel = {
      unifiedScore: 68, // Good local technicals
      recommendation: 'BUY',
      price: 3450
    };

    // S&P 500 down -1.2%, Nasdaq down -1.5%, Oil up +2.0%, USD/INR up +0.40%, Gold up +1.0%, Yields up +1.5%
    const mockGlobalMacro = [
      { symbol: '^NSEI', name: 'Nifty 50', price: 21500, change: -322, changePercent: -1.5 },
      { symbol: '^BSESN', name: 'BSE Sensex', price: 70500, change: -1057, changePercent: -1.5 },
      { symbol: '^GSPC', name: 'S&P 500', price: 4900, change: -60, changePercent: -1.2 },
      { symbol: '^IXIC', name: 'NASDAQ Composite', price: 15500, change: -240, changePercent: -1.5 },
      { symbol: 'CL=F', name: 'Crude Oil Futures', price: 82.5, change: 1.6, changePercent: 2.0 },
      { symbol: 'USDINR=X', name: 'USD / INR', price: 83.8, change: 0.33, changePercent: 0.40 },
      { symbol: 'GC=F', name: 'Gold Futures', price: 2200, change: 22, changePercent: 1.0 },
      { symbol: '^TNX', name: 'US 10Y Bond Yield', price: 4.45, change: 0.065, changePercent: 1.5 }
    ];

    const result = calculatePredictiveTrend(mockStockSymbol, mockLocalIntel, mockGlobalMacro);

    expect(result.macroScore).toBeLessThanOrEqual(-15);
    expect(result.macroSentiment).toBe('BEARISH');
    expect(result.projectedTrend).toBe('BULLISH BUT MACRO HEADWINDS');
    expect(result.direction).toBe('SIDEWAYS_UP');
    expect(result.reasoning).toContain('global factors are introducing');
    expect(result.reasoning).toContain('crude oil');
  });

  test('projects BEARISH CONTINUATION when both local indicators and global macro factors are weak', () => {
    const mockLocalIntel = {
      unifiedScore: 22, // Bearish technicals
      recommendation: 'STRONG SELL',
      price: 3450
    };

    // Bearish macro setup
    const mockGlobalMacro = [
      { symbol: '^NSEI', name: 'Nifty 50', price: 21500, change: -322, changePercent: -1.5 },
      { symbol: '^BSESN', name: 'BSE Sensex', price: 70500, change: -1057, changePercent: -1.5 },
      { symbol: '^GSPC', name: 'S&P 500', price: 4900, change: -60, changePercent: -1.2 },
      { symbol: '^IXIC', name: 'NASDAQ Composite', price: 15500, change: -240, changePercent: -1.5 },
      { symbol: 'CL=F', name: 'Crude Oil Futures', price: 82.5, change: 1.6, changePercent: 2.0 },
      { symbol: 'USDINR=X', name: 'USD / INR', price: 83.8, change: 0.33, changePercent: 0.40 },
      { symbol: 'GC=F', name: 'Gold Futures', price: 2200, change: 22, changePercent: 1.0 },
      { symbol: '^TNX', name: 'US 10Y Bond Yield', price: 4.45, change: 0.065, changePercent: 1.5 }
    ];

    const result = calculatePredictiveTrend(mockStockSymbol, mockLocalIntel, mockGlobalMacro);

    expect(result.macroScore).toBeLessThanOrEqual(-15);
    expect(result.macroSentiment).toBe('BEARISH');
    expect(result.projectedTrend).toBe('BEARISH CONTINUATION');
    expect(result.direction).toBe('DOWN');
  });

  test('projects SIDEWAYS CONSOLIDATION when both technicals and macro triggers are neutral', () => {
    const mockLocalIntel = {
      unifiedScore: 50, // Neutral
      recommendation: 'HOLD',
      price: 3450
    };

    // Stable flat macro
    const mockGlobalMacro = [
      { symbol: '^NSEI', name: 'Nifty 50', price: 22000, change: 0, changePercent: 0 },
      { symbol: '^BSESN', name: 'BSE Sensex', price: 72000, change: 0, changePercent: 0 },
      { symbol: '^GSPC', name: 'S&P 500', price: 5000, change: 0, changePercent: 0 },
      { symbol: '^IXIC', name: 'NASDAQ Composite', price: 16000, change: 0, changePercent: 0 },
      { symbol: 'CL=F', name: 'Crude Oil Futures', price: 80, change: 0, changePercent: 0 },
      { symbol: 'USDINR=X', name: 'USD / INR', price: 83.5, change: 0, changePercent: 0 },
      { symbol: 'GC=F', name: 'Gold Futures', price: 2180, change: 0, changePercent: 0 },
      { symbol: '^TNX', name: 'US 10Y Bond Yield', price: 4.3, change: 0, changePercent: 0 }
    ];

    const result = calculatePredictiveTrend(mockStockSymbol, mockLocalIntel, mockGlobalMacro);

    expect(result.macroScore).toBe(0);
    expect(result.macroSentiment).toBe('NEUTRAL');
    expect(result.projectedTrend).toBe('SIDEWAYS CONSOLIDATION');
    expect(result.direction).toBe('SIDEWAYS');
    expect(result.confidence).toBe(70);
  });
});
