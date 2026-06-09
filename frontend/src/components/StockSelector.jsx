import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

const DEFAULT_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd.' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd.' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd.' },
  { symbol: 'SBIN.NS', name: 'State Bank of India' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd.' },
  { symbol: 'ITC.NS', name: 'ITC Ltd.' }
];

export default function StockSelector({ selectedSymbol, onSelectSymbol }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stocks, setStocks] = useState(DEFAULT_STOCKS);
  const [quotes, setQuotes] = useState({});

  // Fetch prices for active list of stocks
  useEffect(() => {
    async function fetchAllQuotes() {
      try {
        const fetchPromises = stocks.map(async (stock) => {
          try {
            const res = await fetch(`http://localhost:5000/api/stock/${stock.symbol}/quote`);
            const data = await res.json();
            if (data.success && data.quote) {
              return { symbol: stock.symbol, quote: data.quote };
            }
          } catch (e) {
            console.error('Error fetching quote for symbol:', stock.symbol, e);
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        const newQuotes = { ...quotes };
        results.forEach(res => {
          if (res) {
            newQuotes[res.symbol] = res.quote;
          }
        });
        setQuotes(newQuotes);
      } catch (err) {
        console.error('Error in fetchAllQuotes:', err);
      }
    }
    
    fetchAllQuotes();
    // Poll quotes every 15 seconds
    const interval = setInterval(fetchAllQuotes, 15000);
    return () => clearInterval(interval);
  }, [stocks]);

  // Helper to fetch quote immediately for a searched symbol
  const fetchSingleQuoteImmediate = async (symbol) => {
    try {
      const res = await fetch(`http://localhost:5000/api/stock/${symbol}/quote`);
      const data = await res.json();
      if (data.success && data.quote) {
        setQuotes(prev => ({
          ...prev,
          [symbol]: data.quote
        }));
      }
    } catch (e) {
      console.error('Error fetching immediate quote:', symbol, e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Auto suffix .NS if not specified
    let symbol = searchQuery.trim().toUpperCase();
    if (!symbol.includes('.') && !symbol.includes('-')) {
      symbol = `${symbol}.NS`;
    }

    // Check if it already exists in the list
    const exists = stocks.some(s => s.symbol === symbol);
    if (!exists) {
      const newStock = { symbol, name: 'Custom stock query' };
      setStocks([newStock, ...stocks]);
      fetchSingleQuoteImmediate(symbol);
      onSelectSymbol(symbol);
    } else {
      onSelectSymbol(symbol);
    }
    setSearchQuery('');
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <h3 className="panel-title">
          <Search size={18} style={{ color: 'var(--color-accent)' }} />
          Market Scanner
        </h3>
      </div>
      
      <div className="panel-body">
        <form onSubmit={handleSearchSubmit} className="stock-search-container">
          <Search className="search-icon" />
          <input
            type="text"
            className="stock-search-input"
            placeholder="Search stock symbol (e.g., RELIANCE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Quick Select (NSE India):
        </div>

        <div className="stock-list">
          {stocks.map((stock) => {
            const quote = quotes[stock.symbol];
            const price = quote ? quote.price : null;
            const changePercent = quote ? quote.changePercent : null;
            const isUp = changePercent >= 0;

            return (
              <div
                key={stock.symbol}
                className={`stock-item ${selectedSymbol === stock.symbol ? 'active' : ''}`}
                onClick={() => onSelectSymbol(stock.symbol)}
              >
                <div className="stock-item-info">
                  <span className="stock-symbol">{stock.symbol.split('.')[0]}</span>
                  <span className="stock-name">{stock.name}</span>
                </div>
                {price !== null ? (
                  <div className="stock-item-price">
                    <div style={{ fontWeight: 600 }}>₹{price.toFixed(2)}</div>
                    <div className={`signal-text ${isUp ? 'price-up' : 'price-down'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', fontSize: '0.75rem' }}>
                      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {isUp ? '+' : ''}{changePercent?.toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <div className="stock-item-price" style={{ color: 'var(--text-muted)' }}>
                    Loading...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
