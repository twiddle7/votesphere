// ============================================================
// VoteSphere — Create Poll page
// ============================================================

const optionsWrap = document.getElementById('optionsWrap');

function addOptionField(value = '') {
  const count = optionsWrap.querySelectorAll('input').length;
  if (count >= 10) {
    UI.toast('Maximum 10 options allowed.', 'error');
    return;
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';
  row.innerHTML = `
    <input type="text" maxlength="100" placeholder="Option ${count + 1}"
      value="${UI.escape(value)}"
      style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-family:inherit;" />
    <button type="button" class="btn btn-ghost btn-sm remove-option">
      <i data-lucide="trash-2"></i>
    </button>`;
  optionsWrap.appendChild(row);
  row.querySelector('.remove-option').onclick = () => {
    if (optionsWrap.querySelectorAll('input').length <= 2) {
      UI.toast('At least 2 options required.', 'error');
      return;
    }
    row.remove();
  };
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  addOptionField();
  addOptionField();
  document.getElementById('addOption').addEventListener('click', () => addOptionField());

  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = document.getElementById('question').value.trim();
    const optionValues = [...optionsWrap.querySelectorAll('input')]
      .map(i => i.value.trim())
      .filter(Boolean);
    const closingTime = document.getElementById('closingTime').value;

    document.getElementById('qErr').textContent = '';
    if (!question) {
      document.getElementById('qErr').textContent = 'Question is required.';
      return;
    }
    if (optionValues.length < 2) {
      UI.toast('Please provide at least 2 options.', 'error');
      return;
    }
    if (new Set(optionValues.map(v => v.toLowerCase())).size !== optionValues.length) {
      UI.toast('Options must be unique.', 'error');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Creating…';
    if (window.lucide) lucide.createIcons();

    try {
      const payload = { question, options: optionValues };
      if (closingTime) payload.closing_time = new Date(closingTime).toISOString();
      const res = await API.createPoll(payload);
      UI.toast('Poll created successfully!', 'success');
      setTimeout(() => {
        window.location.href = 'results.html?id=' + encodeURIComponent(res.poll_id);
      }, 700);
    } catch (err) {
      UI.toast('Create failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check-circle"></i> Create Poll';
      if (window.lucide) lucide.createIcons();
    }
  });
});