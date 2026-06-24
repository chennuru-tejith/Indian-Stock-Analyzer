import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import TradingViewWidget from './TradingViewWidget';
import { Activity, BarChart3, LineChart } from 'lucide-react';

export default function ChartContainer({ 
  candles, 
  selectedSymbol, 
  interval, 
  takeProfit, 
  stopLoss,
  supportLevels = [],
  resistanceLevels = []
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  
  // Chart Type: 'FUSION' (Custom indicator chart) | 'LIVE' (TradingView Embed)
  const [chartType, setChartType] = useState('FUSION');
  const [showPatterns, setShowPatterns] = useState(true);

  useEffect(() => {
    // Only initialize custom chart if FUSION type is active and we have candles
    if (chartType !== 'FUSION' || !chartContainerRef.current || candles.length === 0) return;

    // Remove any existing chart first to avoid duplicates
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(9, 13, 26, 0.95)' },
        textColor: '#94a3b8',
        fontFamily: 'Outfit, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)' }
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 3 // LineStyle.Dashed
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 3
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        visible: true
      },
      timeScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        timeVisible: interval !== '1d', // show time only for intraday
        secondsVisible: false
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight
    });

    chartRef.current = chart;

    // 1. Add Candlestick Series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });

    candlestickSeries.setData(candles.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    })));

    // 2. Add EMA 20 (Electric Blue)
    const ema20Data = candles
      .filter(c => c.ema20 !== null && c.ema20 !== undefined)
      .map(c => ({ time: c.time, value: c.ema20 }));
    
    if (ema20Data.length > 0) {
      const emaSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 1.5,
        title: 'EMA 20'
      });
      emaSeries.setData(ema20Data);
    }

    // 3. Add SMA 200 (Gold)
    const sma200Data = candles
      .filter(c => c.sma200 !== null && c.sma200 !== undefined)
      .map(c => ({ time: c.time, value: c.sma200 }));

    if (sma200Data.length > 0) {
      const smaSeries = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 2,
        title: 'SMA 200'
      });
      smaSeries.setData(sma200Data);
    }

    // 4. Add Volume Series in separate scale margin (bottom 20%)
    const volumeSeries = chart.addHistogramSeries({
      color: '#475569',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume'
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8, // takes up bottom 20%
        bottom: 0
      }
    });

    volumeSeries.setData(candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
    })));

    // 5. Add markers for BUY and SELL signals (Decluttered Crossover Logic)
    const markers = [];
    candles.forEach((c, idx) => {
      if (idx === 0) return;
      const prev = candles[idx - 1];

      // Trigger only on crossover to prevent overlapping clutter
      const isNewBuy = c.signal === 'BUY' && prev.signal !== 'BUY' && (c.confidence === 'HIGH' || c.confidence === 'MEDIUM');
      const isNewSell = c.signal === 'SELL' && prev.signal !== 'SELL' && (c.confidence === 'HIGH' || c.confidence === 'MEDIUM');

      if (isNewBuy) {
        markers.push({
          time: c.time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `BUY`,
          size: 1.2
        });
      } else if (isNewSell) {
        markers.push({
          time: c.time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: `SELL`,
          size: 1.2
        });
      }

      // Add Candlestick Pattern Overlay if enabled
      if (showPatterns && c.patterns && c.patterns.length > 0) {
        const pattern = c.patterns[0];
        let position = 'belowBar';
        if (pattern.type === 'bearish') {
          position = 'aboveBar';
        } else if (pattern.type === 'bullish') {
          position = 'belowBar';
        } else {
          position = 'belowBar';
        }

        // Collision avoidance: shift if signal marker occupies same position
        if (isNewBuy && position === 'belowBar') {
          position = 'aboveBar';
        } else if (isNewSell && position === 'aboveBar') {
          position = 'belowBar';
        }

        let color = '#f59e0b'; // neutral default
        if (pattern.type === 'bullish') {
          color = '#10b981';
        } else if (pattern.type === 'bearish') {
          color = '#ef4444';
        }

        markers.push({
          time: c.time,
          position: position,
          color: color,
          shape: 'circle',
          text: pattern.name,
          size: 1.0
        });
      }
    });

    if (markers.length > 0) {
      candlestickSeries.setMarkers(markers);
    }

    // 6. Draw Stop Loss & Take Profit Target Lines for the most recent active signal
    const lastSignaledCandle = [...candles]
      .reverse()
      .find(c => (c.signal === 'BUY' || c.signal === 'SELL') && (c.confidence === 'HIGH' || c.confidence === 'MEDIUM'));

    if (lastSignaledCandle && takeProfit && stopLoss) {
      const entryPrice = lastSignaledCandle.close;
      const isBuy = lastSignaledCandle.signal === 'BUY';
      
      const slPrice = isBuy 
        ? entryPrice * (1 - stopLoss / 100) 
        : entryPrice * (1 + stopLoss / 100);
      const tpPrice = isBuy 
        ? entryPrice * (1 + takeProfit / 100) 
        : entryPrice * (1 - takeProfit / 100);

      // Create Entry Line
      candlestickSeries.createPriceLine({
        price: entryPrice,
        color: '#3b82f6',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Entry (${lastSignaledCandle.signal})`
      });

      // Create Take Profit Line
      candlestickSeries.createPriceLine({
        price: tpPrice,
        color: '#10b981',
        lineWidth: 1.5,
        lineStyle: 3, // LargeDashed
        axisLabelVisible: true,
        title: `Target TP (+${isBuy ? '' : '-'}${takeProfit}%)`
      });

      // Create Stop Loss Line
      candlestickSeries.createPriceLine({
        price: slPrice,
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: 3, // LargeDashed
        axisLabelVisible: true,
        title: `Target SL (${isBuy ? '-' : '+'}${stopLoss}%)`
      });
    }

    // 7. Draw Historical Support Lines (Green)
    if (supportLevels && supportLevels.length > 0) {
      supportLevels.forEach((priceLevel, i) => {
        candlestickSeries.createPriceLine({
          price: priceLevel,
          color: 'rgba(16, 185, 129, 0.4)',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: `Support ${i + 1}`
        });
      });
    }

    // 8. Draw Historical Resistance Lines (Red)
    if (resistanceLevels && resistanceLevels.length > 0) {
      resistanceLevels.forEach((priceLevel, i) => {
        candlestickSeries.createPriceLine({
          price: priceLevel,
          color: 'rgba(239, 68, 68, 0.4)',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: `Resistance ${i + 1}`
        });
      });
    }

    // Adjust chart time scale to fit data
    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, interval, takeProfit, stopLoss, supportLevels, resistanceLevels, chartType, showPatterns]);

  // Extract latest prices
  const latestCandle = candles[candles.length - 1];
  const price = latestCandle ? latestCandle.close : null;
  const changePercent = candles.length > 1 
    ? ((latestCandle.close - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100
    : 0;
  const isUp = changePercent >= 0;

  return (
    <div className="glass-panel chart-panel">
      <div className="chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {selectedSymbol.split('.')[0]}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              NSE India • {interval}
            </span>
          </div>

          {price !== null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', fontFamily: 'var(--font-mono)' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                ₹{price.toFixed(2)}
              </span>
              <span className={isUp ? 'price-up' : 'price-down'} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {isUp ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Custom Indicator Chart vs Live TradingView Chart Toggle */}
          <div className="timeframe-container">
            <button
              onClick={() => setChartType('FUSION')}
              className={`timeframe-btn ${chartType === 'FUSION' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <BarChart3 size={12} />
              Fusion Indicators
            </button>
            <button
              onClick={() => setChartType('LIVE')}
              className={`timeframe-btn ${chartType === 'LIVE' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <LineChart size={12} />
              TradingView Live
            </button>
          </div>

          {chartType === 'FUSION' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => setShowPatterns(!showPatterns)}
                className={`timeframe-btn ${showPatterns ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <Activity size={12} />
                Patterns: {showPatterns ? 'ON' : 'OFF'}
              </button>
              <div className="chart-legend" style={{ marginLeft: '0.5rem' }}>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></span>
                  <span>EMA 20</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
                  <span>SMA 200</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-wrapper">
        {chartType === 'LIVE' ? (
          <TradingViewWidget symbol={selectedSymbol} interval={interval} />
        ) : candles.length === 0 ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            Loading market data and indicators...
          </div>
        ) : (
          <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
        )}
      </div>
    </div>
  );
}
