import React from 'react';
import { Globe, TrendingUp, TrendingDown, RefreshCw, Info, HelpCircle, ArrowRightLeft, ShieldAlert, Award } from 'lucide-react';

export default function GlobalMacroPanel({ data, loading }) {
  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin-anim" style={{ marginBottom: '1rem', color: 'var(--color-accent)' }} />
        <div>Aggregating S&P 500, Commodities, Exchange Rates, and Interest Yields...</div>
      </div>
    );
  }

  if (!data || !data.success || !data.predictiveTrend) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No macroeconomic prediction available. Select a stock to view analysis.
      </div>
    );
  }

  const {
    macroScore,
    macroSentiment,
    projectedTrend,
    direction,
    confidence,
    reasoning,
    indicators
  } = data.predictiveTrend;

  // Style helper for trend projections
  const getTrendStyle = (trend) => {
    if (trend.includes('BULLISH')) {
      if (trend.includes('HEADWINDS')) {
        return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)' };
      }
      return { color: 'var(--color-bullish)', bg: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-bullish)' };
    } else if (trend.includes('BEARISH')) {
      if (trend.includes('CUSHIONED')) {
        return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)' };
      }
      return { color: 'var(--color-bearish)', bg: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-bearish)' };
    }
    return { color: 'var(--text-secondary)', bg: 'rgba(71, 85, 105, 0.15)', border: '1px solid var(--card-border)' };
  };

  const trendStyle = getTrendStyle(projectedTrend);

  // Position on the -100 to +100 slider
  const sliderPositionPercent = ((macroScore + 100) / 200) * 100;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <h3 className="panel-title">
          <Globe size={18} style={{ color: 'var(--color-accent)' }} />
          Global Macro & Predictive Panel
        </h3>
        <span className="brand-tag" style={{ background: trendStyle.bg, color: trendStyle.color, border: trendStyle.border }}>
          {projectedTrend}
        </span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', overflowY: 'auto' }}>
        
        {/* Next Trend Projection & Confidence */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          borderRadius: '12px',
          background: 'hsla(224, 50%, 15%, 0.25)',
          border: '1px solid var(--card-border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Next Trend</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: trendStyle.color, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {direction === 'UP' && <TrendingUp size={20} />}
                {direction === 'DOWN' && <TrendingDown size={20} />}
                {direction === 'SIDEWAYS_UP' && <TrendingUp size={20} style={{ transform: 'rotate(15deg)' }} />}
                {direction === 'SIDEWAYS_DOWN' && <TrendingDown size={20} style={{ transform: 'rotate(-15deg)' }} />}
                {direction === 'SIDEWAYS' && <ArrowRightLeft size={20} />}
                {projectedTrend}
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', marginTop: '0.15rem' }}>
                {confidence}%
              </div>
            </div>
          </div>

          {/* Confidence Progress Bar */}
          <div>
            <div style={{ height: '5px', background: 'var(--card-border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${confidence}%`,
                background: 'linear-gradient(to right, var(--color-accent), var(--color-bullish))',
                borderRadius: '3px',
                transition: 'width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)'
              }} />
            </div>
          </div>
        </div>

        {/* Global Macro Sentiment Score Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Global Macro Sentiment Index
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: macroScore > 0 ? 'var(--color-bullish)' : macroScore < 0 ? 'var(--color-bearish)' : 'var(--text-muted)'
            }}>
              {macroScore > 0 ? `+${macroScore}` : macroScore}
            </span>
          </div>

          {/* Slider visual */}
          <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
            <div style={{
              position: 'absolute',
              left: `${sliderPositionPercent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 3
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary)',
                boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
                border: '2px solid var(--bg-primary)'
              }} />
            </div>
            
            {/* Gradient Background bar */}
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              background: 'linear-gradient(to right, var(--color-bearish) 0%, var(--card-border) 50%, var(--color-bullish) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <span>Macro Headwinds (-100)</span>
            <span>Neutral (0)</span>
            <span>Supportive (+100)</span>
          </div>
        </div>

        {/* Predictive Correlation Reasoning */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '0.85rem 1rem',
          borderRadius: '12px',
          background: 'rgba(59, 130, 246, 0.03)',
          border: '1px dashed rgba(59, 130, 246, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Award size={14} style={{ color: 'var(--color-accent)' }} />
            Economic Correlation Analysis
          </div>
          <p style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
            textAlign: 'left'
          }}>
            {reasoning}
          </p>
        </div>

        {/* Global Asset Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Global Macroeconomic Triggers
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.6rem'
          }}>
            {indicators.map((asset) => {
              // Correlation helper for color indicators
              // sp500/nasdaq: + is good, - is bad
              // crude/usdInr/gold/yields: + is bad, - is good
              const changeVal = asset.changePercent;
              const isEquity = asset.symbol === '^GSPC' || asset.symbol === '^IXIC';
              
              let isBullishForIndia = false;
              if (isEquity) {
                isBullishForIndia = changeVal > 0;
              } else {
                // Commodity, currency, yield: negative change is bullish for emerging market equity
                isBullishForIndia = changeVal < 0;
              }

              const isZero = changeVal === 0;

              return (
                <div key={asset.symbol} style={{
                  background: 'hsla(224, 50%, 15%, 0.15)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--card-hover)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>{asset.name}</span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: isZero ? 'var(--text-muted)' : isBullishForIndia ? 'var(--color-bullish)' : 'var(--color-bearish)',
                      background: isZero ? 'rgba(71,85,105,0.1)' : isBullishForIndia ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '0.05rem 0.25rem',
                      borderRadius: '3px'
                    }}>
                      {isZero ? '' : isBullishForIndia ? 'Bullish' : 'Bearish'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.1rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
                      {asset.symbol === 'USDINR=X' ? '₹' : asset.symbol === 'GC=F' ? '$' : asset.symbol === 'CL=F' ? '$' : ''}
                      {asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                      {asset.symbol === '^TNX' ? '%' : ''}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: changeVal >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)'
                    }}>
                      {changeVal >= 0 ? '+' : ''}{changeVal.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
