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

function calculateRiskMetrics(candlesSeries, totalTradeValue = 100000) {
  if (!candlesSeries || candlesSeries.length < 10) {
    return { dailyVol: 1.8, annualizedVol: 28.5, varValue: 0, varPercent: 2.97 };
  }

  const last30 = candlesSeries.slice(-30);
  const returns = [];
  for (let i = 1; i < last30.length; i++) {
    if (last30[i - 1].close > 0) {
      returns.push((last30[i].close - last30[i - 1].close) / last30[i - 1].close);
    }
  }

  if (returns.length < 5) {
    return { dailyVol: 1.8, annualizedVol: 28.5, varValue: 0, varPercent: 2.97 };
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);
  
  const varPercent = 1.65 * dailyVol * 100;
  const varValue = (totalTradeValue * varPercent) / 100;

  return {
    dailyVol: dailyVol * 100,
    annualizedVol: annualizedVol * 100,
    varPercent,
    varValue
  };
}

describe('Aladdin Risk Engine (VaR & Volatility) Calculations', () => {
  test('returns fallback default metrics when candles series is insufficient (< 10 candles)', () => {
    const insufficientCandles = [
      { close: 100 },
      { close: 102 },
      { close: 104 }
    ];
    const result = calculateRiskMetrics(insufficientCandles, 50000);
    expect(result.dailyVol).toBe(1.8);
    expect(result.annualizedVol).toBe(28.5);
    expect(result.varPercent).toBe(2.97);
    expect(result.varValue).toBe(0);
  });

  test('returns fallback default metrics when returns length is insufficient (< 5 valid returns)', () => {
    // 11 candles, but only 3 have close > 0
    const candlesWithInvalidPrices = [
      { close: 0 }, { close: 0 }, { close: 0 }, { close: 0 },
      { close: 100 }, { close: 102 }, { close: 101 },
      { close: 0 }, { close: 0 }, { close: 0 }, { close: 0 }
    ];
    const result = calculateRiskMetrics(candlesWithInvalidPrices, 100000);
    expect(result.dailyVol).toBe(1.8);
    expect(result.annualizedVol).toBe(28.5);
  });

  test('calculates correct zero volatility and zero VaR for constant close prices', () => {
    const constantCandles = Array.from({ length: 15 }, () => ({ close: 150 }));
    const result = calculateRiskMetrics(constantCandles, 100000);

    expect(result.dailyVol).toBe(0);
    expect(result.annualizedVol).toBe(0);
    expect(result.varPercent).toBe(0);
    expect(result.varValue).toBe(0);
  });

  test('calculates correct daily standard deviation, annualized volatility, and Value-at-Risk for mathematical inputs', () => {
    // Construct a series generating returns: [0.01, -0.01, 0.02, -0.02, 0.01, -0.01, 0.02, -0.02, 0.01, -0.01]
    const prices = [
      100.0,
      101.0,       // +1%
      99.99,       // -1% (approx)
      101.9898,    // +2% (approx)
      99.95,       // -2% (approx)
      100.9495,    // +1% (approx)
      99.94,       // -1% (approx)
      101.9388,    // +2% (approx)
      99.9,        // -2% (approx)
      100.899,     // +1% (approx)
      99.89        // -1% (approx)
    ];
    
    const candles = prices.map(p => ({ close: p }));
    const totalTradeValue = 100000; // ₹1,00,000 position
    
    const result = calculateRiskMetrics(candles, totalTradeValue);

    // Expected daily std dev of returns:
    // Mean is approx 0.
    // Sum of squared diffs: 6 * 0.01^2 + 4 * 0.02^2 = 0.0022
    // Sample variance (divided by N-1, where N = 10 returns): 0.0022 / 9 = 0.00024444
    // Daily standard deviation = sqrt(0.00024444) = 0.0156347 (approx 1.56%)
    // Annualized volatility = dailyVol * sqrt(252) = 0.24819 (approx 24.82%)
    // VaR Percent = 1.65 * dailyVol * 100 = 2.5797% (approx 2.58%)
    // VaR Value = 100000 * 2.5797% = ₹2,580 (approx)
    
    expect(result.dailyVol).toBeCloseTo(1.56, 1);
    expect(result.annualizedVol).toBeCloseTo(24.82, 1);
    expect(result.varPercent).toBeCloseTo(2.58, 1);
    expect(result.varValue).toBeCloseTo(2580, 0);
  });
});

function calculateCorrelation(returnsX, returnsY) {
  const len = Math.min(returnsX.length, returnsY.length);
  if (len === 0) return 0;

  const x = returnsX.slice(-len);
  const y = returnsY.slice(-len);

  const meanX = x.reduce((sum, val) => sum + val, 0) / len;
  const meanY = y.reduce((sum, val) => sum + val, 0) / len;

  let sumProductDiff = 0;
  let sumSqDiffX = 0;
  let sumSqDiffY = 0;

  for (let i = 0; i < len; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    sumProductDiff += diffX * diffY;
    sumSqDiffX += diffX * diffX;
    sumSqDiffY += diffY * diffY;
  }

  const denominator = Math.sqrt(sumSqDiffX * sumSqDiffY);
  return denominator > 0 ? sumProductDiff / denominator : 0.0;
}

function calculatePortfolioRisk(assets, capital = 100000) {
  const stats = assets.map(a => {
    const mean = a.returns.reduce((sum, val) => sum + val, 0) / a.returns.length;
    const variance = a.returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (a.returns.length - 1);
    const dailyVol = Math.sqrt(variance);
    return {
      weight: a.weight,
      mean,
      dailyVol,
      returns: a.returns
    };
  });

  const correlationMatrix = [];
  for (let i = 0; i < stats.length; i++) {
    correlationMatrix[i] = [];
    for (let j = 0; j < stats.length; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1.0;
      } else {
        correlationMatrix[i][j] = calculateCorrelation(stats[i].returns, stats[j].returns);
      }
    }
  }

  let portfolioVariance = 0;
  const normalizedWeights = stats.map(s => s.weight / 100);

  for (let i = 0; i < stats.length; i++) {
    const w_i = normalizedWeights[i];
    const vol_i = stats[i].dailyVol;
    portfolioVariance += Math.pow(w_i * vol_i, 2);

    for (let j = i + 1; j < stats.length; j++) {
      const w_j = normalizedWeights[j];
      const vol_j = stats[j].dailyVol;
      const corr_ij = correlationMatrix[i][j];
      portfolioVariance += 2 * w_i * w_j * vol_i * vol_j * corr_ij;
    }
  }

  const dailyVol = Math.sqrt(portfolioVariance);
  const annualizedVol = dailyVol * Math.sqrt(252);
  const varPercent = 1.65 * dailyVol * 100;
  const varValue = (capital * varPercent) / 100;

  return {
    dailyVol: dailyVol * 100,
    annualizedVol: annualizedVol * 100,
    varPercent,
    varValue,
    correlationMatrix
  };
}

describe('Aladdin Portfolio Risk Simulator Calculations', () => {
  test('calculates correct Pearson correlation coefficient', () => {
    const returnsX = [0.01, -0.01, 0.02, -0.02, 0.01, -0.01, 0.02, -0.02];
    const returnsY = [0.01, -0.01, 0.02, -0.02, 0.01, -0.01, 0.02, -0.02]; // Identical
    const returnsZ = [-0.01, 0.01, -0.02, 0.02, -0.01, 0.01, -0.02, 0.02]; // Perfectly Inverse

    expect(calculateCorrelation(returnsX, returnsY)).toBeCloseTo(1.0, 5);
    expect(calculateCorrelation(returnsX, returnsZ)).toBeCloseTo(-1.0, 5);
  });

  test('calculates portfolio volatility matching single asset volatility when correlation is +1.0', () => {
    const returnsA = [0.02, -0.01, 0.03, -0.02, 0.01, -0.01, 0.02, -0.03, 0.01, -0.01];
    const returnsB = [0.02, -0.01, 0.03, -0.02, 0.01, -0.01, 0.02, -0.03, 0.01, -0.01]; // Perfect positive correlation (+1)

    const assets = [
      { returns: returnsA, weight: 50 },
      { returns: returnsB, weight: 50 }
    ];

    const portfolioResult = calculatePortfolioRisk(assets, 100000);
    
    // Individual asset volatility
    const mean = returnsA.reduce((sum, v) => sum + v, 0) / returnsA.length;
    const variance = returnsA.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (returnsA.length - 1);
    const individualDailyVol = Math.sqrt(variance) * 100;

    expect(portfolioResult.dailyVol).toBeCloseTo(individualDailyVol, 4);
    expect(portfolioResult.correlationMatrix[0][1]).toBeCloseTo(1.0, 4);
  });

  test('calculates zero portfolio volatility (perfect hedge) when correlation is -1.0 with equal weights', () => {
    const returnsX = [0.01, -0.02, 0.03, -0.01, 0.02, -0.01, 0.02, -0.02, 0.01, -0.01];
    const returnsY = [-0.01, 0.02, -0.03, 0.01, -0.02, 0.01, -0.02, 0.02, -0.01, 0.01]; // Perfect negative correlation (-1)

    const assets = [
      { returns: returnsX, weight: 50 },
      { returns: returnsY, weight: 50 }
    ];

    const portfolioResult = calculatePortfolioRisk(assets, 100000);

    expect(portfolioResult.dailyVol).toBeCloseTo(0, 4);
    expect(portfolioResult.annualizedVol).toBeCloseTo(0, 4);
    expect(portfolioResult.varValue).toBeCloseTo(0, 4);
    expect(portfolioResult.correlationMatrix[0][1]).toBeCloseTo(-1.0, 4);
  });
});


