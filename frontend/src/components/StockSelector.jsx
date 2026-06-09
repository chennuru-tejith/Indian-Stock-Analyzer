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
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  // Debounced search for stocks
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`http://localhost:5000/api/stock/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success && data.results) {
          setSearchResults(data.results);
          setShowDropdown(data.results.length > 0);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } catch (err) {
        console.error('Error searching stocks:', err);
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

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

  const selectStock = (stock) => {
    // Check if it already exists in the list
    const exists = stocks.some(s => s.symbol === stock.symbol);
    if (!exists) {
      setStocks([stock, ...stocks]);
    }
    fetchSingleQuoteImmediate(stock.symbol);
    onSelectSymbol(stock.symbol);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    if (searchResults.length > 0) {
      selectStock(searchResults[0]);
    } else {
      // Auto suffix .NS if not specified
      let symbol = searchQuery.trim().toUpperCase();
      if (!symbol.includes('.') && !symbol.includes('-')) {
        symbol = `${symbol}.NS`;
      }
      const newStock = { symbol, name: 'Custom stock query' };
      selectStock(newStock);
    }
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
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 200);
            }}
            autoComplete="off"
          />
          {isSearching && (
            <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <span className="spin-anim" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%' }}></span>
            </div>
          )}
          {showDropdown && searchResults.length > 0 && (
            <div className="search-suggestions-dropdown">
              {searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="suggestion-item"
                  onMouseDown={() => selectStock(result)}
                >
                  <div className="suggestion-info">
                    <span className="suggestion-symbol">{result.symbol.split('.')[0]}</span>
                    <span className="suggestion-name">{result.name}</span>
                  </div>
                  <span className="suggestion-exchange">{result.exchange}</span>
                </div>
              ))}
            </div>
          )}
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
