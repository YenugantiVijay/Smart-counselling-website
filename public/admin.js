/**
 * Smart Counselling Website — Owner Dashboard Application Logic
 * Server-authenticated lead management with CSRF headers and real-time updates.
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, root = document) => root.querySelector(s);
  const loginPanel = $('#login-panel');
  const dashboard = $('#dashboard');
  const logoutButton = $('#logout-button');
  const loginForm = $('#login-form');
  const loginError = $('#login-error');
  const actionFeedback = $('#action-feedback');
  const leadList = $('#lead-list');
  const filterStatus = $('#filter-status');
  const searchInput = $('#search-leads');
  const clearSampleBtn = $('#clear-sample-btn');

  let allLeads = [];

  const API_BASE = (window.location.port && window.location.port !== '3000' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'))
    ? 'http://localhost:3000'
    : '';

  // Helper for authenticated API calls with CSRF header
  async function api(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const sessionToken = sessionStorage.getItem('sc_demo_session_token');
    if (sessionToken) {
      defaultHeaders['X-Session-Token'] = sessionToken;
      defaultHeaders['Authorization'] = `Bearer ${sessionToken}`;
    }

    const response = await fetch(`${API_BASE}${url}`, {
      credentials: API_BASE ? 'include' : 'same-origin',
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Server request failed.');
    }
    return data;
  }

  function showFeedback(msg, isError = false) {
    if (!actionFeedback) return;
    actionFeedback.textContent = msg;
    actionFeedback.className = isError ? 'action-feedback error' : 'action-feedback success';
    setTimeout(() => {
      if (actionFeedback.textContent === msg) actionFeedback.textContent = '';
    }, 4000);
  }

  function updateMetrics(leads) {
    const total = leads.length;
    const newCount = leads.filter(l => l.status === 'New').length;
    const contactedCount = leads.filter(l => l.status === 'Contacted').length;
    const aptCount = leads.filter(l => l.status === 'Appointment booked').length;
    const closedCount = leads.filter(l => l.status === 'Closed').length;

    $('#stat-total').textContent = String(total);
    $('#stat-new').textContent = String(newCount);
    $('#stat-contacted').textContent = String(contactedCount);
    $('#stat-appointment').textContent = String(aptCount);
    $('#stat-closed').textContent = String(closedCount);
  }

  function renderLeads() {
    const selectedFilter = filterStatus ? filterStatus.value : 'ALL';
    const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let filtered = allLeads.slice();

    if (selectedFilter !== 'ALL') {
      filtered = filtered.filter(l => l.status === selectedFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(l =>
        (l.name && l.name.toLowerCase().includes(searchQuery)) ||
        (l.phone && l.phone.toLowerCase().includes(searchQuery)) ||
        (l.destination && l.destination.toLowerCase().includes(searchQuery)) ||
        (l.studyLevel && l.studyLevel.toLowerCase().includes(searchQuery)) ||
        (l.message && l.message.toLowerCase().includes(searchQuery))
      );
    }

    leadList.replaceChildren();

    if (filtered.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-state';
      emptyBox.innerHTML = `
        <div class="empty-icon" aria-hidden="true">📭</div>
        <h3>No Enquiries Found</h3>
        <p>${allLeads.length === 0
          ? 'No enquiries recorded yet. Submit a test enquiry from the public homepage to test the workflow.'
          : 'No enquiries match the selected filter or search keyword.'}</p>
      `;
      leadList.appendChild(emptyBox);
      return;
    }

    filtered.forEach(lead => {
      const card = document.createElement('article');
      card.className = `lead-card status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`;

      // Header row
      const cardHeader = document.createElement('div');
      cardHeader.className = 'lead-header';

      const infoBlock = document.createElement('div');
      infoBlock.className = 'lead-identity';

      const titleLine = document.createElement('div');
      titleLine.className = 'title-line';

      const nameEl = document.createElement('h3');
      nameEl.textContent = lead.name;

      const refEl = document.createElement('span');
      refEl.className = 'ref-badge';
      refEl.textContent = `#${lead.id}`;

      titleLine.append(nameEl, refEl);

      if (lead.isSample === 1) {
        const sampleBadge = document.createElement('span');
        sampleBadge.className = 'badge-sample';
        sampleBadge.textContent = 'SAMPLE DATA';
        titleLine.appendChild(sampleBadge);
      }

      const metaLine = document.createElement('div');
      metaLine.className = 'lead-meta';
      metaLine.textContent = `Submitted: ${lead.createdAt || 'N/A'} UTC · Consent verified`;

      infoBlock.append(titleLine, metaLine);

      // Status selector
      const statusWrap = document.createElement('div');
      statusWrap.className = 'status-selector-wrap';

      const statusLabel = document.createElement('label');
      statusLabel.setAttribute('for', `status-select-${lead.id}`);
      statusLabel.className = 'sr-only';
      statusLabel.textContent = `Status for enquiry #${lead.id}`;

      const select = document.createElement('select');
      select.id = `status-select-${lead.id}`;
      select.className = 'status-select';

      ['New', 'Contacted', 'Appointment booked', 'Closed'].forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = optVal;
        if (lead.status === optVal) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', async () => {
        select.disabled = true;
        const newStatus = select.value;
        try {
          await api(`/api/admin/enquiries/${lead.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
          });
          lead.status = newStatus;
          updateMetrics(allLeads);
          renderLeads();
          showFeedback(`Enquiry #${lead.id} updated to "${newStatus}".`);
        } catch (err) {
          showFeedback(err.message || 'Status update failed.', true);
          select.value = lead.status;
        } finally {
          select.disabled = false;
        }
      });

      statusWrap.append(statusLabel, select);
      cardHeader.append(infoBlock, statusWrap);

      // Tags Row
      const tagsRow = document.createElement('div');
      tagsRow.className = 'tags-row';

      const destTag = document.createElement('span');
      destTag.className = 'tag-chip';
      destTag.textContent = `📍 ${lead.destination}`;

      const levelTag = document.createElement('span');
      levelTag.className = 'tag-chip';
      levelTag.textContent = `🎓 ${lead.studyLevel}`;

      tagsRow.append(destTag, levelTag);

      // Details Grid
      const detailsGrid = document.createElement('div');
      detailsGrid.className = 'details-grid';

      const phoneItem = document.createElement('div');
      phoneItem.className = 'detail-item';
      phoneItem.innerHTML = `<strong>Phone:</strong> <a href="tel:${encodeURIComponent(lead.phone)}">${lead.phone}</a>`;

      const emailItem = document.createElement('div');
      emailItem.className = 'detail-item';
      if (lead.email) {
        emailItem.innerHTML = `<strong>Email:</strong> <a href="mailto:${encodeURIComponent(lead.email)}">${lead.email}</a>`;
      } else {
        emailItem.innerHTML = `<strong>Email:</strong> <span class="text-muted">Not provided</span>`;
      }

      detailsGrid.append(phoneItem, emailItem);

      // Message Block
      const messageBlock = document.createElement('div');
      messageBlock.className = 'message-box';
      const msgHeading = document.createElement('strong');
      msgHeading.textContent = 'Student Note / Question:';
      const msgContent = document.createElement('p');
      msgContent.textContent = lead.message || 'No additional message was provided.';
      messageBlock.append(msgHeading, msgContent);

      card.append(cardHeader, tagsRow, detailsGrid, messageBlock);
      leadList.appendChild(card);
    });
  }

  async function loadDashboard() {
    try {
      const data = await api('/api/admin/enquiries');
      allLeads = data.enquiries || [];

      loginPanel.hidden = true;
      dashboard.hidden = false;
      logoutButton.hidden = false;

      updateMetrics(allLeads);
      renderLeads();
    } catch (err) {
      sessionStorage.removeItem('sc_demo_session_token');
      loginPanel.hidden = false;
      dashboard.hidden = true;
      logoutButton.hidden = true;
      if (loginError && err && err.message) {
        loginError.textContent = err.message;
      }
    }
  }

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      const username = $('#username').value.trim();
      const password = $('#password').value;

      const submitBtn = $('#login-button');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying…';

      try {
        const res = await api('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        if (res.token) {
          sessionStorage.setItem('sc_demo_session_token', res.token);
        }
        $('#password').value = '';
        await loadDashboard();
      } catch (err) {
        loginError.textContent = err.message || 'Authentication failed. Please verify credentials.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In Securely →';
      }
    });
  }

  // Handle Auto-Fill Demo Credentials
  const fillDemoCredsBtn = $('#fill-demo-creds-btn');
  if (fillDemoCredsBtn) {
    fillDemoCredsBtn.addEventListener('click', () => {
      const usernameInput = $('#username');
      const passwordInput = $('#password');
      if (usernameInput) usernameInput.value = 'owner';
      if (passwordInput) passwordInput.value = 'DemoAdmin2026!';
      const submitBtn = $('#login-button');
      if (submitBtn) submitBtn.focus();
    });
  }

  // Handle Logout
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await api('/api/admin/logout', { method: 'POST', body: '{}' });
      } catch {
        // Continue logout locally even if network failed
      }
      sessionStorage.removeItem('sc_demo_session_token');
      dashboard.hidden = true;
      logoutButton.hidden = true;
      loginPanel.hidden = false;
      loginForm.reset();
      allLeads = [];
    });
  }

  // Filter & Search Event Listeners
  if (filterStatus) {
    filterStatus.addEventListener('change', renderLeads);
  }
  if (searchInput) {
    searchInput.addEventListener('input', renderLeads);
  }

  // Clear Sample Leads Button
  if (clearSampleBtn) {
    clearSampleBtn.addEventListener('click', async () => {
      if (!confirm('Remove sample demonstration records? Real visitor submissions will remain.')) {
        return;
      }
      try {
        const res = await api('/api/admin/sample-enquiries', { method: 'DELETE' });
        showFeedback(`Removed ${res.removedCount} sample demonstration records.`);
        await loadDashboard();
      } catch (err) {
        showFeedback(err.message || 'Failed to remove sample enquiries.', true);
      }
    });
  }

  // Initial Session Verification
  (async () => {
    try {
      const state = await api('/api/admin/session');
      if (state.authenticated) {
        await loadDashboard();
      }
    } catch {
      // Stay on login panel
    }
  })();
});
