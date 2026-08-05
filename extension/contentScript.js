// ALADDIN AI — ZERODHA KITE INJECTED CONTENT SCRIPT

let currentSymbol = '';
let hudElement = null;

/**
 * Initializes the Aladdin AI floating HUD overlay on Zerodha Kite.
 */
function createHudElement() {
  if (document.getElementById('aladdin-kite-hud')) return;

  hudElement = document.createElement('div');
  hudElement.id = 'aladdin-kite-hud';
  hudElement.innerHTML = `
    <div class="aladdin-hud-header">
      <div class="aladdin-brand">🤖 <span>ALADDIN AI</span></div>
      <div class="aladdin-hud-controls">
        <button class="aladdin-btn-icon" id="aladdin-hud-toggle" title="Minimize / Expand">—</button>
      </div>
    </div>
    <div class="aladdin-hud-body" id="aladdin-hud-content">
      <div style="text-align:center; padding:15px; color:#94a3b8;">
        <span>Select any stock on Zerodha Kite chart to analyze...</span>
      </div>
    </div>
  `;

  document.body.appendChild(hudElement);

  // Add event listener to toggle minimize
  document.getElementById('aladdin-hud-toggle').addEventListener('click', () => {
    hudElement.classList.toggle('minimized');
  });
}

/**
 * Detects current active symbol on Zerodha Kite DOM.
 */
function detectZerodhaSymbol() {
  // Method 1: Check document title (Zerodha sets title to e.g. "RELIANCE / NSE - Kite")
  const title = document.title;
  if (title && title.includes('/')) {
    const sym = title.split('/')[0].trim().toUpperCase();
    if (sym && sym !== currentSymbol && !sym.includes('KITE') && !sym.includes('PORTFOLIO')) {
      return sym;
    }
  }

  // Method 2: Check active market depth or chart header element
  const chartHeader = document.querySelector('.tradingsymbol, .instrument-name, .symbol-title');
  if (chartHeader) {
    const sym = chartHeader.textContent.trim().toUpperCase().split(' ')[0];
    if (sym && sym !== currentSymbol) {
      return sym;
    }
  }

  return null;
}

/**
 * Updates the HUD overlay with real-time stock intelligence.
 */
function updateHudContent(data) {
  const container = document.getElementById('aladdin-hud-content');
  if (!container) return;

  if (!data || !data.success) {
    container.innerHTML = `
      <div style="color:#ef4444; font-size:11px; padding:10px; text-align:center;">
        ⚠️ Unable to fetch AI score for ${currentSymbol}. Ensure local backend server is running on port 5000.
      </div>
    `;
    return;
  }

  const intel = data.data;
  const score = intel.unifiedScore || 50;
  const rec = intel.recommendation || 'NEUTRAL';
  const recClass = rec === 'STRONG BUY' ? 'rec-strong-buy' : rec === 'BUY' ? 'rec-buy' : rec === 'SELL' ? 'rec-sell' : 'rec-hold';

  const price = intel.price ? `₹${intel.price.toFixed(2)}` : 'N/A';
  const supp = intel.support ? `₹${intel.support.toFixed(2)}` : 'N/A';
  const resis = intel.resistance ? `₹${intel.resistance.toFixed(2)}` : 'N/A';

  const strikeStep = currentSymbol.includes('BANK') ? 100 : 50;
  const atmStrike = intel.price ? Math.round(intel.price / strikeStep) * strikeStep : 'N/A';
  const optionCall = score >= 60 ? `BUY ${atmStrike} CE (CALL)` : score <= 40 ? `BUY ${atmStrike} PE (PUT)` : `WAIT / NO TRADE`;

  container.innerHTML = `
    <div class="aladdin-symbol-banner">
      <div class="aladdin-sym-name">${currentSymbol}</div>
      <div class="aladdin-badge-rec ${recClass}">${rec}</div>
    </div>

    <div class="aladdin-grid-stats">
      <div class="aladdin-stat-card">
        <div class="aladdin-stat-label">AI Confluence</div>
        <div class="aladdin-stat-val" style="color: ${score >= 60 ? '#34d399' : score <= 40 ? '#f87171' : '#fbbf24'};">${score} / 100</div>
      </div>
      <div class="aladdin-stat-card">
        <div class="aladdin-stat-label">Current Price</div>
        <div class="aladdin-stat-val">${price}</div>
      </div>
      <div class="aladdin-stat-card">
        <div class="aladdin-stat-label">Support</div>
        <div class="aladdin-stat-val" style="color:#34d399;">${supp}</div>
      </div>
      <div class="aladdin-stat-card">
        <div class="aladdin-stat-label">Resistance</div>
        <div class="aladdin-stat-val" style="color:#f87171;">${resis}</div>
      </div>
    </div>

    <div class="aladdin-action-box">
      <div class="aladdin-action-title">Option Strike Recommendation</div>
      <div class="aladdin-action-call">${optionCall}</div>
    </div>
  `;
}

/**
 * Fetches stock analysis from background worker.
 */
function analyzeActiveSymbol(symbol) {
  if (!symbol || symbol === currentSymbol) return;
  currentSymbol = symbol;

  const container = document.getElementById('aladdin-hud-content');
  if (container) {
    container.innerHTML = `
      <div style="text-align:center; padding:15px; color:#38bdf8;">
        ⚡ Analyzing <b>${symbol}</b> with AI...
      </div>
    `;
  }

  chrome.runtime.sendMessage({ action: 'FETCH_STOCK_INTELLIGENCE', symbol }, (response) => {
    updateHudContent(response);
  });
}

/**
 * Injects "Scan Watchlist with AI" button into Zerodha Watchlist.
 */
function injectWatchlistScannerButton() {
  if (document.getElementById('aladdin-scan-wl-btn')) return;

  const wlHeader = document.querySelector('.marketwatch-selector, .items, .header-left');
  if (wlHeader) {
    const btn = document.createElement('button');
    btn.id = 'aladdin-scan-wl-btn';
    btn.className = 'aladdin-watchlist-btn';
    btn.innerHTML = '⚡ Scan Watchlist AI';
    btn.addEventListener('click', scanActiveWatchlist);
    wlHeader.appendChild(btn);
  }
}

/**
 * Scans all visible stocks in Zerodha's active watchlist.
 */
function scanActiveWatchlist() {
  const symElements = document.querySelectorAll('.nice-name, .symbol, .tradingsymbol');
  const symbols = Array.from(symElements)
    .map(el => el.textContent.trim().toUpperCase().split(' ')[0])
    .filter(sym => sym && sym.length > 1);

  const uniqueSyms = [...new Set(symbols)].slice(0, 30);

  if (uniqueSyms.length === 0) {
    alert('No active symbols found in Zerodha Watchlist!');
    return;
  }

  const btn = document.getElementById('aladdin-scan-wl-btn');
  if (btn) btn.textContent = `⚡ Scanning ${uniqueSyms.length} stocks...`;

  chrome.runtime.sendMessage({ action: 'BATCH_SCORE_WATCHLIST', symbols: uniqueSyms }, (res) => {
    if (btn) btn.textContent = '⚡ Scan Watchlist AI';
    if (!res || !res.success) {
      alert('Failed to scan watchlist. Make sure backend server is running!');
      return;
    }

    // Display formatted results modal
    showWatchlistResultsModal(res.data.results);
  });
}

/**
 * Shows interactive modal with watchlist AI scores inside Zerodha.
 */
function showWatchlistResultsModal(results) {
  let oldModal = document.getElementById('aladdin-wl-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'aladdin-wl-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    z-index: 999999; display: flex; align-items: center; justify-content: center;
  `;

  let rowsHtml = results.map((r, i) => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left;">
      <td style="padding: 8px;">#${i + 1}</td>
      <td style="padding: 8px; font-weight: 700; color: #fff;">${r.symbol}</td>
      <td style="padding: 8px;">₹${r.price.toFixed(2)}</td>
      <td style="padding: 8px; font-weight: 800; color: ${r.score >= 60 ? '#34d399' : r.score <= 40 ? '#f87171' : '#fbbf24'};">${r.score}/100</td>
      <td style="padding: 8px; font-weight: 700; color: ${r.recommendation.includes('BUY') ? '#34d399' : r.recommendation.includes('SELL') ? '#f87171' : '#fbbf24'};">${r.recommendation}</td>
      <td style="padding: 8px; color: ${r.predictedGainPct >= 0 ? '#34d399' : '#f87171'};">${r.predictedGainPct >= 0 ? '+' : ''}${r.predictedGainPct.toFixed(1)}%</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div style="background: #0f172a; border: 1px solid #38bdf8; border-radius: 12px; width: 650px; max-height: 80vh; overflow-y: auto; padding: 20px; color: #fff; font-family: sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #38bdf8;">🤖 Aladdin AI — Zerodha Watchlist Rankings</h3>
        <button id="aladdin-close-modal" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #1e293b; color: #94a3b8; text-align: left;">
            <th style="padding: 8px;">#</th>
            <th style="padding: 8px;">Stock</th>
            <th style="padding: 8px;">Price</th>
            <th style="padding: 8px;">AI Score</th>
            <th style="padding: 8px;">Recommendation</th>
            <th style="padding: 8px;">Proj Return</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('aladdin-close-modal').addEventListener('click', () => {
    modal.remove();
  });
}

// Main execution loop
createHudElement();

setInterval(() => {
  const detected = detectZerodhaSymbol();
  if (detected && detected !== currentSymbol) {
    analyzeActiveSymbol(detected);
  }
  injectWatchlistScannerButton();
}, 2000);
