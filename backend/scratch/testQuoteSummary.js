import { yahooFinance } from '../services/dataService.js';

async function test() {
  try {
    const symbol = 'RELIANCE.NS';
    console.log(`Querying quote summary for ${symbol}...`);
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['financialData', 'summaryDetail', 'defaultKeyStatistics']
    });
    console.log("Summary Result Keys:", Object.keys(summary));
    console.log("financialData:", JSON.stringify(summary.financialData, null, 2));
    console.log("summaryDetail:", JSON.stringify(summary.summaryDetail, null, 2));
    console.log("defaultKeyStatistics:", JSON.stringify(summary.defaultKeyStatistics, null, 2));
  } catch (err) {
    console.error("Error fetching summary:", err);
  }
}

test();
