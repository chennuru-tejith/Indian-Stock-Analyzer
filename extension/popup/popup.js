// ALADDIN AI — EXTENSION POPUP LOGIC

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadPennyBreakouts();

  document.getElementById('btn-refresh-penny').addEventListener('click', loadPennyBreakouts);
  document.getElementById('btn-refresh-value').addEventListener('click', loadValuePlays);
  document.getElementById('btn-search').addEventListener('click', handleSearch);

  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById(`tab-${target}`).classList.add('active');

      if (target === 'penny') loadPennyBreakouts();
      if (target === 'value') loadValuePlays();
    });
  });
}

function loadPennyBreakouts() {
  const list = document.getElementById('penny-list');
  list.innerHTML = '<div class="loading">Loading sector penny breakout rankings...</div>';

  chrome.runtime.sendMessage({ action: 'FETCH_PENNY_BREAKOUT' }, (res) => {
    if (!res || !res.success || !res.data || !res.data.report) {
      list.innerHTML = '<div class="empty-state">Unable to load breakout rankings. Ensure backend is running!</div>';
      return;
    }

    const report = res.data.report;
    const topPicks = report.top20Breakouts || [];

    if (topPicks.length === 0) {
      list.innerHTML = '<div class="empty-state">No breakout picks found.</div>';
      return;
    }

    list.innerHTML = topPicks.map((stock, i) => `
      <div class="card-item" style="background:#1e293b; padding:8px 10px; border-radius:6px; margin-bottom:6px;">
        <div class="card-info">
          <div class="card-sym">${stock.emoji} #${i + 1}. ${stock.symbol.replace('.NS', '')}</div>
          <div class="card-sub">${stock.sector} • ₹${stock.price} • RSI: ${stock.rsi}</div>
        </div>
        <div class="card-score">
          <div class="score-num" style="color: ${stock.explosionScore >= 50 ? '#34d399' : stock.explosionScore >= 35 ? '#fbbf24' : '#94a3b8'};">${stock.explosionScore}/100</div>
          <div class="score-tag" style="color: ${stock.explosionScore >= 50 ? '#34d399' : '#fbbf24'};">${stock.explosionGrade}</div>
        </div>
      </div>
    `).join('');
  });
}

function loadValuePlays() {
  const list = document.getElementById('value-list');
  list.innerHTML = '<div class="loading">Fetching fundamental value divergence candidates...</div>';

  fetch('http://localhost:5000/api/screener/daily')
    .then(r => r.json())
    .then(data => {
      if (!data || !data.topValuePicks) {
        list.innerHTML = '<div class="empty-state">No value plays cached.</div>';
        return;
      }

      list.innerHTML = data.topValuePicks.map((stock, i) => `
        <div class="card-item" style="background:#1e293b; padding:8px 10px; border-radius:6px; margin-bottom:6px;">
          <div class="card-info">
            <div class="card-sym">#${i + 1}. ${stock.symbol.replace('.NS', '')}</div>
            <div class="card-sub">₹${stock.currentPrice} • PE: ${stock.pe} • ROE: ${stock.roePercent}%</div>
          </div>
          <div class="card-score">
            <div class="score-num" style="color:#34d399;">${stock.divergenceScore}/100</div>
            <div class="score-tag" style="color:#34d399;">${stock.grade}</div>
          </div>
        </div>
      `).join('');
    })
    .catch(() => {
      list.innerHTML = '<div class="empty-state">Error connecting to server.</div>';
    });
}

function handleSearch() {
  const input = document.getElementById('search-input');
  const query = input.value.trim().toUpperCase();
  const resContainer = document.getElementById('search-results');

  if (!query) return;

  resContainer.innerHTML = `<div class="loading">Analyzing ${query} with AI...</div>`;

  chrome.runtime.sendMessage({ action: 'FETCH_STOCK_INTELLIGENCE', symbol: query }, (res) => {
    if (!res || !res.success || !res.data) {
      resContainer.innerHTML = `<div class="empty-state" style="color:#ef4444;">Failed to analyze ${query}. Check symbol spelling or backend status.</div>`;
      return;
    }

    const intel = res.data;
    const score = intel.unifiedScore || 50;
    const rec = intel.recommendation || 'NEUTRAL';
    const price = intel.price ? `₹${intel.price.toFixed(2)}` : 'N/A';

    resContainer.innerHTML = `
      <div style="background:#1e293b; padding:12px; border-radius:8px; border:1px solid #38bdf8;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="margin:0; color:#fff;">${query}</h3>
          <span style="padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px; background:${score >= 60 ? '#10b981' : '#f59e0b'}; color:#fff;">${rec}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:8px;">
          <div>AI Score: <b style="color:#38bdf8;">${score}/100</b></div>
          <div>Price: <b>${price}</b></div>
          <div>Support: <b style="color:#34d399;">₹${intel.support || 'N/A'}</b></div>
          <div>Resistance: <b style="color:#f87171;">₹${intel.resistance || 'N/A'}</b></div>
        </div>
        <div style="background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.3); padding:6px; text-align:center; border-radius:6px; font-weight:700; color:#38bdf8; font-size:11px;">
          ${intel.predictiveTrend ? `Predictive Direction: ${intel.predictiveTrend.trendDirection}` : 'Analysis Complete'}
        </div>
      </div>
    `;
  });
}
