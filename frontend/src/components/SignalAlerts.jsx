import React, { useState } from 'react';
import { Bell, ShieldAlert, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function SignalAlerts({ candles }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'

  // Extract all candles with active signals, sorted latest first
  const signals = candles
    .filter(c => c.signal && c.signal !== 'HOLD')
    .map(c => ({
      time: typeof c.time === 'number' 
        ? new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(c.time * 1000).toLocaleDateString()
        : c.time,
      rawTime: c.time,
      price: c.close,
      signal: c.signal,
      confidence: c.confidence,
      reason: c.reason,
      patterns: c.patterns
    }))
    .reverse();

  const filteredSignals = filter === 'ALL' 
    ? signals 
    : signals.filter(s => s.signal === filter);

  return (
    <div className="glass-panel alerts-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <h3 className="panel-title">
          <Bell size={18} style={{ color: 'var(--color-warning)' }} />
          Live Patterns & Signals
        </h3>
        
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {['ALL', 'BUY', 'SELL'].map(btn => (
            <button
              key={btn}
              onClick={() => setFilter(btn)}
              className="timeframe-btn"
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.65rem',
                background: filter === btn ? (btn === 'BUY' ? 'var(--color-bullish)' : btn === 'SELL' ? 'var(--color-bearish)' : 'var(--color-accent)') : 'transparent',
                color: filter === btn ? 'var(--bg-primary)' : 'var(--text-secondary)'
              }}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-body">
        {filteredSignals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>
            No patterns or trading signals triggered in the current view.
          </div>
        ) : (
          <div className="alerts-list">
            {filteredSignals.slice(0, 30).map((sig, idx) => {
              const isBuy = sig.signal === 'BUY';
              return (
                <div key={idx} className={`alert-card ${isBuy ? 'buy' : 'sell'}`}>
                  <div className="alert-header">
                    <span className={`signal-badge ${isBuy ? 'buy' : 'sell'}`}>
                      {isBuy ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                      {sig.signal} ({sig.confidence})
                    </span>
                    <span className="alert-time">{sig.time}</span>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.25rem' }}>
                    Trigger Price: <span style={{ fontFamily: 'var(--font-mono)' }}>₹{sig.price.toFixed(2)}</span>
                  </div>

                  <div className="alert-reason">
                    {sig.reason}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
