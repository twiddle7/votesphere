// ============================================================
// VoteSphere — REST API client
// ============================================================

const API = {
  async request(path, { method = 'GET', body = null } = {}) {
    const url = CONFIG.API_BASE_URL.replace(/\/$/, '') + path;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      throw new Error('Network error: ' + err.message);
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  createPoll(payload) {
    return this.request('/polls', { method: 'POST', body: payload });
  },

  listPolls({ status = 'all', q = '' } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    const qs = params.toString();
    return this.request('/polls' + (qs ? '?' + qs : ''));
  },

  getPoll(pollId) {
    return this.request('/polls/' + encodeURIComponent(pollId));
  },

  vote(pollId, optionId, voterId) {
    return this.request(`/polls/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      body: { option_id: optionId, voter_id: voterId },
    });
  },

  closePoll(pollId) {
    return this.request(`/polls/${encodeURIComponent(pollId)}/close`, {
      method: 'POST',
    });
  },

  stats() {
    return this.request('/stats');
  },
};