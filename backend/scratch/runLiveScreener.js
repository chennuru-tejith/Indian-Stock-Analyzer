import { runFundamentalScreener } from '../services/screenerService.js';

async function run() {
  console.log("Running Live Stock Screener...");
  try {
    const report = await runFundamentalScreener();
    console.log("SUCCESS");
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error("Error running screener:", err);
  }
}

run();
