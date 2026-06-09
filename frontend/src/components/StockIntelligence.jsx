import React from 'react';
import { ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, BookOpen, ExternalLink, Activity } from 'lucide-react';

export default function StockIntelligence({ data, loading }) {
  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Analyzing market patterns, news reports, and S/R levels...
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No intelligence report generated. Select a symbol.
      </div>
    );
  }

  const {
    price,
    support,
    resistance,
    yearlyHigh,
    yearlyLow,
    unifiedScore,
    recommendation,
    newsSentiment,
    newsSentimentScore,
    newsMetrics,
    articles
  } = data;

  // 52-week range percentage
  const yearlyRange = yearlyHigh - yearlyLow;
  const yearlyPositionPercent = yearlyRange > 0 ? ((price - yearlyLow) / yearlyRange) * 100 : 0;

  // Unified Recommendation colors
  const getRecommendationStyle = (rec) => {
    switch (rec) {
      case 'STRONG BUY':
        return { color: 'var(--color-bullish)', bg: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--color-bullish)' };
      case 'BUY':
        return { color: '#a7f3d0', bg: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'STRONG SELL':
        return { color: 'var(--color-bearish)', bg: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--color-bearish)' };
      case 'SELL':
        return { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.3)' };
      default:
        return { color: 'var(--text-secondary)', bg: 'rgba(71, 85, 105, 0.15)', border: '1px solid var(--card-border)' };
    }
  };

  const recStyle = getRecommendationStyle(recommendation);

  // Time formatting helper
  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <h3 className="panel-title">
          <Activity size={18} style={{ color: 'var(--color-accent)' }} />
          Stock Intelligence Report
        </h3>
        <span className="brand-tag" style={{ background: recStyle.bg, color: recStyle.color, border: recStyle.border }}>
          {recommendation}
        </span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Recommendation Gauge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          borderRadius: '12px',
          background: 'hsla(224, 50%, 15%, 0.25)',
          border: '1px solid var(--card-border)'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unified Quality Score</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '0.25rem', color: recStyle.color }}>
              {unifiedScore} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pillar Summary</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
              Trend: <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{unifiedScore >= 50 ? 'Strong' : 'Weak'}</span> • 
              News: <span style={{ color: newsSentimentScore >= 50 ? 'var(--color-bullish)' : 'var(--color-bearish)', fontWeight: 600 }}>
                {newsSentiment}
              </span>
            </div>
          </div>
        </div>

        {/* 52-Week Range */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            <span>52-Week Low</span>
            <span>Current Range Proximity</span>
            <span>52-Week High</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <span>₹{yearlyLow.toFixed(1)}</span>
            
            <div style={{ flex: 1, height: '6px', background: 'var(--card-border)', borderRadius: '3px', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: `${yearlyPositionPercent}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-accent)',
                boxShadow: '0 0 8px var(--glow-accent)',
                zIndex: 2
              }} />
              <div style={{
                height: '100%',
                width: `${yearlyPositionPercent}%`,
                background: 'linear-gradient(to right, var(--color-bearish), var(--color-bullish))',
                borderRadius: '3px'
              }} />
            </div>

            <span>₹{yearlyHigh.toFixed(1)}</span>
          </div>
        </div>

        {/* Support & Resistance Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Key Support Levels</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {support.map((lvl, idx) => (
                <div key={idx} style={{
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--color-bullish)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Support {idx + 1}</span>
                  <span>₹{lvl.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Key Resistance Levels</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {resistance.map((lvl, idx) => (
                <div key={idx} style={{
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--color-bearish)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Resistance {idx + 1}</span>
                  <span>₹{lvl.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* News & Sentiment Feed */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontSize: '0.8rem', 
            fontWeight: 600, 
            marginBottom: '0.5rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
              Live Sentiment News Feed
            </span>
            <span style={{
              fontSize: '0.7rem',
              color: newsSentimentScore >= 50 ? 'var(--color-bullish)' : 'var(--color-bearish)',
              background: newsSentimentScore >= 50 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '0.15rem 0.4rem',
              borderRadius: '4px',
              border: `1px solid ${newsSentimentScore >= 50 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}>
              Sentiment: {newsSentimentScore}% Bullish
            </span>
          </div>

          <div className="trade-log-container" style={{ flex: 1, overflowY: 'auto' }}>
            {articles.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No recent news reports indexed for this symbol.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {articles.map((art, idx) => {
                  const isBull = art.sentiment === 'BULLISH';
                  const isBear = art.sentiment === 'BEARISH';
                  
                  return (
                    <a
                      key={idx}
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid hsla(224, 50%, 20%, 0.15)',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'hsla(224, 50%, 20%, 0.15)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                          {art.title}
                        </span>
                        <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>{art.publisher} • {formatTime(art.time)}</span>
                        
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: isBull ? 'var(--color-bullish)' : isBear ? 'var(--color-bearish)' : 'var(--text-secondary)',
                          background: isBull ? 'rgba(16, 185, 129, 0.1)' : isBear ? 'rgba(239, 68, 68, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px'
                        }}>
                          {art.sentiment}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
