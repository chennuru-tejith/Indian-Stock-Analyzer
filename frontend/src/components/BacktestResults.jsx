import React from 'react';
import { BarChart3, HelpCircle, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

export default function BacktestResults({ backtestData }) {
  if (!backtestData || !backtestData.success) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Select a stock and timeframe to see backtest performance results.
      </div>
    );
  }

  const { summary, trades } = backtestData.results;
  const hasTrades = trades.length > 0;

  return (
    <div className="glass-panel backtest-panel">
      <div className="panel-header">
        <h3 className="panel-title">
          <BarChart3 size={18} style={{ color: 'var(--color-accent)' }} />
          Backtest Performance Analysis (Historical verification)
        </h3>
        <span className="brand-tag">Verified Strategy</span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
        {/* Statistics Grid */}
        <div className="backtest-stats-grid">
          <div className="stat-box">
            <span className="stat-label">Net Return</span>
            <span className={`stat-value ${summary.netProfitPercent >= 0 ? 'price-up' : 'price-down'}`}>
              {summary.netProfitPercent >= 0 ? '+' : ''}
              {summary.netProfitPercent.toFixed(2)}%
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value" style={{ color: summary.winRate >= 50 ? 'var(--color-bullish)' : 'var(--color-warning)' }}>
              {summary.winRate.toFixed(1)}%
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Profit Factor</span>
            <span className="stat-value" style={{ color: summary.profitFactor >= 1.5 ? 'var(--color-bullish)' : summary.profitFactor >= 1.0 ? 'var(--text-primary)' : 'var(--color-bearish)' }}>
              {summary.profitFactor.toFixed(2)}
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Max Drawdown</span>
            <span className="stat-value price-down">
              -{summary.maxDrawdownPercent.toFixed(2)}%
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Total Trades</span>
            <span className="stat-value" style={{ color: 'var(--color-accent)' }}>
              {summary.totalTrades}
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Avg Return / Trade</span>
            <span className={`stat-value ${summary.avgTradeReturnPercent >= 0 ? 'price-up' : 'price-down'}`}>
              {summary.avgTradeReturnPercent >= 0 ? '+' : ''}
              {summary.avgTradeReturnPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Advisory Warning */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div>
            <strong>Risk Warning</strong>: Backtest results are simulated and reflect historical data. Past performance does not guarantee future live trading results. Verify win rate and drawdown before allocating capital.
          </div>
        </div>

        {/* Trade Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Historical Trades Execution Log</span>
            <span style={{ color: 'var(--text-muted)' }}>{trades.length} Trades</span>
          </div>

          <div className="trade-log-container">
            {!hasTrades ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No trades executed under current parameters.
              </div>
            ) : (
              <table className="trade-table">
                <thead>
                  <tr>
                    <th>Entry Date</th>
                    <th>Entry Price</th>
                    <th>Exit Date</th>
                    <th>Exit Price</th>
                    <th>Return %</th>
                    <th>Exit Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice().reverse().map((trade, idx) => {
                    const isWin = trade.returnPercent > 0;
                    
                    // Format dates
                    const formatDate = (t) => {
                      if (typeof t === 'number') {
                        return new Date(t * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }
                      return t;
                    };

                    return (
                      <tr key={`${trade.entryTime}-${trade.exitTime}-${idx}`}>
                        <td>{formatDate(trade.entryTime)}</td>
                        <td>₹{trade.entryPrice.toFixed(2)}</td>
                        <td>{formatDate(trade.exitTime)}</td>
                        <td>₹{trade.exitPrice.toFixed(2)}</td>
                        <td className={isWin ? 'price-up' : 'price-down'}>
                          {isWin ? '+' : ''}{trade.returnPercent.toFixed(2)}%
                        </td>
                        <td style={{ color: trade.exitReason === 'Stop Loss' ? 'var(--color-bearish)' : trade.exitReason === 'Take Profit' ? 'var(--color-bullish)' : 'var(--text-secondary)' }}>
                          {trade.exitReason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
