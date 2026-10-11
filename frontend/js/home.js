// ============================================================
// VoteSphere — Home page logic
// ============================================================

async function loadHome() {
  try {
    const [stats, polls] = await Promise.all([
      API.stats().catch(() => ({ total_polls: 0, total_votes: 0, active_polls: 0, total_options: 0 })),
      API.listPolls().catch(() => ({ polls: [] })),
    ]);

    renderStats(stats);
    const all = polls.polls || [];
    renderPollGrid('activePolls', all.filter(p => p.status === 'active').slice(0, 3));
    renderPollGrid('recentPolls', all.slice(0, 3));
  } catch (err) {
    UI.toast('Failed to load data: ' + err.message, 'error');
    renderStats({});
    renderPollGrid('activePolls', []);
    renderPollGrid('recentPolls', []);
  }
}

function renderStats(s) {
  const host = document.getElementById('statGrid');
  if (!host) return;
  const items = [
    { label: 'Total Polls',  value: s.total_polls ?? 0,  icon: 'bar-chart-3' },
    { label: 'Total Votes',  value: s.total_votes ?? 0,  icon: 'vote' },
    { label: 'Active Polls', value: s.active_polls ?? 0, icon: 'activity' },
    { label: 'Total Options',value: s.total_options ?? 0,icon: 'list' },
  ];
  host.innerHTML = items.map(i => `
    <div class="stat-card">
      <div class="stat-label">${i.label}</div>
      <div class="stat-value">${i.value}</div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function renderPollGrid(elementId, polls) {
  const host = document.getElementById(elementId);
  if (!host) return;
  if (!polls.length) {
    host.innerHTML = `
      <div class="card" style="padding:24px;text-align:center;color:var(--text-muted);grid-column:1/-1;">
        <i data-lucide="inbox" style="width:32px;height:32px;"></i>
        <p style="margin-top:8px;">No polls yet. <a href="create-poll.html">Create the first one!</a></p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  host.innerHTML = polls.map(p => pollCardHTML(p)).join('');
  if (window.lucide) lucide.createIcons();
}

function pollCardHTML(p) {
  const total = (p.total_votes ?? 0);
  const badge = p.status === 'active'
    ? `<span class="pill pill-success">Active</span>`
    : `<span class="pill pill-warning">Closed</span>`;
  return `
    <a class="poll-card" href="results.html?id=${encodeURIComponent(p.poll_id)}" style="color:inherit;">
      ${badge}
      <h3>${UI.escape(p.question)}</h3>
      <div class="poll-meta">${(p.options || []).length} options · ${UI.formatDate(p.created_at)}</div>
      <div class="poll-votes">${total} vote${total === 1 ? '' : 's'}</div>
    </a>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const refresh = document.getElementById('refreshStats');
  if (refresh) refresh.addEventListener('click', loadHome);
  loadHome();
});