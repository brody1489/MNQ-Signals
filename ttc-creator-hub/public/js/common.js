(function () {
  const API_BASE = '';

  window.TTCHubAPI = {
    async getCampaigns() {
      const r = await fetch(API_BASE + '/api/campaigns');
      if (!r.ok) throw new Error('Failed to load campaigns');
      return r.json();
    },
  };

  window.TTCformatMoney = function (n) {
    const x = Number(n);
    if (Number.isNaN(x)) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(x);
  };

  window.TTCcampaignStatusDisplay = function (c, now) {
    const exp = c.expiration ? new Date(c.expiration) : null;
    if (exp && exp < now && c.status !== 'completed') return { label: 'Ended', cls: 'badge-completed' };
    if (c.status === 'completed') return { label: 'Completed', cls: 'badge-completed' };
    if (c.paid_out >= c.budget && c.budget > 0) return { label: 'Budget reached', cls: 'badge-completed' };
    if (c.status === 'upcoming') return { label: 'Upcoming', cls: 'badge-upcoming' };
    return { label: 'Active', cls: 'badge-active' };
  };

  window.TTCprogressPct = function (c) {
    const b = Number(c.budget) || 0;
    const p = Number(c.paid_out) || 0;
    if (b <= 0) return 0;
    return Math.min(100, Math.round((p / b) * 1000) / 10);
  };
})();
