import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertTriangle, Play, Power, DollarSign, Briefcase, FileText } from 'lucide-react';

export default function BrokerPanel({ activeSymbol, activePrice }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Connection settings form
  const [broker, setBroker] = useState('Sandbox');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [pin, setPin] = useState('');

  const fetchAccountDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/broker/account');
      const data = await res.json();
      if (data.success) {
        setAccount(data.account);
      }
    } catch (err) {
      console.error(err);
      setError('Connection to backend broker endpoint failed.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch account status on mount
  useEffect(() => {
    fetchAccountDetails();
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/broker/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, apiKey, apiSecret, pin })
      });
      const data = await res.json();
      if (data.success) {
        setAccount(data.account);
      } else {
        setError(data.error || 'Connection failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Broker API request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/broker/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAccount(data.account);
      }
    } catch (err) {
      console.error(err);
      setError('Broker disconnect request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (symbol, qty, avgPrice) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/broker/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: qty > 0 ? 'SELL' : 'BUY', // Sell to exit long, buy to cover short
          quantity: Math.abs(qty),
          price: activeSymbol === symbol ? activePrice : avgPrice,
          orderType: 'MARKET'
        })
      });
      const data = await res.json();
      if (data.success) {
        setAccount(data.account);
        alert(data.message);
      } else {
        setError(data.error || 'Failed to exit position.');
      }
    } catch (err) {
      console.error(err);
      setError('Broker execution request failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !account) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--color-accent)' }} />
        <span>Synchronizing broker account details and active margins...</span>
      </div>
    );
  }

  const isConnected = account?.connected;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <h3 className="panel-title">
          <Power size={18} style={{ color: isConnected ? 'var(--color-bullish)' : 'var(--text-muted)' }} />
          Broker Connection Terminal
        </h3>
        <span className="brand-tag">{isConnected ? account.broker.toUpperCase() : 'DISCONNECTED'}</span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        
        {!isConnected ? (
          /* CONNECT FORM */
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{
              padding: '0.8rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid var(--card-border)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)'
            }}>
              Connect your Indian stock broker account to enable direct algorithmic order execution from the terminal. 
              API credentials are encrypted in local session memory.
            </div>

            {error && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-bearish)', fontSize: '0.68rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="setting-group" style={{ margin: 0 }}>
              <label className="setting-label">Select Broker</label>
              <select
                className="setting-input"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="Sandbox">Sandbox Paper Trading (Instant Connect)</option>
                <option value="Zerodha">Zerodha (Kite Connect API)</option>
                <option value="AngelOne">Angel One (SmartAPI)</option>
                <option value="Upstox">Upstox API</option>
              </select>
            </div>

            {broker !== 'Sandbox' && (
              <>
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label">API Key</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter API Key"
                    className="setting-input"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label">API Secret</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter API Secret"
                    className="setting-input"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                  />
                </div>
                <div className="setting-group" style={{ margin: 0 }}>
                  <label className="setting-label">2FA PIN / Totp</label>
                  <input
                    type="password"
                    placeholder="2FA PIN"
                    className="setting-input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn-primary" style={{ margin: '0.5rem 0 0 0' }}>
              <Power size={14} />
              Connect Account
            </button>
          </form>
        ) : (
          /* ACCOUNT HOLDINGS & STATS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Account Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(145, 90%, 43%, 0.03)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <DollarSign size={10} style={{ color: 'var(--color-bullish)' }} />
                  Cash Balance
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  ₹{account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', background: 'hsla(210, 100%, 55%, 0.03)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Shield size={10} style={{ color: 'var(--color-accent)' }} />
                  Margin Available
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  ₹{account.marginAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Active holdings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Briefcase size={12} style={{ color: 'var(--color-accent)' }} />
                Active Portfolio Positions ({account.positions.length})
              </span>

              {account.positions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', border: '1px dotted var(--card-border)', borderRadius: '8px' }}>
                  No open holdings. Use the Sizing manager to execute new trades.
                </div>
              ) : (
                <div className="trade-log-container" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  <table className="trade-table" style={{ fontSize: '0.68rem' }}>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Qty</th>
                        <th>Avg Price</th>
                        <th>Value</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.positions.map((pos) => {
                        const isShort = pos.quantity < 0;
                        const value = Math.abs(pos.quantity) * pos.averagePrice;
                        return (
                          <tr key={pos.symbol}>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pos.symbol.split('.')[0]}</td>
                            <td style={{ color: isShort ? 'var(--color-bearish)' : 'var(--color-bullish)', fontWeight: 'bold' }}>
                              {pos.quantity}
                            </td>
                            <td>₹{pos.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>₹{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td>
                              <button
                                onClick={() => handleClosePosition(pos.symbol, pos.quantity, pos.averagePrice)}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid var(--color-bearish)',
                                  color: 'var(--color-bearish)',
                                  padding: '0.1rem 0.35rem',
                                  fontSize: '0.58rem',
                                  fontWeight: 'bold',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                EXIT
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Order execution log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <FileText size={12} />
                Order Execution Logs ({account.orders.length})
              </span>

              {account.orders.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  No transactions recorded today.
                </div>
              ) : (
                <div className="trade-log-container" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                  <table className="trade-table" style={{ fontSize: '0.65rem' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.orders.slice().reverse().map((ord) => {
                        const time = new Date(ord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        return (
                          <tr key={ord.orderId}>
                            <td>{time}</td>
                            <td style={{ color: ord.side === 'BUY' ? 'var(--color-bullish)' : 'var(--color-bearish)', fontWeight: 'bold' }}>
                              {ord.side} {ord.symbol.split('.')[0]}
                            </td>
                            <td>{ord.quantity}</td>
                            <td>₹{ord.price.toFixed(1)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ord.orderId}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Disconnect trigger */}
            <button 
              onClick={handleDisconnect}
              className="timeframe-btn"
              style={{
                width: '100%',
                height: '30px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--color-bearish)',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '6px',
                marginTop: '0.5rem'
              }}
            >
              Disconnect Broker
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
