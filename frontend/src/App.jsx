import React, { useState, useEffect, useCallback } from 'react';
import StockSelector from './components/StockSelector';
import ChartContainer from './components/ChartContainer';
import SignalAlerts from './components/SignalAlerts';
import BacktestResults from './components/BacktestResults';
import StockIntelligence from './components/StockIntelligence';
import GlobalMacroPanel from './components/GlobalMacroPanel';
import RiskManagerPanel from './components/RiskManagerPanel';
import { Sliders, RefreshCw, BarChart2, Activity, Play, BrainCircuit, Globe, Shield } from 'lucide-react';
import './App.css';

export default function App() {
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [timeframe, setTimeframe] = useState('1d'); // '5m'|'15m'|'1h'|'1d'
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Theme State (Aladdin, Bloomberg, Matrix, Navy)
  const [theme, setTheme] = useState(() => localStorage.getItem('aladdin-theme') || 'aladdin');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aladdin-theme', theme);
  }, [theme]);

  // Tabs: 'INTELLIGENCE' | 'BACKTEST'
  const [activeTab, setActiveTab] = useState('INTELLIGENCE');

  // Intelligence State
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);

  // Multi-Timeframe Matrix State
  const [multiTimeframeData, setMultiTimeframeData] = useState(null);
  const [multiTimeframeLoading, setMultiTimeframeLoading] = useState(false);

  // Backtest parameters state
  const [stopLoss, setStopLoss] = useState(2.5);
  const [takeProfit, setTakeProfit] = useState(5.0);
  const [confidenceFilter, setConfidenceFilter] = useState('HIGH,MEDIUM');
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Fetch stock candles and indicators
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/api/stock/${symbol}/history?interval=${timeframe}`);
      const data = await res.json();
      if (data.success) {
        setCandles(data.candles);
      } else {
        setError(data.error || 'Failed to fetch stock history.');
        setCandles([]);
      }
    } catch (e) {
      setError('Connection to backend server failed. Make sure the backend server is running.');
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  // Fetch stock intelligence
  const fetchIntelligence = useCallback(async () => {
    setIntelligenceLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/stock/${symbol}/intelligence`);
      const data = await res.json();
      if (data.success) {
        setIntelligenceData(data);
      } else {
        setIntelligenceData(null);
      }
    } catch (e) {
      console.error('Error fetching intelligence report:', e);
      setIntelligenceData(null);
    } finally {
      setIntelligenceLoading(false);
    }
  }, [symbol]);

  // Fetch multi-timeframe matrix
  const fetchMultiTimeframe = useCallback(async () => {
    setMultiTimeframeLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/stock/${symbol}/multi-timeframe`);
      const data = await res.json();
      if (data.success) {
        setMultiTimeframeData(data);
      } else {
        setMultiTimeframeData(null);
      }
    } catch (e) {
      console.error('Error fetching multi timeframe matrix:', e);
      setMultiTimeframeData(null);
    } finally {
      setMultiTimeframeLoading(false);
    }
  }, [symbol]);

  // Fetch backtest data
  const fetchBacktest = useCallback(async () => {
    setBacktestLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/stock/${symbol}/backtest?interval=${timeframe}&sl=${stopLoss}&tp=${takeProfit}&confidence=${confidenceFilter}`
      );
      const data = await res.json();
      if (data.success) {
        setBacktestData(data);
      } else {
        setBacktestData(null);
      }
    } catch (e) {
      console.error('Error fetching backtest results:', e);
      setBacktestData(null);
    } finally {
      setBacktestLoading(false);
    }
  }, [symbol, timeframe, stopLoss, takeProfit, confidenceFilter]);

  // Load data on state changes
  useEffect(() => {
    fetchData();
    fetchIntelligence();
    fetchMultiTimeframe();
  }, [symbol, timeframe, fetchData, fetchIntelligence, fetchMultiTimeframe]);

  useEffect(() => {
    fetchBacktest();
  }, [symbol, timeframe, stopLoss, takeProfit, confidenceFilter, fetchBacktest]);

  // Polling mechanism for live update
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
      // Only refresh news/intelligence occasionally (every 60s) to avoid API rate limits
    }, 20000);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Summary indicators calculations
  const latestCandle = candles[candles.length - 1];
  const rsiVal = latestCandle?.rsi;
  const macdVal = latestCandle?.macd;

  const getRsiStatus = (val) => {
    if (!val) return { label: 'Neutral', color: 'var(--text-secondary)' };
    if (val >= 70) return { label: 'Overbought', color: 'var(--color-bearish)' };
    if (val <= 30) return { label: 'Oversold', color: 'var(--color-bullish)' };
    return { label: 'Neutral', color: 'var(--text-muted)' };
  };

  const getMacdStatus = (val) => {
    if (!val) return { label: 'Neutral', color: 'var(--text-secondary)' };
    if (val.histogram > 0) return { label: 'Bullish Momentum', color: 'var(--color-bullish)' };
    if (val.histogram < 0) return { label: 'Bearish Momentum', color: 'var(--color-bearish)' };
    return { label: 'Neutral', color: 'var(--text-muted)' };
  };

  const rsiStatus = getRsiStatus(rsiVal);
  const macdStatus = getMacdStatus(macdVal);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header" style={{ padding: '0.85rem 2rem' }}>
        <div className="brand">
          <div className="brand-logo" style={{ background: 'linear-gradient(135deg, var(--color-accent), hsl(180, 100%, 35%))', boxShadow: '0 0 15px var(--glow-accent)' }}>
            A
          </div>
          <div>
            <h1 className="brand-name" style={{ letterSpacing: '0.05em' }}>ALADDIN FUSION AI</h1>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
              <span className="brand-tag" style={{ color: 'var(--color-accent)', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
                Black-Box Risk Engine
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v1.2.0</span>
            </div>
          </div>
        </div>

        {/* Aladdin Quantitative Telemetry Bar */}
        <div className="telemetry-container">
          <div className="telemetry-item">
            <span className="pulse-green"></span>
            <span className="telemetry-label">SYSTEM:</span>
            <span className="telemetry-value" style={{ color: 'var(--color-bullish)' }}>ONLINE</span>
          </div>
          <div className="telemetry-item" style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '1rem' }}>
            <span className="telemetry-label">ENGINES:</span>
            <span className="telemetry-value" style={{ color: 'var(--color-accent)' }}>ACTIVE</span>
          </div>
          <div className="telemetry-item" style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '1rem' }}>
            <span className="telemetry-label">LATENCY:</span>
            <span className="telemetry-value">14ms</span>
          </div>
          <div className="telemetry-item" style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '1rem' }}>
            <span className="telemetry-label">MODEL RUNS:</span>
            <span className="telemetry-value" style={{ fontFamily: 'var(--font-mono)' }}>50,000/S</span>
          </div>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginRight: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Palette:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="setting-input"
              style={{
                cursor: 'pointer',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                background: 'hsla(224, 60%, 8%, 0.8)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                height: '30px'
              }}
            >
              <option value="aladdin">Aladdin Cyan</option>
              <option value="bloomberg">Bloomberg Amber</option>
              <option value="matrix">Matrix Green</option>
              <option value="navy">Navy Command</option>
            </select>
          </div>

          <div className="timeframe-container">
            {['5m', '15m', '1h', '1d'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button onClick={fetchData} className="timeframe-btn" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px', width: '30px' }}>
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-grid">
        {/* Left Column: Selector & Parameters */}
        <section className="left-column">
          <StockSelector selectedSymbol={symbol} onSelectSymbol={setSymbol} />

          {/* Strategy Parameters Panel */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <Sliders size={18} style={{ color: 'var(--color-accent)' }} />
                Strategy Parameters
              </h3>
            </div>
            <div className="panel-body">
              <div className="setting-group">
                <label className="setting-label">Take Profit (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="setting-input"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="setting-group">
                <label className="setting-label">Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="setting-input"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="setting-group">
                <label className="setting-label">Min Confidence Filter</label>
                <select
                  className="setting-input"
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="HIGH">HIGH Only</option>
                  <option value="HIGH,MEDIUM">HIGH & MEDIUM</option>
                  <option value="HIGH,MEDIUM,LOW">ALL (HIGH/MED/LOW)</option>
                </select>
              </div>

              <button className="btn-primary" onClick={fetchBacktest}>
                <Play size={16} />
                Run Backtest Verify
              </button>
            </div>
          </div>
        </section>

        {/* Center Column: Interactive Trading Chart & Indicators summary */}
        <section className="center-column" style={{ gridColumn: 'span 1' }}>
          {error && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'hsla(355, 90%, 61%, 0.1)',
              border: '1px solid var(--color-bearish)',
              color: 'var(--color-bearish)',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          <ChartContainer 
            candles={candles} 
            selectedSymbol={symbol} 
            interval={timeframe} 
            takeProfit={takeProfit} 
            stopLoss={stopLoss} 
            supportLevels={intelligenceData?.support || []}
            resistanceLevels={intelligenceData?.resistance || []}
          />

          {/* Quick Technical Summary */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.85rem' }}>
              <Activity size={16} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Technical Indicators Dashboard</span>
            </div>
            
            <div className="indicators-grid">
              <div className="indicator-card">
                <span className="indicator-label">RSI (14-period)</span>
                <div className="indicator-value">
                  {rsiVal ? rsiVal.toFixed(1) : 'N/A'}
                  <span className="indicator-status" style={{ color: rsiStatus.color }}>
                    {rsiStatus.label}
                  </span>
                </div>
              </div>

              <div className="indicator-card">
                <span className="indicator-label">MACD (12, 26, 9)</span>
                <div className="indicator-value">
                  {macdVal ? macdVal.histogram.toFixed(2) : 'N/A'}
                  <span className="indicator-status" style={{ color: macdStatus.color }}>
                    {macdStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Toggleable Stock Intelligence vs Backtest */}
        <section className="right-column">
          <div className="glass-panel" style={{ display: 'flex', padding: '0.4rem', gap: '0.3rem', borderBottom: '1px solid var(--card-border)' }}>
            <button 
              className={`timeframe-btn ${activeTab === 'INTELLIGENCE' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.6rem 0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
              onClick={() => setActiveTab('INTELLIGENCE')}
            >
              <BrainCircuit size={12} />
              Local Intel
            </button>
            <button 
              className={`timeframe-btn ${activeTab === 'MACRO' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.6rem 0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
              onClick={() => setActiveTab('MACRO')}
            >
              <Globe size={12} />
              Global Macro
            </button>
            <button 
              className={`timeframe-btn ${activeTab === 'RISK' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.6rem 0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
              onClick={() => setActiveTab('RISK')}
            >
              <Shield size={12} />
              Risk Manager
            </button>
            <button 
              className={`timeframe-btn ${activeTab === 'BACKTEST' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.6rem 0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
              onClick={() => setActiveTab('BACKTEST')}
            >
              <BarChart2 size={12} />
              Backtester
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {activeTab === 'INTELLIGENCE' ? (
              <StockIntelligence data={intelligenceData} loading={intelligenceLoading} />
            ) : activeTab === 'MACRO' ? (
              <GlobalMacroPanel data={intelligenceData} loading={intelligenceLoading} />
            ) : activeTab === 'RISK' ? (
              <RiskManagerPanel 
                selectedSymbol={symbol}
                intelligenceData={intelligenceData}
                multiTimeframeData={multiTimeframeData}
                loading={multiTimeframeLoading}
                candles={candles}
              />
            ) : (
              <div>
                {backtestLoading ? (
                  <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Running simulated historical backtests...
                  </div>
                ) : (
                  <BacktestResults backtestData={backtestData} />
                )}
              </div>
            )}
          </div>

          <div style={{ height: '300px' }}>
            <SignalAlerts candles={candles} />
          </div>
        </section>
      </main>
    </div>
  );
}
