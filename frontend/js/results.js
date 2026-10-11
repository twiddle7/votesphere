// ============================================================
// VoteSphere — Live Results page (with WebSocket + Chart.js)
// ============================================================

let chart = null;
let socket = null;
let currentPoll = null;
let voterId = UI.getVoterId();

function getPollIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadPoll(pollId) {
  try {
    currentPoll = await API.getPoll(pollId);
    renderPoll();
    connectSocket(pollId);
  } catch (err) {
    UI.toast('Could not load poll: ' + err.message, 'error');
    document.getElementById('pollQuestion').textContent = 'Poll not found';
  }
}

function renderPoll() {
  document.getElementById('pollQuestion').textContent = currentPoll.question;

  const voteHost = document.getElementById('voteOptions');
  voteHost.innerHTML = (currentPoll.options || []).map(o => `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;">
      <input type="radio" name="option" value="${o.option_id}" />
      <span>${UI.escape(o.text)}</span>
    </label>`).join('');

  const closed = currentPoll.status !== 'active';
  if (closed) {
    document.getElementById('voteSection').innerHTML = `
      <h3 style="margin-top:0;font-size:16px;">Poll closed</h3>
      <p style="color:var(--text-muted);">This poll is no longer accepting votes.</p>`;
  } else {
    document.getElementById('voteBtn').onclick = submitVote;
  }

  renderResults(currentPoll.options || [], currentPoll.total_votes || 0);
}

function renderResults(options, total) {
  const list = document.getElementById('resultsList');
  list.innerHTML = options.map(o => {
    const votes = o.votes ?? 0;
    const pct = total ? Math.round((votes / total) * 100) : 0;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
          <span>${UI.escape(o.text)}</span>
          <span style="color:var(--text-muted);">${votes} · ${pct}%</span>
        </div>
        <div style="background:#e2e8f0;height:10px;border-radius:6px;overflow:hidden;">
          <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);height:100%;width:${pct}%;transition:width .4s;"></div>
        </div>
      </div>`;
  }).join('');

  const canvas = document.getElementById('resultsChart');
  if (!canvas) return;
  const labels = options.map(o => o.text);
  const data = options.map(o => o.votes ?? 0);

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  } else {
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#4f46e5','#7c3aed','#2563eb','#8b5cf6','#06b6d4','#14b8a6','#f59e0b','#ec4899','#84cc16','#ef4444'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        cutout: '60%',
      },
    });
  }
}

async function submitVote() {
  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) {
    UI.toast('Please select an option.', 'error');
    return;
  }
  const btn = document.getElementById('voteBtn');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Submitting…';
  if (window.lucide) lucide.createIcons();

  try {
    await API.vote(currentPoll.poll_id, selected.value, voterId);
    UI.toast('Vote submitted!', 'success');
    // Reload from server for canonical results
    const updated = await API.getPoll(currentPoll.poll_id);
    currentPoll = updated;
    renderResults(updated.options || [], updated.total_votes || 0);
  } catch (err) {
    UI.toast('Vote failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="vote"></i> Submit Vote';
    if (window.lucide) lucide.createIcons();
  }
}

function connectSocket(pollId) {
  const badge = document.getElementById('connBadge');
  socket = new LiveSocket(
    (msg) => {
      if (msg.type === 'results' && msg.poll_id === pollId) {
        currentPoll.options = msg.options;
        currentPoll.total_votes = msg.total_votes;
        renderResults(msg.options, msg.total_votes);
      }
    },
    (status) => {
      if (!badge) return;
      if (status === 'connected') {
        badge.className = 'pill pill-success';
        badge.innerHTML = '<i data-lucide="wifi"></i> Live';
      } else if (status === 'connecting') {
        badge.className = 'pill pill-warning';
        badge.innerHTML = '<i data-lucide="loader-2"></i> Connecting…';
      } else {
        badge.className = 'pill pill-warning';
        badge.innerHTML = '<i data-lucide="wifi-off"></i> Reconnecting…';
      }
      if (window.lucide) lucide.createIcons();
    }
  );
  socket.connect(pollId);
}

document.addEventListener('DOMContentLoaded', () => {
  const id = getPollIdFromUrl();
  if (!id) {
    UI.toast('Missing poll ID in URL.', 'error');
    document.getElementById('pollQuestion').textContent = 'No poll selected';
    return;
  }
  loadPoll(id);
});