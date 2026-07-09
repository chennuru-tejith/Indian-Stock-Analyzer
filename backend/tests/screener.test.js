import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { runFundamentalScreener } from '../services/screenerService.js';
import { yahooFinance } from '../services/dataService.js';

describe('Fundamental Screener Service Tests', () => {
  let quoteSummarySpy;

  beforeEach(() => {
    quoteSummarySpy = jest.spyOn(yahooFinance, 'quoteSummary');
  });

  afterEach(() => {
    quoteSummarySpy.mockRestore();
  });

  test('should correctly score undervalued stock with strong financials and price underperformance', async () => {
    // Mock strong financials, cheap valuation, flat price returns
    quoteSummarySpy.mockResolvedValue({
      financialData: {
        currentPrice: 1200.0,
        returnOnEquity: 0.22, // 22% ROE (30 pts)
        debtToEquity: 40.0, // 0.4 D/E (20 pts)
        revenueGrowth: 0.18 // 18% Growth (20 pts)
      },
      summaryDetail: {
        trailingPE: 12.5, // Cheap valuation (30 pts)
        twoHundredDayAverage: 1400.0 // Trading at discount to 200MA
      },
      defaultKeyStatistics: {
        priceToBook: 1.5,
        '52WeekChange': -0.15 // -15% Return (negative return/underperformer)
      }
    });

    const report = await runFundamentalScreener(['TEST_STRONG.NS']);

    expect(report.successCount).toBe(1);
    const pick = report.fullResults[0];
    expect(pick.symbol).toBe('TEST_STRONG.NS');
    // Fundamental Score should be 30 (PE) + 30 (ROE) + 20 (D/E) + 20 (Growth) = 100
    expect(pick.fundamentalScore).toBe(100);
    // Divergence Score should be elevated due to negative return (x1.3 multiplier) + discount to 200 SMA
    expect(pick.divergenceScore).toBeGreaterThanOrEqual(90);
    expect(pick.grade).toBe('STRONG VALUE BUY (High Divergence)');
  });

  test('should score growth stock with high PE but high returns as low divergence', async () => {
    // Mock strong financials but very expensive PE and skyrocketing price returns
    quoteSummarySpy.mockResolvedValue({
      financialData: {
        currentPrice: 3000.0,
        returnOnEquity: 0.25, // 25% ROE (30 pts)
        debtToEquity: 20.0, // 0.2 D/E (20 pts)
        revenueGrowth: 0.20 // 20% Growth (20 pts)
      },
      summaryDetail: {
        trailingPE: 75.0, // Extremely expensive PE (10 pts)
        twoHundredDayAverage: 2500.0
      },
      defaultKeyStatistics: {
        priceToBook: 12.0,
        '52WeekChange': 0.85 // already skyrocketed 85% in 1 year
      }
    });

    const report = await runFundamentalScreener(['TEST_GROWTH.NS']);

    const pick = report.fullResults[0];
    // Fundamental Score: 10 (PE) + 30 (ROE) + 20 (D/E) + 20 (Growth) = 80
    expect(pick.fundamentalScore).toBe(80);
    // Divergence Score should be depressed because price returns are very positive (x0.6 multiplier)
    expect(pick.divergenceScore).toBeLessThan(60);
    expect(pick.grade).toBe('FULLY VALUED / ALREADY PRICED IN');
  });

  test('should handle API exceptions gracefully for bad stocks in screener list', async () => {
    quoteSummarySpy.mockRejectedValue(new Error("API Connection Failed"));

    const report = await runFundamentalScreener(['BAD_TICKER.NS']);

    expect(report.successCount).toBe(0);
    expect(report.fullResults.length).toBe(0);
  });
});
