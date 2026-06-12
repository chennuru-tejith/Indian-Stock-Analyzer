import React, { useState, useEffect } from 'react';
import { Shield, Coins, Scale, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export default function RiskManagerPanel({ selectedSymbol, intelligenceData, multiTimeframeData, loading }) {
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [entry, setEntry] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [target, setTarget] = useState(0);

  // Sync inputs with intelligence price levels on stock change
  useEffect(() => {
    if (intelligenceData && intelligenceData.success) {
      const price = intelligenceData.price || 0;
      setEntry(price);
      // Default SL to nearest support level or 2.5% below entry if no support
      setStopLoss(intelligenceData.support?.[0] || price * 0.975);
      // Default Target to nearest resistance level or 5% above entry if no resistance
      setTarget(intelligenceData.resistance?.[0] || price * 1.05);
    }
  }, [intelligenceData]);

  // Risk Math Calculations
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

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
        
        {/* Multi-Timeframe Trend Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Scale size={14} style={{ color: 'var(--color-accent)' }} />
            Multi-Timeframe Trend Matrix
          </span>
          
          <div className="trade-log-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <RefreshCw size={14} className="spin-anim" />
                <span>Syncing timeframes...</span>
              </div>
            ) : !multiTimeframeData || !multiTimeframeData.success ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
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
                      <td>₹{tf.price?.toFixed(1) || 'N/A'}</td>
                      <td style={{ fontWeight: 600, color: tf.score >= 60 ? 'var(--color-bullish)' : tf.score <= 40 ? 'var(--color-bearish)' : 'var(--text-secondary)' }}>
                        {tf.score || 'N/A'}
                      </td>
                      <td style={{ color: getRsiColor(tf.rsi) }}>{tf.rsi ? tf.rsi.toFixed(0) : 'N/A'}</td>
                      <td>
                        <span className={getSignalBadgeClass(tf.signal)} style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}>
                          {tf.signal}
                        </span>
                      </td>
                      <td style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '65px' }} title={tf.pattern}>
                        {tf.pattern !== 'None' ? tf.pattern : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Calculator Settings Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'hsla(224, 50%, 15%, 0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coins size={14} style={{ color: 'var(--color-accent)' }} />
            Interactive Allocation Settings
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Account Capital (₹)</label>
              <input
                type="number"
                step="1000"
                min="1000"
                className="setting-input"
                value={capital}
                onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Risk Per Trade (%)</label>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Entry Price</label>
              <input
                type="number"
                step="0.1"
                className="setting-input"
                value={entry}
                onChange={(e) => setEntry(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Stop Loss (SL)</label>
              <input
                type="number"
                step="0.1"
                className="setting-input"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Target (TP)</label>
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

        {/* Sizing & Allocation Outputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          {/* Position Size Summary Card */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, hsla(210, 100%, 55%, 0.1), hsla(145, 90%, 43%, 0.05))',
            border: '1px solid var(--color-accent)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optimal Position Sizing</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {sharesToBuy} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Shares</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required Capital</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                ₹{totalTradeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* R:R Ratio Rating */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            background: rating.bg,
            border: rating.border
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Risk-to-Reward Ratio</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: rating.color }}>
              1 : {rrRatio.toFixed(2)} ({rating.label})
            </span>
          </div>

          {/* Warning check */}
          {totalTradeValue > capital && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.72rem' }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              <span>Insufficient Capital: Trade requires {((totalTradeValue / capital) || 1).toFixed(1)}x of account balance (leverage required).</span>
            </div>
          )}

          {rrRatio < 1.5 && rrRatio > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.72rem' }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              <span>Poor R:R: Risking too much relative to potential reward (target 1:1.5 minimum).</span>
            </div>
          )}

          {rrRatio >= 1.5 && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--color-bullish)', fontSize: '0.72rem' }}>
              <CheckCircle size={12} style={{ flexShrink: 0 }} />
              <span>Risk Matched: Position size aligns perfectly with your {riskPercent}% capital risk limit.</span>
            </div>
          )}

          {/* Max Loss vs Max Reward */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginTop: '0.1rem'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'hsla(355, 90%, 61%, 0.03)',
              border: '1px solid hsla(355, 90%, 61%, 0.15)',
              borderRadius: '10px',
              padding: '0.6rem 0.85rem'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingDown size={12} style={{ color: 'var(--color-bearish)' }} />
                Max Risk (SL Hit)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-bearish)', marginTop: '0.2rem' }}>
                -₹{actualRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {slPercent.toFixed(1)}% drop from entry
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'hsla(145, 90%, 43%, 0.03)',
              border: '1px solid hsla(145, 90%, 43%, 0.15)',
              borderRadius: '10px',
              padding: '0.6rem 0.85rem'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingUp size={12} style={{ color: 'var(--color-bullish)' }} />
                Max Profit (TP Hit)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-bullish)', marginTop: '0.2rem' }}>
                +₹{actualReward.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {tpPercent.toFixed(1)}% rise from entry
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
