import React, { useEffect, useRef } from 'react';

export default function TradingViewWidget({ symbol, interval }) {
  const container = useRef();

  useEffect(() => {
    if (!container.current) return;

    // Clear previous widget
    container.current.innerHTML = '';

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Format interval for TradingView (D for daily, else minutes)
    let tvInterval = 'D';
    if (interval === '5m') tvInterval = '5';
    else if (interval === '15m') tvInterval = '15';
    else if (interval === '1h') tvInterval = '60';

    // Map NSE suffix (.NS) to TradingView symbol format (NSE:SYMBOL)
    let cleanSymbol = symbol;
    if (symbol.endsWith('.NS')) {
      cleanSymbol = `NSE:${symbol.split('.')[0]}`;
    } else if (symbol.endsWith('.BO')) {
      cleanSymbol = `BSE:${symbol.split('.')[0]}`;
    } else if (!symbol.includes(':')) {
      cleanSymbol = `NSE:${symbol}`;
    }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: cleanSymbol,
      interval: tvInterval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com'
    });

    container.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div 
      className="tradingview-widget-container" 
      ref={container} 
      style={{ height: '100%', width: '100%', background: 'rgba(9, 13, 26, 0.95)' }}
    >
      <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
