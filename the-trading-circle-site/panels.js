(function() {
  var overlay = document.getElementById('panel-overlay');
  var inner = document.getElementById('panel-inner');
  var closeBtn = document.getElementById('panel-close');
  if (!overlay || !inner || !closeBtn) return;

  var realtimeFallback = '<h2>Real-Time Trades</h2>'
    + '<p style="color: var(--gray); text-align: center; margin-bottom: 0.75rem; font-size: 0.9rem;">Last month&apos;s top ideas by category (for education only).</p>'
    + '<p style="color: var(--gray); text-align: center; max-width: 640px; margin: 0 auto 1.5rem; font-size: 0.9rem;">Every day analysts share trade ideas across options, stocks, futures and crypto. Below are highlights from each group based on last month.</p>'
    + '<div class="rt-grid"><div class="rt-card"><div class="rt-label">Options</div><div class="rt-ticker">SPY</div><div class="rt-gain">+12%</div></div><div class="rt-card"><div class="rt-label">Stocks</div><div class="rt-ticker">NVDA</div><div class="rt-gain">+8%</div></div><div class="rt-card"><div class="rt-label">Futures</div><div class="rt-ticker">ES</div><div class="rt-gain">+24 pts</div></div><div class="rt-card"><div class="rt-label">Crypto</div><div class="rt-ticker">BTC</div><div class="rt-gain">+5%</div></div></div>';
  function buildRealtimePanel() {
    var c = window.TTC_CONFIG || {};
    var highlights = c.realtimeHighlights;
    if (highlights && Array.isArray(highlights) && highlights.length >= 4) {
      var cards = highlights.map(function(h) {
        return '<div class="rt-card"><div class="rt-label">' + (h.category || '') + '</div><div class="rt-ticker">' + (h.ticker || '—') + '</div><div class="rt-gain">' + (h.result || '—') + '</div></div>';
      }).join('');
      return '<h2>Real-Time Trades</h2>'
        + '<p style="color: var(--gray); text-align: center; margin-bottom: 0.75rem; font-size: 0.9rem;">Last month&apos;s top ideas by category (for education only).</p>'
        + '<p style="color: var(--gray); text-align: center; max-width: 640px; margin: 0 auto 1.5rem; font-size: 0.9rem;">Every day analysts share trade ideas across options, stocks, futures and crypto. Below are highlights from each group based on last month.</p>'
        + '<div class="rt-grid">' + cards + '</div>';
    }
    return realtimeFallback;
  }
  var panels = {
    realtime: null,
    educating: '<h2>Educating Community</h2>'
      + '<div class="edu-band"><h3>Resources and language</h3><p>We use plain language and real charts. The same terms and ideas show up again and again so they actually stick.</p><ul><li>Short explanations you can revisit later</li><li>Examples built around real market moves</li></ul></div>'
      + '<div class="edu-band"><h3>How traders and members share ideas</h3><p>Traders and members post chart ideas, what they tried, and what they learned from it. These are conversations about what people are seeing – not signals telling you what to do.</p></div>'
      + '<div class="edu-band"><h3>What you can expect</h3><ul><li>Live commentary while markets are moving</li><li>Members explaining the &ldquo;why&rdquo; behind their ideas</li><li>Resources you can scroll back to any time</li></ul></div>',
    traders: '<h2>Active Traders</h2><p class="at-intro">Analysts by focus area</p><div class="at-grid"><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Dorado</div><div class="at-role">Options analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">PvP</div><div class="at-role">Options analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Hengy</div><div class="at-role">Stock analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Luxe</div><div class="at-role">Stock analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Fomo</div><div class="at-role">Stock analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Mitro</div><div class="at-role">Futures analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Viper</div><div class="at-role">Futures analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Stormzyy</div><div class="at-role">Futures analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Toph</div><div class="at-role">Futures analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Cashout</div><div class="at-role">Crypto analyst</div></div></div><div class="at-card"><div class="at-pfp"></div><div class="at-info"><div class="at-name">Timm</div><div class="at-role">Crypto analyst</div></div></div></div>',
    track: null
  };

  var trTrades = [
    ['SPY','Options · Nov 2025','+12%'],['ES','Futures · Nov 2025','+24 pts'],['NVDA','Stocks · Oct 2025','+8%'],['BTC','Crypto · Oct 2025','+5%'],['AAPL','Options · Oct 2025','+6%'],['TSLA','Stocks · Nov 2025','+9%'],['NQ','Futures · Nov 2025','+18 pts'],['ETH','Crypto · Nov 2025','+7%']
  ];
  function buildTrackPanel(featuredList) {
    var c = window.TTC_CONFIG || {};
    var wr = c.winRatePercent != null ? c.winRatePercent : 90;
    var wrStr = typeof wr === 'number' && wr % 1 !== 0 ? wr.toFixed(2) : wr;
    var gain = c.allTimeGainPercent != null ? c.allTimeGainPercent : 10000;
    var gainStr = typeof gain === 'number' && gain % 1 !== 0 ? gain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (gain).toLocaleString();
    var list = featuredList && featuredList.length ? featuredList : trTrades.map(function(t){ return { ticker: t[0], meta: t[1], result: t[2] }; });
    var carouselHtml = list.map(function(t){ var ticker = t.ticker || t[0]; var meta = t.meta || t[1]; var result = t.result || t[2]; return '<div class="tr-trade"><div class="tr-ticker">'+ticker+'</div><div class="tr-meta">'+meta+'</div><div class="tr-result">'+result+'</div></div>'; }).join('') + list.map(function(t){ var ticker = t.ticker || t[0]; var meta = t.meta || t[1]; var result = t.result || t[2]; return '<div class="tr-trade"><div class="tr-ticker">'+ticker+'</div><div class="tr-meta">'+meta+'</div><div class="tr-result">'+result+'</div></div>'; }).join('');
    return '<h2>Track Record</h2>'
      + '<p style="color: var(--gray); text-align: center; max-width: 560px; margin: 0 auto 1.25rem; font-size: 0.95rem;">We track every idea our analysts share. The numbers below are all-time and updated daily from real outcomes.</p>'
      + '<div class="tr-stats"><div class="tr-stat"><div class="tr-value">' + wrStr + '%</div><div class="tr-label">All-time win rate</div></div><div class="tr-stat"><div class="tr-value">' + gainStr + '%</div><div class="tr-label">All-time server gains</div></div></div>'
      + '<p style="color: var(--gray); font-size: 0.85rem; text-align: center; margin-bottom: 0.5rem;">Based on tracked idea outcomes. For education only.</p>'
      + '<p style="color: var(--gold); font-size: 0.9rem; margin-bottom: 1rem;">Featured trades</p>'
      + '<div class="tr-carousel-wrap"><div class="tr-carousel">' + carouselHtml + '</div></div>';
  }

  function buildTradersPanel(list) {
    if (!list || !list.length) return panels.traders;
    var cards = list.map(function(t) {
      var avatar = t.avatar ? '<img src="'+t.avatar+'" alt="" class="at-pfp" />' : '<div class="at-pfp"></div>';
      return '<div class="at-card">'+avatar+'<div class="at-info"><div class="at-name">'+(t.name||'')+'</div><div class="at-role">'+(t.role||'')+'</div></div></div>';
    }).join('');
    return '<h2>Active Traders</h2><p class="at-intro">Analysts by focus area</p><div class="at-grid">' + cards + '</div>';
  }

  function open(id) {
    if (id === 'realtime') {
      inner.innerHTML = buildRealtimePanel();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      return;
    }
    if (id === 'traders') {
      inner.innerHTML = '<h2>Active Traders</h2><p class="at-intro">Analysts by focus area</p><p style="color: var(--gray); text-align: center;">Loading…</p>';
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      fetch('/api/traders.json').then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
        var list = data && data.list ? data.list : null;
        inner.innerHTML = buildTradersPanel(list);
      }).catch(function(){ inner.innerHTML = buildTradersPanel(null); });
      return;
    }
    if (id === 'track') {
      inner.innerHTML = buildTrackPanel();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      fetch('/api/featured.json').then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
        if (Array.isArray(data) && data.length) {
          inner.innerHTML = buildTrackPanel(data);
        }
      }).catch(function(){});
      return;
    }
    if (!panels[id]) return;
    inner.innerHTML = panels[id];
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.card[data-panel]').forEach(function(card) {
    card.addEventListener('click', function() { open(card.getAttribute('data-panel')); });
    card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(card.getAttribute('data-panel')); } });
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });
})();
