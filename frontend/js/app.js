// ============================================================
// VoteSphere — Shared UI helpers
// ============================================================

const UI = {
  // Render sidebar
  initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const current = document.body.dataset.page || '';
    const links = [
      { href: 'index.html',       icon: 'home',       label: 'Overview',    key: 'home' },
      { href: 'polls.html',       icon: 'bar-chart-3',label: 'Explore Polls', key: 'polls' },
      { href: 'create-poll.html', icon: 'plus-circle',label: 'Create Poll', key: 'create' },
      { href: 'results.html',     icon: 'activity',   label: 'Live Results', key: 'results' },
      { href: 'about.html',       icon: 'cloud',      label: 'Architecture', key: 'about' },
    ];
    sidebar.innerHTML = `
      <div class="brand">
        <div class="brand-mark">V</div>
        <span>VoteSphere</span>
      </div>
      <nav class="nav">
        ${links.map(l => `
          <a href="${l.href}" class="${l.key === current ? 'active' : ''}">
            <i data-lucide="${l.icon}"></i> ${l.label}
          </a>`).join('')}
      </nav>
    `;
    if (window.lucide) lucide.createIcons();
  },

  initTopbar() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    const titles = {
      home: 'Dashboard',
      polls: 'Explore Polls',
      create: 'Create Poll',
      results: 'Live Results',
      about: 'Cloud Architecture',
    };
    const page = document.body.dataset.page || 'home';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-ghost btn-sm" id="menuBtn" style="display:none;">
          <i data-lucide="menu"></i>
        </button>
        <strong style="font-size:16px;">${titles[page] || 'VoteSphere'}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="pill pill-success"><i data-lucide="circle"></i> Live</span>
      </div>
    `;
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebarScrim');
    if (menuBtn && sidebar && scrim) {
      const show = () => window.innerWidth <= 900;
      const update = () => { menuBtn.style.display = show() ? 'inline-flex' : 'none'; };
      update();
      window.addEventListener('resize', update);
      menuBtn.onclick = () => {
        sidebar.classList.toggle('open');
        scrim.classList.toggle('open');
      };
      scrim.onclick = () => {
        sidebar.classList.remove('open');
        scrim.classList.remove('open');
      };
    }
    if (window.lucide) lucide.createIcons();
  },

  toast(message, type = 'info') {
    const host = document.getElementById('toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  escape(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },

  formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch (_) { return iso; }
  },

  // Simple per-browser voter ID (anonymous identity)
  getVoterId() {
    let id = localStorage.getItem('vs_voter_id');
    if (!id) {
      id = 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('vs_voter_id', id);
    }
    return id;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initSidebar();
  UI.initTopbar();
  if (window.lucide) lucide.createIcons();
});