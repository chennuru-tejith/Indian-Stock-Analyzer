import React, { useState, useEffect, useCallback } from 'react';
import StockSelector from './components/StockSelector';
import ChartContainer from './components/ChartContainer';
import SignalAlerts from './components/SignalAlerts';
import BacktestResults from './components/BacktestResults';
import { Sliders, RefreshCw, BarChart2, Activity, Play, CheckCircle } from 'lucide-react';
import './App.css';

export default function App() {
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [timeframe, setTimeframe] = useState('1d'); // '5m'|'15m'|'1h'|'1d'
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      }
    } catch (e) {
      setError('Connection to backend server failed. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

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
      }
    } catch (e) {
      console.error('Error fetching backtest results:', e);
    } finally {
      setBacktestLoading(false);
    }
  }, [symbol, timeframe, stopLoss, takeProfit, confidenceFilter]);

  // Load data on settings change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchBacktest();
  }, [fetchBacktest]);

  // Polling mechanism for live update
  useEffect(() => {
    const isMarketHours = () => {
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeVal = hours * 60 + minutes;
      
      // Indian Market: Monday to Friday, 9:15 AM to 3:30 PM IST (555 to 930 minutes)
      // Note: System timezone might be user local time, which is usually IST (+5:30) for Indian user
      const isWeekday = day >= 1 && day <= 5;
      const isMarketTime = timeVal >= 9 * 60 + 15 && timeVal <= 15 * 60 + 30;
      return isWeekday && isMarketTime;
    };

    const intervalId = setInterval(() => {
      // Always allow refreshing in dev/test, but useful to auto-refresh for live quotes
      fetchData();
    }, 20000); // Poll every 20 seconds

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
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">₹</div>
          <div>
            <h1 className="brand-name">INDICATOR FUSION</h1>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
              <span className="brand-tag">Candlestick Analyzer</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

          <button onClick={fetchData} className="timeframe-btn" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

        {/* Right Column: Signal Alert Feeds & Backtest Performance */}
        <section className="right-column">
          <SignalAlerts candles={candles} />
          
          <div style={{ flex: 1, minHeight: 0 }}>
            {backtestLoading ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Running simulated historical backtests...
              </div>
            ) : (
              <BacktestResults backtestData={backtestData} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
