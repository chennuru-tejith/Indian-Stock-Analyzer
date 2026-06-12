// Unit tests for the Position Sizing and Risk Sizing mathematical models

function calculatePositionSizing(capital, riskPercent, entry, stopLoss, target) {
  const diffSL = entry - stopLoss;
  const diffTP = target - entry;

  const slPercent = entry > 0 ? (diffSL / entry) * 100 : 0;
  const tpPercent = entry > 0 ? (diffTP / entry) * 100 : 0;
  const rrRatio = diffSL > 0 ? diffTP / diffSL : 0;
  
  const capitalAtRisk = (capital * riskPercent) / 100;
  const sharesToBuy = diffSL > 0 ? Math.floor(capitalAtRisk / diffSL) : 0;
  
  const totalTradeValue = sharesToBuy * entry;
  const actualRisk = sharesToBuy * diffSL;
  const actualReward = sharesToBuy * diffTP;

  let rating = 'POOR';
  if (rrRatio >= 2.0) rating = 'EXCELLENT';
  else if (rrRatio >= 1.5) rating = 'FAIR';

  return {
    slPercent,
    tpPercent,
    rrRatio,
    sharesToBuy,
    totalTradeValue,
    actualRisk,
    actualReward,
    rating
  };
}

describe('Position Sizing & Risk Allocation Mathematics', () => {
  test('calculates correct shares and risk metrics for a standard 1:2 Risk-to-Reward trade', () => {
    const capital = 100000;    // ₹1,00,000
    const riskPercent = 1.5;   // 1.5% Risk (₹1,500 max loss)
    const entry = 1500;        // ₹1,500 share price
    const stopLoss = 1450;     // ₹1,450 SL (₹50 distance, 3.3% SL)
    const target = 1600;       // ₹1,600 TP (₹100 distance, 6.7% TP)

    const result = calculatePositionSizing(capital, riskPercent, entry, stopLoss, target);

    // Capital at risk = 100000 * 0.015 = ₹1,500
    // Shares = 1500 / 50 = 30 shares
    expect(result.sharesToBuy).toBe(30);
    
    // Total trade cost = 30 * 1500 = ₹45,000
    expect(result.totalTradeValue).toBe(45000);
    
    // Actual risk = 30 * 50 = ₹1,500
    expect(result.actualRisk).toBe(1500);
    
    // Actual reward = 30 * 100 = ₹3,000
    expect(result.actualReward).toBe(3000);

    // R:R = 100 / 50 = 2.0
    expect(result.rrRatio).toBe(2.0);
    expect(result.rating).toBe('EXCELLENT');

    expect(result.slPercent).toBeCloseTo(3.33);
    expect(result.tpPercent).toBeCloseTo(6.67);
  });

  test('calculates correct metrics when Stop Loss distance leads to fractional shares (rounds down)', () => {
    const capital = 50000;     // ₹50,000
    const riskPercent = 1.0;   // 1.0% Risk (₹500 max loss)
    const entry = 280;         // ₹280 share price
    const stopLoss = 267;      // ₹267 SL (₹13 distance)
    const target = 320;        // ₹320 TP (₹40 distance)

    const result = calculatePositionSizing(capital, riskPercent, entry, stopLoss, target);

    // Capital at risk = 50000 * 0.01 = ₹500
    // Shares = 500 / 13 = 38.46 -> rounds down to 38 shares
    expect(result.sharesToBuy).toBe(38);
    
    // Total trade cost = 38 * 280 = ₹10,640
    expect(result.totalTradeValue).toBe(10640);
    
    // Actual risk = 38 * 13 = ₹494 (less than ₹500 risk limit)
    expect(result.actualRisk).toBeLessThanOrEqual(500);
    expect(result.actualRisk).toBe(494);

    // R:R = 40 / 13 = 3.07
    expect(result.rrRatio).toBeCloseTo(3.08, 1);
    expect(result.rating).toBe('EXCELLENT');
  });

  test('identifies poor risk to reward ratio (R:R < 1.5)', () => {
    const capital = 100000;
    const riskPercent = 1.0;
    const entry = 1000;
    const stopLoss = 950;      // ₹50 risk
    const target = 1050;       // ₹50 reward (1:1 R:R)

    const result = calculatePositionSizing(capital, riskPercent, entry, stopLoss, target);

    expect(result.rrRatio).toBe(1.0);
    expect(result.rating).toBe('POOR');
  });
});
