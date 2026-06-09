import YahooFinanceClass from 'yahoo-finance2';

// yahoo-finance2 v3 default export is the YahooFinance class which must be instantiated.
const yahooFinance = typeof YahooFinanceClass === 'function'
  ? new YahooFinanceClass({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })
  : YahooFinanceClass;

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
    if (interval === '1d') {
      const queryOptions = {
        period1: startDate,
        period2: now,
        interval: '1d'
      };
      
      // Using chart endpoint instead of deprecated historical endpoint
      const result = await yahooFinance.chart(symbol, queryOptions);
      if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error(`No quotes returned for chart interval ${interval}`);
      }

      // Filter and format the data
      const sortedDaily = result.quotes
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

/**
 * Fetches latest news for a symbol and calculates sentiment.
 * @param {string} rawSymbol - The stock symbol
 * @returns {Promise<Object>} - News feed and sentiment ratings
 */
export async function fetchStockNews(rawSymbol) {
  const symbol = formatSymbol(rawSymbol);
  try {
    const searchResult = await yahooFinance.search(symbol);
    const articles = (searchResult.news || []).map(item => {
      const title = item.title || '';
      const publisher = item.publisher || 'Unknown';
      const link = item.link || '#';
      const time = item.providerPublishTime 
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : new Date().toISOString();

      // Simple Algorithmic Sentiment Analysis
      const bullishKeywords = [
        'gain', 'growth', 'profit', 'rise', 'surge', 'bullish', 'upgrade', 'higher', 
        'record', 'high', 'advance', 'jump', 'recovery', 'beat', 'positive', 'strong', 
        'up', 'outperform', 'partnership', 'expand', 'deal', 'buy', 'dividend'
      ];
      
      const bearishKeywords = [
        'loss', 'drop', 'fall', 'decline', 'bearish', 'downgrade', 'lower', 'low', 
        'dip', 'plunge', 'cut', 'slump', 'negative', 'weak', 'down', 'underperform', 
        'miss', 'slashed', 'debt', 'fine', 'lawsuit', 'probe', 'warn', 'sell'
      ];

      const cleanTitle = title.toLowerCase();
      let bullishCount = 0;
      let bearishCount = 0;

      bullishKeywords.forEach(word => {
        if (cleanTitle.includes(word)) bullishCount++;
      });

      bearishKeywords.forEach(word => {
        if (cleanTitle.includes(word)) bearishCount++;
      });

      let sentiment = 'NEUTRAL';
      if (bullishCount > bearishCount) {
        sentiment = 'BULLISH';
      } else if (bearishCount > bullishCount) {
        sentiment = 'BEARISH';
      }

      return {
        title,
        publisher,
        link,
        time,
        sentiment,
        score: bullishCount - bearishCount
      };
    });

    // Calculate aggregated sentiment score
    let score = 50; // base score is neutral
    let bullishArticles = 0;
    let bearishArticles = 0;

    articles.forEach(art => {
      if (art.sentiment === 'BULLISH') {
        score += 15;
        bullishArticles++;
      } else if (art.sentiment === 'BEARISH') {
        score -= 15;
        bearishArticles++;
      }
    });

    score = Math.max(0, Math.min(100, score)); // clamp between 0 and 100
    
    let newsSentiment = 'NEUTRAL';
    if (score > 60) newsSentiment = 'BULLISH';
    if (score < 40) newsSentiment = 'BEARISH';

    return {
      symbol,
      newsSentiment,
      sentimentScore: score,
      metrics: {
        total: articles.length,
        bullish: bullishArticles,
        bearish: bearishArticles,
        neutral: articles.length - (bullishArticles + bearishArticles)
      },
      articles
    };
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error.message);
    return {
      symbol,
      newsSentiment: 'NEUTRAL',
      sentimentScore: 50,
      metrics: { total: 0, bullish: 0, bearish: 0, neutral: 0 },
      articles: []
    };
  }
}
