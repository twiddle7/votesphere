// ============================================================
// VoteSphere — Explore Polls page
// ============================================================

let allPolls = [];

async function loadPolls() {
  const grid = document.getElementById('pollsGrid');
  grid.innerHTML = `
    <div class="poll-card skeleton-card"></div>
    <div class="poll-card skeleton-card"></div>
    <div class="poll-card skeleton-card"></div>`;
  try {
    const res = await API.listPolls();
    allPolls = res.polls || [];
    applyFilters();
  } catch (err) {
    UI.toast('Failed to load polls: ' + err.message, 'error');
    grid.innerHTML = `
      <div class="card" style="padding:24px;text-align:center;color:var(--text-muted);grid-column:1/-1;">
        Could not load polls.
      </div>`;
  }
}

function applyFilters() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let list = allPolls;
  if (status !== 'all') list = list.filter(p => p.status === status);
  if (q) list = list.filter(p => (p.question || '').toLowerCase().includes(q));

  const grid = document.getElementById('pollsGrid');
  if (!list.length) {
    grid.innerHTML = `
      <div class="card" style="padding:24px;text-align:center;color:var(--text-muted);grid-column:1/-1;">
        No polls match your filters.
      </div>`;
    return;
  }
  grid.innerHTML = list.map(pollCardHTML).join('');
  if (window.lucide) lucide.createIcons();
}

function pollCardHTML(p) {
  const total = p.total_votes ?? 0;
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
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  loadPolls();
});