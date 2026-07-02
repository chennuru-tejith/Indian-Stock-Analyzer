import { generateProjections } from '../services/predictiveEngine.js';

describe('AI Algorithmic Predictive Target Projections', () => {
  const currentPrice = 1000; // ₹1,000 base price
  const dailyVol = 0.015;    // 1.5% daily standard deviation

  test('calculates correct neutral bounds when unified score is neutral (50)', () => {
    const result = generateProjections(currentPrice, dailyVol, [], 50);

    expect(result.shortTerm.trend).toBe('NEUTRAL');
    expect(result.mediumTerm.trend).toBe('NEUTRAL');
    expect(result.shortTerm.expectedReturnPercent).toBe(0.0);
    expect(result.mediumTerm.expectedReturnPercent).toBe(0.0);

    // Short-term expected vol factor: 1.65 * 0.015 * sqrt(5) = 0.05534 (5.53% range)
    // Midpoint: 1000.
    // targetMin: 1000 * (1 - 5.53 / 2 / 100) = 1000 * 0.9723 = 972.33
    // targetMax: 1000 * (1 + 5.53 / 2 / 100) = 1000 * 1.0277 = 1027.67
    expect(result.shortTerm.targetMin).toBeCloseTo(972.33, 1);
    expect(result.shortTerm.targetMax).toBeCloseTo(1027.67, 1);
    expect(result.shortTerm.confidence).toBe(70);
  });

  test('shifts projections upward when unified score is bullish (80)', () => {
    const result = generateProjections(currentPrice, dailyVol, [], 80);

    expect(result.shortTerm.trend).toBe('BULLISH');
    expect(result.mediumTerm.trend).toBe('BULLISH');

    // Expected short-term return (5 days): ((80-50)/50)*5.5*sqrt(5/5) = 0.6 * 5.5 * 1 = +3.30%
    // Midpoint: 1000 * 1.033 = 1033.
    // targetMin: 1033 * (1 - 0.02767) = 1004.4
    // targetMax: 1033 * (1 + 0.02767) = 1061.6
    expect(result.shortTerm.expectedReturnPercent).toBe(3.30);
    expect(result.shortTerm.targetMin).toBeGreaterThan(currentPrice);
    expect(result.shortTerm.targetMax).toBeGreaterThan(1050);
    expect(result.shortTerm.confidence).toBe(85); // 55 + (80-60)*1.5 = 85
  });

  test('shifts projections downward when unified score is bearish (20)', () => {
    const result = generateProjections(currentPrice, dailyVol, [], 20);

    expect(result.shortTerm.trend).toBe('BEARISH');
    expect(result.mediumTerm.trend).toBe('BEARISH');

    // Expected return: ((20-50)/50)*5.5 = -0.6 * 5.5 = -3.30%
    expect(result.shortTerm.expectedReturnPercent).toBe(-3.30);
    expect(result.shortTerm.targetMin).toBeLessThan(currentPrice * 0.95);
    expect(result.shortTerm.targetMax).toBeLessThan(currentPrice * 1.02);
    expect(result.shortTerm.confidence).toBe(85); // 55 + (40-20)*1.5 = 85
  });

  test('parses news report headlines into correct highlights and warnings', () => {
    const mockNews = [
      { title: 'TCS reports earnings beat with quarterly profit surge' },
      { title: 'Brokers upgrade TCS price target on expansion capacity plans' },
      { title: 'TCS margin under pressure due to cost inflation and debt' }
    ];

    const result = generateProjections(currentPrice, dailyVol, mockNews, 60);

    // Should match bullish keywords
    expect(result.highlights).toContain("Positive earnings reports indicate resilient operational profitability and cash flows.");
    expect(result.highlights).toContain("Recent broker upgrades and rising target prices reflect high institutional buyer interest.");

    // Should match bearish keywords
    expect(result.warnings).toContain("Input cost inflation and supply-chain pressures may trigger margin compression.");
    expect(result.warnings).toContain("Elevated debt leverage and high interest financing costs present structural cash flow risks.");
  });
});
