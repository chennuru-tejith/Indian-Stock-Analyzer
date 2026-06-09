import yahooFinance from 'yahoo-finance2';

/**
 * Standardizes Indian stock symbols by appending '.NS' (NSE) if no exchange suffix is present.
 * @param {string} symbol - The input stock symbol (e.g. "RELIANCE", "TCS.BO")
 * @returns {string} - The formatted symbol (e.g. "RELIANCE.NS", "TCS.BO")
 */
export function formatSymbol(symbol) {
  if (!symbol) return '';
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol.includes('.') && !cleanSymbol.includes('-')) {
    return `${cleanSymbol}.NS`; // Default to NSE
  }
  return cleanSymbol;
}

/**
 * Fetches historical OHLCV data for a given symbol.
 * For daily timeframe, retrieves up to 5-10 years.
 * For intraday (e.g. 5m, 15m, 1h), retrieves the maximum allowable period.
 * 
 * Yahoo Finance constraints:
 * - 1m: max 7 days
 * - 2m/5m/15m/30m: max 60 days
 * - 60m/1h: max 730 days
 * - 1d: multi-year (we will fetch past 5-10 years)
 * 
 * @param {string} rawSymbol - The stock symbol
 * @param {string} interval - Timeframe: '1m'|'5m'|'15m'|'1h'|'1d'
 * @param {number} yearsLimit - Max years of history for daily data
 * @returns {Promise<Array>} - Standardized array of OHLCV candles
 */
export async function fetchStockData(rawSymbol, interval = '1d', yearsLimit = 5) {
  const symbol = formatSymbol(rawSymbol);
  const now = new Date();
  let startDate = new Date();

  // Determine start date based on interval limits
  if (interval === '1d') {
    startDate.setFullYear(now.getFullYear() - yearsLimit);
  } else if (interval === '1h' || interval === '60m') {
    startDate.setDate(now.getDate() - 700); // 730 days limit, safe buffer
  } else if (['2m', '5m', '15m', '30m'].includes(interval)) {
    startDate.setDate(now.getDate() - 58); // 60 days limit, safe buffer
  } else if (interval === '1m') {
    startDate.setDate(now.getDate() - 6); // 7 days limit, safe buffer
  } else {
    // Default fallback
    startDate.setFullYear(now.getFullYear() - 1);
  }

  try {
    // Disable historical cache/safety checking if it interferes
    yahooFinance.setGlobalConfig({
      validation: { logErrors: false }
    });

    if (interval === '1d') {
      const queryOptions = {
        period1: startDate,
        period2: now,
        interval: '1d'
      };
      const result = await yahooFinance.historical(symbol, queryOptions);
      
      // Filter and format the data
      const sortedDaily = result
        .filter(candle => candle.open && candle.high && candle.low && candle.close)
        .map(candle => {
          const d = new Date(candle.date);
          return {
            time: d.toISOString().split('T')[0], // YYYY-MM-DD format for daily
            timestamp: Math.floor(d.getTime() / 1000),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume: Number(candle.volume)
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      return deduplicateCandles(sortedDaily);
    } else {
      // Use chart endpoint for intraday data
      const queryOptions = {
        period1: Math.floor(startDate.getTime() / 1000),
        period2: Math.floor(now.getTime() / 1000),
        interval: interval === '1h' ? '60m' : interval // map 1h to 60m for Yahoo Finance
      };

      const result = await yahooFinance.chart(symbol, queryOptions);
      if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error(`No quotes returned for chart interval ${interval}`);
      }

      const sortedIntraday = result.quotes
        .filter(candle => candle.open && candle.high && candle.low && candle.close)
        .map(candle => {
          const d = new Date(candle.date);
          return {
            time: Math.floor(d.getTime() / 1000), // Unix timestamp in seconds for intraday
            timestamp: Math.floor(d.getTime() / 1000),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume: Number(candle.volume)
          };
        })
        .sort((a, b) => a.time - b.time);

      return deduplicateCandles(sortedIntraday);
    }
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch data for ${symbol}: ${error.message}`);
  }
}

/**
 * Deduplicates candle series by timestamp.
 */
function deduplicateCandles(candles) {
  const seen = new Set();
  return candles.filter(c => {
    const key = String(c.time);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetches current real-time quote for a stock.
 * @param {string} rawSymbol - The stock symbol
 * @returns {Promise<Object>} - Real-time price and changes
 */
export async function fetchRealTimeQuote(rawSymbol) {
  const symbol = formatSymbol(rawSymbol);
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote) throw new Error("No quote data returned");

    return {
      symbol: symbol,
      price: quote.regularMarketPrice || quote.postMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      volume: quote.regularMarketVolume,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      open: quote.regularMarketOpen,
      previousClose: quote.regularMarketPreviousClose,
      time: Math.floor((quote.regularMarketTime || new Date()).getTime() / 1000)
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`);
  }
}
