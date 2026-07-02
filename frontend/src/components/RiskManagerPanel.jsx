import React, { useState, useEffect, useRef } from 'react';
import { Shield, Coins, Scale, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle, Plus, Trash2, Info } from 'lucide-react';

export default function RiskManagerPanel({ selectedSymbol, intelligenceData, multiTimeframeData, loading, candles }) {
  // Navigation Tabs: 'POSITION' | 'PORTFOLIO'
  const [riskTab, setRiskTab] = useState('POSITION');

  // Risk Model Calculation Toggle: 'PARAMETRIC' | 'HISTORICAL'
  const [varMethod, setVarMethod] = useState('PARAMETRIC');

  // Single Position Settings
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [entry, setEntry] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [target, setTarget] = useState(0);

  // Multi-Asset Portfolio Settings
  const [portfolio, setPortfolio] = useState([
    { symbol: selectedSymbol || 'RELIANCE.NS', weight: 40 },
    { symbol: 'TCS.NS', weight: 30 },
    { symbol: 'HDFCBANK.NS', weight: 30 }
  ]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newWeight, setNewWeight] = useState(20);

  // Portfolio Simulation Results
  const [portfolioResults, setPortfolioResults] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);
  const [failedAssets, setFailedAssets] = useState([]);

  // Client-Side History Cache (stored in useRef to persist across renders)
  const historyCache = useRef({});

  // Sync inputs with intelligence price levels on stock change
  useEffect(() => {
    if (intelligenceData && intelligenceData.success) {
      const price = intelligenceData.price || 0;
      setEntry(price);
      setStopLoss(intelligenceData.support?.[0] || price * 0.975);
      setTarget(intelligenceData.resistance?.[0] || price * 1.05);
    }
  }, [intelligenceData]);

  // Keep parent fetched candles in the client-side cache
  useEffect(() => {
    if (selectedSymbol && candles && candles.length > 0) {
      const sym = selectedSymbol.trim().toUpperCase();
      historyCache.current[sym] = candles;
    }
  }, [selectedSymbol, candles]);

  // Keep first item of portfolio in sync with active selectedSymbol
  useEffect(() => {
    setPortfolio(prev => {
      const updated = [...prev];
      if (updated.length > 0 && selectedSymbol) {
        const sym = selectedSymbol.trim().toUpperCase();
        updated[0] = { ...updated[0], symbol: sym };
      }
      return updated;
    });
  }, [selectedSymbol]);

  // Run portfolio simulation automatically when tab opens or model changes
  useEffect(() => {
    if (riskTab === 'PORTFOLIO') {
      runPortfolioSimulation();
    }
  }, [riskTab, selectedSymbol, varMethod]);

  // Position Sizing Calculations
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

  // Single stock historical risk metrics
  const calculateRiskMetrics = (candlesSeries, method = 'PARAMETRIC') => {
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
    
    let varPercent;
    if (method === 'HISTORICAL') {
      // Historical VaR (95% confidence) -> 5th percentile of actual returns
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const percentileIndex = Math.floor(sortedReturns.length * 0.05);
      const percentileReturn = sortedReturns[percentileIndex] || 0;
      varPercent = Math.abs(percentileReturn) * 100;
    } else {
      // Parametric VaR (95% confidence) -> 1.65 * Volatility
      varPercent = 1.65 * dailyVol * 100;
    }
    
    const varValue = (totalTradeValue * varPercent) / 100;

    return {
      dailyVol: dailyVol * 100,
      annualizedVol: annualizedVol * 100,
      varPercent,
      varValue
    };
  };

  const riskMetrics = calculateRiskMetrics(candles, varMethod);

  const baseBeta = riskMetrics.annualizedVol / 20;
  const simulatedBeta = Math.max(0.5, Math.min(2.5, baseBeta));

  const stressScenarios = [
    { name: '2008 Financial Crisis', change: -15.0 * simulatedBeta, description: 'Systemic liquidity freeze' },
    { name: '2020 Pandemic Shock', change: -18.5 * simulatedBeta, description: 'Demand drop & lockout' },
    { name: 'Crude Oil Hike (+50%)', change: -3.8 * simulatedBeta, description: 'Import cost pressure spike' },
    { name: 'USD/INR Devaluation (+10%)', change: -4.5 * simulatedBeta, description: 'Capital flight & currency shock' }
  ];

  const getRiskRating = (rr) => {
    if (rr >= 2.0) return { label: 'EXCELLENT', color: 'var(--color-bullish)', bg: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-bullish)' };
    if (rr >= 1.5) return { label: 'FAIR', color: 'var(--color-warning)', bg: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)' };
    return { label: 'POOR RISK:REWARD', color: 'var(--color-bearish)', bg: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-bearish)' };
  };

  const rating = getRiskRating(rrRatio);

  const getSignalBadgeClass = (sig) => {
    if (sig === 'BUY') return 'signal-badge buy';
    if (sig === 'SELL') return 'signal-badge sell';
    return 'signal-badge hold';
  };

  const getRsiColor = (rsi) => {
    if (!rsi) return 'var(--text-muted)';
    if (rsi >= 70) return 'var(--color-bearish)';
    if (rsi <= 30) return 'var(--color-bullish)';
    return 'var(--text-secondary)';
  };

  // Portfolio Simulator logic
  const runPortfolioSimulation = async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      // 1. Fetch historical candles for each ticker concurrently (with cache lookup)
      const promises = portfolio.map(async (item) => {
        const sym = item.symbol.trim().toUpperCase();
        
        // Cache hit
        const cached = historyCache.current[sym];
        if (cached && cached.length > 0) {
          return { symbol: sym, weight: item.weight, candles: cached, success: true };
        }
        
        // Cache miss -> fetch from backend API
        try {
          const res = await fetch(`http://localhost:5000/api/stock/${sym}/history?interval=1d`);
          const data = await res.json();
          if (!data.success) {
            return { symbol: sym, weight: item.weight, error: data.error || 'Failed to fetch history', success: false };
          }
          // Store in client cache
          historyCache.current[sym] = data.candles;
          return { symbol: sym, weight: item.weight, candles: data.candles, success: true };
        } catch (err) {
          return { symbol: sym, weight: item.weight, error: err.message, success: false };
        }
      });

      // Execute fetches in parallel (Structured Promise.allSettled behavior)
      const settledResults = await Promise.all(promises);

      const successes = settledResults.filter(r => r.success);
      const failures = settledResults.filter(r => !r.success);

      setFailedAssets(failures.map(f => f.symbol));

      if (successes.length === 0) {
        throw new Error("Failed to load any valid asset historical data.");
      }

      // 2. Align daily returns over last 30 days
      const alignedReturns = successes.map(res => {
        const last30 = res.candles.slice(-30);
        const returns = [];
        for (let i = 1; i < last30.length; i++) {
          if (last30[i - 1].close > 0) {
            returns.push((last30[i].close - last30[i - 1].close) / last30[i - 1].close);
          }
        }
        return { symbol: res.symbol, weight: res.weight, returns };
      });

      const minLen = Math.min(...alignedReturns.map(r => r.returns.length));
      if (minLen < 5) {
        throw new Error("Insufficient historical overlap between portfolio holdings.");
      }

      // Truncate series to minimum length for index alignment
      alignedReturns.forEach(r => {
        r.returns = r.returns.slice(-minLen);
      });

      const stats = alignedReturns.map(r => {
        const mean = r.returns.reduce((sum, val) => sum + val, 0) / r.returns.length;
        const variance = r.returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (r.returns.length - 1);
        const dailyVol = Math.sqrt(variance);
        return {
          symbol: r.symbol,
          weight: r.weight,
          mean,
          dailyVol,
          annualizedVol: dailyVol * Math.sqrt(252),
          returns: r.returns
        };
      });

      // 3. Pearson correlation matrix
      const correlationMatrix = {};
      for (let i = 0; i < stats.length; i++) {
        correlationMatrix[stats[i].symbol] = {};
        for (let j = 0; j < stats.length; j++) {
          if (i === j) {
            correlationMatrix[stats[i].symbol][stats[j].symbol] = 1.0;
            continue;
          }

          const x = stats[i];
          const y = stats[j];

          let sumProductDiff = 0;
          let sumSqDiffX = 0;
          let sumSqDiffY = 0;

          for (let k = 0; k < minLen; k++) {
            const diffX = x.returns[k] - x.mean;
            const diffY = y.returns[k] - y.mean;
            sumProductDiff += diffX * diffY;
            sumSqDiffX += diffX * diffX;
            sumSqDiffY += diffY * diffY;
          }

          const denominator = Math.sqrt(sumSqDiffX * sumSqDiffY);
          const corr = denominator > 0 ? sumProductDiff / denominator : 0.0;
          correlationMatrix[stats[i].symbol][stats[j].symbol] = corr;
        }
      }

      // 4. Calculate Portfolio Volatility using Covariance matrix
      let portfolioVariance = 0;
      // Re-normalize weights based on successfully loaded assets
      const successWeightSum = stats.reduce((sum, s) => sum + s.weight, 0);
      const normalizedWeights = stats.map(s => successWeightSum > 0 ? (s.weight / successWeightSum) : 0);

      for (let i = 0; i < stats.length; i++) {
        const w_i = normalizedWeights[i];
        const vol_i = stats[i].dailyVol;
        portfolioVariance += Math.pow(w_i * vol_i, 2);

        for (let j = i + 1; j < stats.length; j++) {
          const w_j = normalizedWeights[j];
          const vol_j = stats[j].dailyVol;
          const corr_ij = correlationMatrix[stats[i].symbol][stats[j].symbol];
          portfolioVariance += 2 * w_i * w_j * vol_i * vol_j * corr_ij;
        }
      }

      const portfolioDailyVol = Math.sqrt(portfolioVariance);
      const portfolioAnnualVol = portfolioDailyVol * Math.sqrt(252);

      // Compute actual portfolio returns series
      const portfolioReturnsSeries = [];
      for (let k = 0; k < minLen; k++) {
        let r_p = 0;
        for (let i = 0; i < stats.length; i++) {
          r_p += normalizedWeights[i] * stats[i].returns[k];
        }
        portfolioReturnsSeries.push(r_p);
      }

      // 5. Value-at-Risk (VaR) method routing
      let portfolioVarPercent;
      if (varMethod === 'HISTORICAL') {
        // Historical VaR (95% confidence) -> 5th percentile of actual portfolio returns series
        const sortedP = [...portfolioReturnsSeries].sort((a, b) => a - b);
        const pIndex = Math.floor(sortedP.length * 0.05);
        portfolioVarPercent = Math.abs(sortedP[pIndex] || 0) * 100;
      } else {
        // Parametric VaR (95% confidence)
        portfolioVarPercent = 1.65 * portfolioDailyVol * 100;
      }
      
      const portfolioVarValue = (capital * portfolioVarPercent) / 100;

      // 6. Risk Contribution / Component VaR calculations
      const marginalContributions = stats.map((s_i, i) => {
        let sum = 0;
        for (let j = 0; j < stats.length; j++) {
          const w_j = normalizedWeights[j];
          const vol_i = s_i.dailyVol;
          const vol_j = stats[j].dailyVol;
          const corr_ij = correlationMatrix[s_i.symbol][stats[j].symbol];
          const cov_ij = corr_ij * vol_i * vol_j;
          sum += w_j * cov_ij;
        }
        return portfolioDailyVol > 0 ? (sum / portfolioDailyVol) : 0;
      });

      const riskContributions = stats.map((s_i, i) => {
        const w_i = normalizedWeights[i];
        const mc = marginalContributions[i];
        const rcPercent = portfolioDailyVol > 0 ? ((w_i * mc) / portfolioDailyVol) * 100 : 0;
        const rcValue = (rcPercent * portfolioVarValue) / 100;
        return {
          symbol: s_i.symbol,
          rcPercent,
          rcValue
        };
      });

      // Individual undiversified VaR
      const individualVaRs = stats.map((s, idx) => {
        let varPercent;
        if (varMethod === 'HISTORICAL') {
          const sortedS = [...s.returns].sort((a, b) => a - b);
          const sIndex = Math.floor(sortedS.length * 0.05);
          varPercent = Math.abs(sortedS[sIndex] || 0) * 100;
        } else {
          varPercent = 1.65 * s.dailyVol * 100;
        }
        const w_i = normalizedWeights[idx];
        const varValue = (capital * w_i * varPercent) / 100;
        return { symbol: s.symbol, value: varValue, percent: varPercent };
      });

      const undiversifiedVarValue = individualVaRs.reduce((sum, v) => sum + v.value, 0);
      const diversificationBenefit = undiversifiedVarValue - portfolioVarValue;

      // 7. Estimated Annualized Sharpe Ratio (Assuming standard 6% Indian Risk-Free Rate)
      const pDailyMean = portfolioReturnsSeries.reduce((sum, v) => sum + v, 0) / minLen;
      const pAnnualizedReturn = pDailyMean * 252;
      const riskFreeRate = 0.06;
      const sharpeRatio = portfolioAnnualVol > 0 ? (pAnnualizedReturn - riskFreeRate) / portfolioAnnualVol : 0;

      setPortfolioResults({
        stats,
        totalWeight: successes.reduce((sum, s) => sum + s.weight, 0),
        correlationMatrix,
        portfolioDailyVol: portfolioDailyVol * 100,
        portfolioAnnualVol: portfolioAnnualVol * 100,
        portfolioVarPercent,
        portfolioVarValue,
        undiversifiedVarValue,
        diversificationBenefit,
        individualVaRs,
        riskContributions,
        sharpeRatio
      });
    } catch (err) {
      console.error("Portfolio simulation error:", err);
      setPortfolioError(err.message || "Failed to calculate portfolio metrics.");
    } finally {
      setPortfolioLoading(false);
    }
  };

  const addAsset = () => {
    if (!newSymbol) return;
    let sym = newSymbol.trim().toUpperCase();
    if (!sym.includes('.') && !sym.includes('-')) {
      sym = `${sym}.NS`;
    }

    if (portfolio.some(item => item.symbol === sym)) {
      alert(`${sym} is already in your portfolio.`);
      return;
    }

    setPortfolio(prev => [...prev, { symbol: sym, weight: newWeight }]);
    setNewSymbol('');
  };

  const removeAsset = (index) => {
    if (index === 0) return;
    setPortfolio(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateWeight = (index, val) => {
    const w = Math.max(0, Math.min(100, parseInt(val) || 0));
    setPortfolio(prev => prev.map((item, idx) => idx === index ? { ...item, weight: w } : item));
  };

  // Normalizes portfolio weights to sum to exactly 100%
  const normalizeWeights = () => {
    const sum = portfolio.reduce((acc, item) => acc + item.weight, 0);
    if (sum <= 0) return;
    
    let normalized = portfolio.map(item => ({
      ...item,
      weight: Math.round((item.weight * 100) / sum)
    }));

    // Adjust rounding difference on the first asset
    const newSum = normalized.reduce((acc, item) => acc + item.weight, 0);
    if (newSum !== 100 && normalized.length > 0) {
      normalized[0].weight += (100 - newSum);
    }

    setPortfolio(normalized);
    setPortfolioError(null);
  };

  const cleanSymbol = selectedSymbol ? selectedSymbol.split('.')[0] : '';

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <h3 className="panel-title">
          <Shield size={18} style={{ color: 'var(--color-accent)' }} />
          Risk Manager & Allocation
        </h3>
        <span className="brand-tag">{cleanSymbol}</span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', overflowY: 'auto' }}>
        
        {/* Multi-Timeframe Trend Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Scale size={14} style={{ color: 'var(--color-accent)' }} />
            Multi-Timeframe Trend Matrix
          </span>
          
          <div className="trade-log-container" style={{ maxHeight: '110px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <RefreshCw size={14} className="spin-anim" />
                <span>Syncing timeframes...</span>
              </div>
            ) : !multiTimeframeData || !multiTimeframeData.success ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Failed to load timeframe matrix.
              </div>
            ) : (
              <table className="trade-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Price</th>
                    <th>Score</th>
                    <th>RSI</th>
                    <th>Signal</th>
                    <th>Pattern</th>
                  </tr>
                </thead>
                <tbody>
                  {multiTimeframeData.timeframes.map((tf) => (
                    <tr key={tf.interval}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tf.interval.toUpperCase()}</td>
                      {tf.error ? (
                        <td colSpan={5} style={{ color: 'var(--color-bearish)', fontSize: '0.65rem', textAlign: 'left', fontStyle: 'italic' }}>
                          Error loading data
                        </td>
                      ) : (
                        <>
                          <td>₹{tf.price?.toFixed(1) || 'N/A'}</td>
                          <td style={{ fontWeight: 600, color: tf.score >= 60 ? 'var(--color-bullish)' : tf.score <= 40 ? 'var(--color-bearish)' : 'var(--text-secondary)' }}>
                            {tf.score || 'N/A'}
                          </td>
                          <td style={{ color: getRsiColor(tf.rsi) }}>{tf.rsi ? tf.rsi.toFixed(0) : 'N/A'}</td>
                          <td>
                            <span className={getSignalBadgeClass(tf.signal)} style={{ padding: '0.1rem 0.35rem', fontSize: '0.62rem' }}>
                              {tf.signal || 'HOLD'}
                            </span>
                          </td>
                          <td style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '60px' }} title={tf.pattern}>
                            {tf.pattern !== 'None' && tf.pattern ? tf.pattern : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Risk Calculation Model Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsla(224, 60%, 8%, 0.4)', padding: '0.45rem 0.75rem', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Risk Model:</span>
          <div className="timeframe-container" style={{ padding: '0.15rem' }}>
            <button
              className={`timeframe-btn ${varMethod === 'PARAMETRIC' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem' }}
              onClick={() => setVarMethod('PARAMETRIC')}
            >
              Parametric (Normal)
            </button>
            <button
              className={`timeframe-btn ${varMethod === 'HISTORICAL' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem' }}
              onClick={() => setVarMethod('HISTORICAL')}
            >
              Historical (Fat-Tailed)
            </button>
          </div>
        </div>

        {/* Sub-tabs Toggle */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', marginTop: '0.1rem' }}>
          <button
            className={`timeframe-btn ${riskTab === 'POSITION' ? 'active' : ''}`}
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.72rem' }}
            onClick={() => setRiskTab('POSITION')}
          >
            Position Sizing
          </button>
          <button
            className={`timeframe-btn ${riskTab === 'PORTFOLIO' ? 'active' : ''}`}
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.72rem' }}
            onClick={() => setRiskTab('PORTFOLIO')}
          >
            Portfolio Simulator
          </button>
        </div>

        {riskTab === 'POSITION' ? (
          /* POSITION SIZING VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Sizing Parameters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'hsla(224, 50%, 15%, 0.15)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Coins size={14} style={{ color: 'var(--color-accent)' }} />
                Interactive Sizing Settings
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label" style={{ fontSize: '0.7rem' }}>Capital (₹)</label>
                  <input
                    type="number"
                    step="5000"
                    min="1000"
                    className="setting-input"
                    value={capital}
                    onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label" style={{ fontSize: '0.7rem' }}>Risk Limit (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    className="setting-input"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem', marginTop: '0.1rem' }}>
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label" style={{ fontSize: '0.68rem' }}>Entry</label>
                  <input
                    type="number"
                    step="0.1"
                    className="setting-input"
                    value={entry}
                    onChange={(e) => setEntry(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label" style={{ fontSize: '0.68rem' }}>Stop Loss</label>
                  <input
                    type="number"
                    step="0.1"
                    className="setting-input"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label" style={{ fontSize: '0.68rem' }}>Target</label>
                  <input
                    type="number"
                    step="0.1"
                    className="setting-input"
                    value={target}
                    onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Optimal Sizing Result */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 0.95rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, hsla(210, 100%, 55%, 0.1), hsla(145, 90%, 43%, 0.04))',
              border: '1px solid var(--color-accent)'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Optimal Position Sizing</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  {sharesToBuy} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Shares</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required Capital</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  ₹{totalTradeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* R:R Ratio Card */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.55rem 0.95rem',
              borderRadius: '10px',
              background: rating.bg,
              border: rating.border
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Risk-to-Reward Ratio</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: rating.color }}>
                1 : {rrRatio.toFixed(2)} ({rating.label})
              </span>
            </div>

            {/* Allocation Warnings */}
            {totalTradeValue > capital && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.68rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>Insufficient Capital: Trade requires {((totalTradeValue / capital) || 1).toFixed(1)}x of account balance (leverage required).</span>
              </div>
            )}

            {rrRatio < 1.5 && rrRatio > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.68rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>Poor R:R: Risking too much relative to potential reward (target 1:1.5 minimum).</span>
              </div>
            )}

            {/* Risk vs Profit Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(355, 90%, 61%, 0.03)', border: '1px solid hsla(355, 90%, 61%, 0.12)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingDown size={11} style={{ color: 'var(--color-bearish)' }} />
                  Max Risk (SL)
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-bearish)', marginTop: '0.15rem' }}>
                  -₹{actualRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {slPercent.toFixed(1)}% drop from entry
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(145, 90%, 43%, 0.03)', border: '1px solid hsla(145, 90%, 43%, 0.12)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingUp size={11} style={{ color: 'var(--color-bullish)' }} />
                  Max Profit (TP)
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-bullish)', marginTop: '0.15rem' }}>
                  +₹{actualReward.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {tpPercent.toFixed(1)}% rise from entry
                </span>
              </div>
            </div>

            {/* Aladdin Risk Engine */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.85rem', borderRadius: '12px', background: 'hsla(180, 100%, 45%, 0.02)', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={14} style={{ color: 'var(--color-accent)' }} />
                  Aladdin Risk Engine (1-Day VaR)
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Model: {varMethod === 'HISTORICAL' ? 'Historical' : 'Parametric'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'hsla(224, 60%, 5%, 0.4)', padding: '0.65rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>95% 1-Day VaR</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-bearish)', marginTop: '0.15rem' }}>
                    ₹{riskMetrics.varValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginLeft: '0.2rem' }}>
                      ({riskMetrics.varPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Annualized Volatility</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {riskMetrics.annualizedVol.toFixed(1)}%
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                      StdDev: {riskMetrics.dailyVol.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stress Test Matrix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.1rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Macro Stress Tests (Simulated Beta: {simulatedBeta.toFixed(2)})
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {stressScenarios.map((sc, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.55rem', background: 'hsla(224, 50%, 15%, 0.12)', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-primary)' }}>{sc.name}</span>
                        <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{sc.description}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-bearish)' }}>
                        {sc.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* PORTFOLIO SIMULATOR VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Holdings Weight Adjuster */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'hsla(224, 50%, 15%, 0.15)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Coins size={14} style={{ color: 'var(--color-accent)' }} />
                  Portfolio Holdings & Allocation
                </span>
                <span style={{ fontSize: '0.65rem', color: portfolioResults?.totalWeight === 100 ? 'var(--color-bullish)' : 'var(--color-warning)' }}>
                  Total: {portfolioResults ? portfolioResults.totalWeight : portfolio.reduce((sum, item) => sum + item.weight, 0)}%
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.15rem' }}>
                {portfolio.map((item, idx) => {
                  const hasFailed = failedAssets.includes(item.symbol);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'hsla(224, 50%, 10%, 0.35)', padding: '0.35rem 0.55rem', borderRadius: '6px', border: hasFailed ? '1px solid var(--color-bearish)' : '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {item.symbol.split('.')[0]} 
                        {idx === 0 && <span style={{ fontSize: '0.6rem', color: 'var(--color-accent)' }}>(Active)</span>}
                        {hasFailed && <span style={{ fontSize: '0.6rem', color: 'var(--color-bearish)', fontWeight: 'bold' }}>(Fetch Error)</span>}
                      </span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="setting-input"
                          style={{ width: '55px', padding: '0.2rem 0.4rem', textAlign: 'center', fontSize: '0.75rem', height: '24px' }}
                          value={item.weight}
                          onChange={(e) => updateWeight(idx, e.target.value)}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>%</span>
                      </div>

                      {idx !== 0 && (
                        <button 
                          onClick={() => removeAsset(idx)} 
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-bearish)', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center' }}
                          title="Remove from portfolio"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add asset row */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem', borderTop: '1px dotted var(--card-border)', paddingTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. INFY"
                  className="setting-input"
                  style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '26px' }}
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    className="setting-input"
                    style={{ width: '45px', padding: '0.25rem 0.4rem', fontSize: '0.75rem', height: '26px', textAlign: 'center' }}
                    value={newWeight}
                    onChange={(e) => setNewWeight(Math.max(1, Math.min(100, parseInt(e.target.value) || 0)))}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>%</span>
                </div>

                <button 
                  onClick={addAsset}
                  className="timeframe-btn" 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.5rem', height: '26px', background: 'var(--card-hover)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '6px' }}
                >
                  <Plus size={12} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.3rem' }}>
                <button 
                  className="timeframe-btn"
                  style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', border: '1px solid var(--card-border)', background: 'hsla(224, 50%, 15%, 0.3)' }}
                  onClick={normalizeWeights}
                >
                  Normalize Weights
                </button>
                <button 
                  className="btn-primary" 
                  style={{ padding: '0.45rem', fontSize: '0.75rem', margin: 0, height: '32px' }}
                  onClick={runPortfolioSimulation}
                  disabled={portfolioLoading}
                >
                  {portfolioLoading ? (
                    <>
                      <RefreshCw size={12} className="spin-anim" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                      Run Risk Models
                    </>
                  )}
                </button>
              </div>
            </div>

            {portfolioError && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.68rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>{portfolioError}</span>
              </div>
            )}

            {portfolioResults && !portfolioError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                
                {/* Diversification benefits comparison */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.85rem', borderRadius: '12px', background: 'hsla(180, 100%, 45%, 0.02)', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Portfolio 1-Day VaR</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                      ₹{portfolioResults.portfolioVarValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginLeft: '0.2rem' }}>
                        ({portfolioResults.portfolioVarPercent.toFixed(2)}%)
                      </span>
                    </span>
                  </div>

                  <div style={{ borderTop: '1px dotted var(--card-border)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>Undiversified Risk Sum:</span>
                      <span>₹{portfolioResults.undiversifiedVarValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-bullish)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <CheckCircle size={10} />
                        Diversification Benefit:
                      </span>
                      <span>
                        -₹{portfolioResults.diversificationBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                        ({(portfolioResults.undiversifiedVarValue > 0 ? (portfolioResults.diversificationBenefit / portfolioResults.undiversifiedVarValue * 100) : 0).toFixed(1)}%)
                      </span>
                    </div>

                    {/* Visual benefit meter */}
                    <div style={{ width: '100%', height: '5px', background: 'hsla(224, 50%, 15%, 0.6)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.15rem', display: 'flex' }}>
                      <div 
                        style={{ 
                          width: `${Math.max(10, Math.min(100, (portfolioResults.portfolioVarValue / portfolioResults.undiversifiedVarValue * 100)))}%`, 
                          background: 'var(--color-bearish)',
                          height: '100%'
                        }} 
                      />
                      <div 
                        style={{ 
                          flex: 1, 
                          background: 'var(--color-bullish)',
                          height: '100%'
                        }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Sharpe Ratio details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'hsla(224, 50%, 15%, 0.15)', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>Annualized Portfolio Vol</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {portfolioResults.portfolioAnnualVol.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>Est. Sharpe Ratio (6% Rf)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: portfolioResults.sharpeRatio >= 1.0 ? 'var(--color-bullish)' : portfolioResults.sharpeRatio > 0 ? 'var(--text-primary)' : 'var(--color-bearish)' }}>
                      {portfolioResults.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Risk Contribution vs Allocation Weight */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Risk Contribution vs Allocation Weight
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'hsla(224, 50%, 15%, 0.15)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                    {portfolioResults.individualVaRs.map((v_item, idx) => {
                      const rc = portfolioResults.riskContributions[idx];
                      const weight = portfolio.find(p => p.symbol === v_item.symbol)?.weight || 0;
                      const isDisproportionate = rc.rcPercent > weight;
                      
                      return (
                        <div key={v_item.symbol} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v_item.symbol.split('.')[0]}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Alloc: {weight}% | Risk: {rc.rcPercent.toFixed(1)}% (₹{rc.rcValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                          </div>
                          {/* Double progress bar: blue for allocation, amber/red for risk contribution */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'hsla(224, 50%, 5%, 0.4)', borderRadius: '4px', padding: '2px' }}>
                            <div style={{ display: 'flex', height: '4px', width: '100%' }}>
                              <div style={{ width: `${weight}%`, background: 'var(--color-accent)', borderRadius: '2px' }} />
                            </div>
                            <div style={{ display: 'flex', height: '4px', width: '100%' }}>
                              <div style={{ width: `${rc.rcPercent}%`, background: isDisproportionate ? 'var(--color-bearish)' : 'var(--color-bullish)', borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Asset correlation matrix grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Info size={11} style={{ color: 'var(--color-accent)' }} />
                    Asset Correlation Matrix (Log-Returns)
                  </div>
                  
                  <div style={{ overflowX: 'auto', background: 'hsla(224, 60%, 5%, 0.4)', borderRadius: '8px', border: '1px solid var(--card-border)', padding: '0.45rem' }}>
                    <table className="trade-table" style={{ fontSize: '0.68rem', width: '100%', minWidth: '220px' }}>
                      <thead>
                        <tr>
                          <th></th>
                          {portfolioResults.stats.map(s => (
                            <th key={s.symbol} style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                              {s.symbol.split('.')[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioResults.stats.map(s_row => (
                          <tr key={s_row.symbol}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)', padding: '0.35rem 0.5rem' }}>
                              {s_row.symbol.split('.')[0]}
                            </td>
                            {portfolioResults.stats.map(s_col => {
                              const corr = portfolioResults.correlationMatrix[s_row.symbol][s_col.symbol];
                              
                              let cellColor = 'var(--text-secondary)';
                              if (s_row.symbol === s_col.symbol) {
                                cellColor = 'var(--text-muted)';
                              } else if (corr >= 0.5) {
                                cellColor = 'var(--color-bearish)';
                              } else if (corr < 0.15) {
                                cellColor = 'var(--color-bullish)';
                              }
                              
                              return (
                                <td 
                                  key={s_col.symbol} 
                                  style={{ 
                                    padding: '0.35rem 0.5rem', 
                                    textAlign: 'center', 
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 'bold',
                                    color: cellColor
                                  }}
                                >
                                  {corr >= 0 ? '+' : ''}{corr.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* Sum Warning */}
            {portfolio.reduce((sum, item) => sum + item.weight, 0) !== 100 && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', color: 'var(--color-warning)', fontSize: '0.68rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>Allocation Warning: Weights sum to {portfolio.reduce((sum, item) => sum + item.weight, 0)}% (should equal 100%). You can click **Normalize Weights** to balance it.</span>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
