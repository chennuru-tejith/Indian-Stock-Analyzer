import { yahooFinance } from '../services/dataService.js';

async function scanLiveMarket() {
  const symbols = ['^NSEI', '^BSESN', 'CL=F', 'USDINR=X', '^TNX', '^GSPC'];
  const nameMapping = {
    '^NSEI': 'Nifty 50',
    '^BSESN': 'BSE Sensex',
    'CL=F': 'Crude Oil Futures',
    'USDINR=X': 'USD / INR',
    '^TNX': 'US 10Y Yield',
    '^GSPC': 'S&P 500'
  };

  console.log("==========================================");
  console.log("    LIVE MARKET TELEMETRY SCANNER         ");
  console.log("==========================================");
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    const quotes = await yahooFinance.quote(symbols);
    const quotesList = Array.isArray(quotes) ? quotes : [quotes];

    const data = {};
    symbols.forEach(sym => {
      const q = quotesList.find(item => item.symbol === sym) || {};
      data[sym] = {
        name: nameMapping[sym],
        price: q.regularMarketPrice || q.postMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0
      };
    });

    // Output raw quotes
    console.log("--- Current Market Quotes ---");
    symbols.forEach(sym => {
      const item = data[sym];
      const sign = item.change >= 0 ? "+" : "";
      console.log(`${item.name.padEnd(20)}: ₹/$/% ${item.price.toFixed(2).padStart(8)} (${sign}${item.changePercent.toFixed(2)}%)`);
    });
    console.log("");

    // Formulate economic diagnosis
    const nifty = data['^NSEI'];
    const sensex = data['^BSESN'];
    const oil = data['CL=F'];
    const usdinr = data['USDINR=X'];
    const yields = data['^TNX'];
    const sp500 = data['^GSPC'];

    let diagnosis = "";
    let sentiment = "NEUTRAL";
    let score = 50;

    // Evaluate Indian Index
    const niftyChg = nifty.changePercent;
    const sensexChg = sensex.changePercent;
    
    if (niftyChg < -0.8 || sensexChg < -0.8) {
      sentiment = "BEARISH";
      score = 25;
      diagnosis += "🔴 SYSTEMIC CORRECTION: Indian equity indices are experiencing a significant sell-off. ";
    } else if (niftyChg > 0.8 && sensexChg > 0.8) {
      sentiment = "BULLISH";
      score = 75;
      diagnosis += "🟢 RISK-ON MOMENTUM: Indian equity indices are gaining strongly. ";
    } else {
      diagnosis += "🟡 CONSOLIDATION: Indian indices are trading sideways. ";
    }

    diagnosis += `Nifty 50 is at ${nifty.price.toFixed(1)} (${niftyChg >= 0 ? '+' : ''}${niftyChg.toFixed(2)}%) and Sensex is at ${sensex.price.toFixed(1)} (${sensexChg >= 0 ? '+' : ''}${sensexChg.toFixed(2)}%).\n\n`;

    diagnosis += "--- Key Catalyst Analysis ---\n";

    // Crude Oil trigger
    if (oil.changePercent > 1.5) {
      diagnosis += `* Crude Oil price spike (+${oil.changePercent.toFixed(2)}% to $${oil.price.toFixed(2)}): As a major oil importer, rising Brent prices increase India's import bills, widening trade deficits and raising corporate input cost inflation.\n`;
    } else if (oil.changePercent < -1.5) {
      diagnosis += `* Crude Oil price soft (-${Math.abs(oil.changePercent).toFixed(2)}% to $${oil.price.toFixed(2)}): Easing crude prices act as a strong fiscal tailwind for Indian companies, reducing manufacturing and logistics costs.\n`;
    } else {
      diagnosis += `* Crude Oil remains stable at $${oil.price.toFixed(2)} (${oil.changePercent >= 0 ? '+' : ''}${oil.changePercent.toFixed(2)}%).\n`;
    }

    // Yield trigger
    if (yields.changePercent > 1.0) {
      diagnosis += `* Rising US 10Y Yield (+${yields.changePercent.toFixed(2)}% to ${yields.price.toFixed(3)}%): Higher US risk-free yields compress Emerging Market equity premiums, triggering Foreign Institutional Investor (FII) capital flight from India back to US bonds.\n`;
    } else if (yields.changePercent < -1.0) {
      diagnosis += `* Easing US 10Y Yield (-${Math.abs(yields.changePercent).toFixed(2)}% to ${yields.price.toFixed(3)}%): Declining yields reduce pressure on emerging market valuations, encouraging foreign inflows.\n`;
    } else {
      diagnosis += `* US 10Y Yield is holding steady at ${yields.price.toFixed(3)}% (${yields.changePercent >= 0 ? '+' : ''}${yields.changePercent.toFixed(2)}%).\n`;
    }

    // Currency trigger
    if (usdinr.changePercent > 0.3) {
      diagnosis += `* Rupee Depreciation (+${usdinr.changePercent.toFixed(2)}% USD/INR to ${usdinr.price.toFixed(2)}): A weaker rupee erodes USD-denominated returns for foreign investors, encouraging preemptive equity sell-offs.\n`;
    } else if (usdinr.changePercent < -0.3) {
      diagnosis += `* Rupee Appreciation (-${Math.abs(usdinr.changePercent).toFixed(2)}% USD/INR to ${usdinr.price.toFixed(2)}): A strengthening rupee indicates foreign capital inflows and solid domestic macroeconomic confidence.\n`;
    } else {
      diagnosis += `* USD/INR currency exchange rate is at ${usdinr.price.toFixed(2)} (${usdinr.changePercent >= 0 ? '+' : ''}${usdinr.changePercent.toFixed(2)}%).\n`;
    }

    // Global market correlation
    if (sp500.changePercent < -0.8) {
      diagnosis += `* S&P 500 Correction (${sp500.changePercent.toFixed(2)}%): General risk-off sentiment in Wall Street is triggering global margin liquidations and index correlations.\n`;
    }

    console.log(diagnosis);
    console.log("==========================================");
    console.log(`INVESTMENT BANKER DIAGNOSIS: ${sentiment} SIGNAL`);
    console.log(`Macro Confidence Score: ${score}/100`);
    console.log("==========================================");

  } catch (err) {
    console.error("Failed to run live market scanner:", err.message);
  }
}

scanLiveMarket();
