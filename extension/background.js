// ALADDIN AI — BACKGROUND SERVICE WORKER (MV3)

const BACKEND_URL = 'http://localhost:5000';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_STOCK_INTELLIGENCE') {
    fetch(`${BACKEND_URL}/api/stock/${request.symbol}/intelligence`)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'FETCH_PENNY_BREAKOUT') {
    fetch(`${BACKEND_URL}/api/screener/penny-breakout`)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'BATCH_SCORE_WATCHLIST') {
    fetch(`${BACKEND_URL}/api/stock/batch-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: request.symbols })
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
