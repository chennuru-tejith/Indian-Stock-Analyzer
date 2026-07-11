import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertTriangle, ArrowUpDown, Shield, CheckCircle, HelpCircle } from 'lucide-react';

export default function ValueScreenerPanel({ onSelectSymbol }) {
  const [screenerReport, setScreenerReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScreenerResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/screener/results');
      const data = await res.json();
      if (data.success) {
        setScreenerReport(data.report);
      } else {
        setError(data.error || 'Failed to load daily screener results.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to backend server failed.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch cached daily results on mount
  useEffect(() => {
    fetchScreenerResults();
  }, []);

  const runLiveScreener = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/screener/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScreenerReport(data.report);
      } else {
        setError(data.error || 'Failed to run live screener.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to backend server failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !screenerReport) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--color-accent)' }} />
        <span>Analyzing Indian stock fundamentals & 52-week price returns...</span>
      </div>
    );
  }

  const resultsList = screenerReport?.fullResults || [];
  const topPicksCount = resultsList.filter(r => r.divergenceScore >= 65).length;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Shield size={18} style={{ color: 'var(--color-accent)' }} />
          <h3 className="panel-title" style={{ margin: 0 }}>
            AI Value-Price Divergence Screener
          </h3>
        </div>
        
        <button 
          onClick={runLiveScreener}
          className="timeframe-btn"
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '26px', fontSize: '0.68rem', padding: '0 0.55rem', background: 'var(--card-hover)', border: '1px solid var(--card-border)', cursor: 'pointer', borderRadius: '6px' }}
        >
          <RefreshCw size={11} className={loading ? 'spin-anim' : ''} />
          {loading ? 'Scanning...' : 'Scan Live'}
        </button>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        {/* Explanation Card */}
        <div style={{
          padding: '0.8rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, hsla(210, 100%, 55%, 0.05), hsla(145, 90%, 43%, 0.02))',
          border: '1px solid var(--color-accent)',
          fontSize: '0.72rem',
          lineHeight: '1.25'
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
            💡 Institutional Value-Price Divergence Rule
          </span>
          This engine isolates stocks showing **excellent fundamental metrics** (low PE ratio, high ROE, healthy debt leverage, and revenue growth) but **depressed/flat 1-year price performance**. High divergence scores identify undervalued accumulative targets before technical breakouts.
        </div>

        {/* Errors */}
        {error && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.68rem' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {screenerReport && (
          <>
            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(145, 90%, 43%, 0.03)', border: '1px solid hsla(145, 90%, 43%, 0.12)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 500 }}>Daily Value Picks Found</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-bullish)', marginTop: '0.15rem' }}>
                  {topPicksCount} / {screenerReport.totalScreened}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(224, 50%, 15%, 0.15)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 500 }}>Last Audit Timestamp</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                  {new Date(screenerReport.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Daily Check)
                </span>
              </div>
            </div>

            {/* Screener Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: '300px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Audit Results (Sorted by Divergence)
              </span>

              <div className="trade-log-container" style={{ maxHeight: 'none', overflowY: 'visible' }}>
                <table className="trade-table" style={{ fontSize: '0.68rem' }}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Price</th>
                      <th>PE</th>
                      <th>ROE</th>
                      <th>1Y Ret</th>
                      <th>F-Score</th>
                      <th>Div-Score</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsList.map((pick) => {
                      const isHighValue = pick.divergenceScore >= 65;
                      const isNegativeReturn = pick.oneYearReturnPercent <= 0;
                      
                      return (
                        <tr key={pick.symbol} style={{ borderLeft: isHighValue ? '2px solid var(--color-bullish)' : 'none' }}>
                          <td style={{ fontWeight: 600 }}>
                            <button 
                              onClick={() => onSelectSymbol(pick.symbol)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontWeight: 700, textDecoration: 'underline' }}
                              title="Click to load stock"
                            >
                              {pick.symbol.split('.')[0]}
                            </button>
                          </td>
                          <td>₹{pick.currentPrice.toLocaleString()}</td>
                          <td style={{ color: pick.pe < 25 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{pick.pe === 999 ? 'N/A' : pick.pe}</td>
                          <td style={{ color: pick.roePercent > 12 ? 'var(--color-bullish)' : 'var(--text-muted)' }}>{pick.roePercent}%</td>
                          <td className={isNegativeReturn ? 'price-down' : 'price-up'} style={{ fontWeight: 600 }}>
                            {pick.oneYearReturnPercent >= 0 ? '+' : ''}{pick.oneYearReturnPercent}%
                          </td>
                          <td style={{ fontWeight: 600, color: pick.fundamentalScore >= 60 ? 'var(--color-bullish)' : 'var(--text-muted)' }}>{pick.fundamentalScore}</td>
                          <td style={{ fontWeight: 800, color: isHighValue ? 'var(--color-bullish)' : 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {pick.divergenceScore}
                          </td>
                          <td>
                            <span 
                              style={{ 
                                padding: '0.1rem 0.35rem', 
                                borderRadius: '4px', 
                                fontSize: '0.58rem', 
                                fontWeight: 700, 
                                display: 'inline-block',
                                background: pick.divergenceScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : pick.divergenceScore >= 65 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                                color: pick.divergenceScore >= 65 ? 'var(--color-bullish)' : 'var(--text-muted)',
                                border: pick.divergenceScore >= 65 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--card-border)'
                              }}
                            >
                              {pick.divergenceScore >= 80 ? 'STRONG VALUE' : pick.divergenceScore >= 65 ? 'VALUE BUY' : pick.fundamentalScore >= 60 ? 'PRICED IN' : 'WEAK FUND'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
