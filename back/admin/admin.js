const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('jwt_token');
}

function setToken(token) {
  localStorage.setItem('jwt_token', token);
}

function clearToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('current_user');
}

function getCurrentUser() {
  const raw = localStorage.getItem('current_user');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('current_user', JSON.stringify(user));
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

const AuthAPI = {
  async login(email, password) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  },

  async logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },

  async getMe() {
    const data = await apiRequest('/api/auth/me');
    if (data.user) {
      setCurrentUser(data.user);
    }
    return data;
  }
};

const AdminAPI = {
  getUsers() {
    return apiRequest('/api/admin/users');
  },
  getUser(userId) {
    return apiRequest(`/api/admin/users/${userId}`);
  },
  createUser(payload) {
    return apiRequest('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateUser(userId, payload) {
    return apiRequest(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteUser(userId) {
    return apiRequest(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
  },
  getQuestionSets() {
    return apiRequest('/api/admin/questions');
  },
  createQuestionSet(categories, indicators) {
    return apiRequest('/api/admin/questions', {
      method: 'POST',
      body: JSON.stringify({ categories, indicators })
    });
  },
  getAssessments() {
    return apiRequest('/api/admin/assessments');
  }
};

let adminState = {
  users: [],
  questionSets: [],
  latestQuestionSet: null,
  assessments: [],
  loaded: {
    users: false,
    questionSets: false,
    assessments: false
  },
  activeTab: 'users'
};

let flashMessage = null;

const TAB_PANELS = {
  users: 'panel-users',
  'question-versions': 'panel-question-versions',
  'question-editor': 'panel-question-editor',
  assessments: 'panel-assessments'
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeQuestionSet(questionSet) {
  if (!questionSet) return null;
  return {
    id: questionSet.id,
    version: questionSet.version,
    created_at: questionSet.created_at,
    categories: Array.isArray(questionSet.categories) ? questionSet.categories : JSON.parse(questionSet.categories || '[]'),
    indicators: Array.isArray(questionSet.indicators) ? questionSet.indicators : JSON.parse(questionSet.indicators || '[]')
  };
}

function setStatus(message, type) {
  const el = document.getElementById('auth-status');
  el.textContent = message;
  el.className = `status ${type || 'info'}`;
}

function showAdminMessage(message, type) {
  const el = document.getElementById('admin-message');
  el.textContent = message;
  el.className = `status ${type || 'info'}`;
}

function setAuthenticatedUI(isAuthenticated) {
  document.getElementById('admin-login-card').classList.toggle('hidden', isAuthenticated);
  document.getElementById('admin-shell').classList.toggle('hidden', !isAuthenticated);
  document.getElementById('logout-button').classList.toggle('hidden', !isAuthenticated);
}

function setActiveTabUI(tabName) {
  Object.entries(TAB_PANELS).forEach(([name, panelId]) => {
    const tabButton = document.querySelector(`.admin-tab[data-tab="${name}"]`);
    const panel = document.getElementById(panelId);
    const isActive = name === tabName;

    if (tabButton) {
      tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    if (panel) {
      panel.hidden = !isActive;
      panel.classList.toggle('hidden', !isActive);
    }
  });
}

function renderUsers(users) {
  const container = document.getElementById('admin-users-list');
  if (!users.length) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }

  let html = '<table class="table"><thead><tr><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>';
  users.forEach((user) => {
    html += `<tr>
      <td>${escapeHtml(user.email || '—')}</td>
      <td>${escapeHtml(user.role || 'user')}</td>
      <td class="inline-actions">
        <button class="secondary" type="button" onclick="editAdminUser(${user.id})">Edit</button>
        <button class="secondary" type="button" onclick="deleteAdminUser(${user.id}, '${escapeHtml(user.email || '')}')">Delete</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderQuestionVersions(questionSets) {
  const container = document.getElementById('admin-question-versions');
  if (!questionSets.length) {
    container.innerHTML = '<p>No question versions found.</p>';
    return;
  }

  container.innerHTML = `<div class="version-list">${questionSets.map((set) => `<div class="version-item"><strong>Version ${escapeHtml(set.version)}</strong><br><span>${escapeHtml(new Date(set.created_at).toLocaleString())}</span><br><small>${escapeHtml(set.categories.length)} categories</small></div>`).join('')}</div>`;
}

function renderAssessmentSummary(assessments) {
  const container = document.getElementById('admin-assessment-summary');
  if (!assessments.length) {
    container.innerHTML = '<p>No synced assessments found.</p>';
    return;
  }

  const recent = assessments.slice(0, 10);
  container.innerHTML = `<p><strong>Total synced assessments:</strong> ${escapeHtml(assessments.length)}</p>
    <table class="table"><thead><tr><th>ID</th><th>User</th><th>Version</th><th>Created</th></tr></thead><tbody>
    ${recent.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.email || item.username || 'Unknown')}</td><td>${escapeHtml(item.question_set_version || '—')}</td><td>${escapeHtml(new Date(item.created_at).toLocaleString())}</td></tr>`).join('')}
    </tbody></table>`;
}

function renderQuestionEditor(questionSet) {
  const container = document.getElementById('admin-question-editor');
  if (!questionSet) {
    container.innerHTML = '<p>No question set available.</p>';
    return;
  }

  let html = '';
  questionSet.categories.forEach((category, catIdx) => {
    const categoryIndicators = questionSet.indicators[catIdx] || [];
    html += `<div class="category-box" data-cat-index="${catIdx}">
      <label>Category Name</label>
      <input class="category-name" type="text" value="${escapeHtml(category)}">
      <div class="inline-actions">
        <button class="secondary" type="button" data-action="add-indicator" data-cat-index="${catIdx}">Add Indicator</button>
        <button class="secondary" type="button" data-action="remove-category" data-cat-index="${catIdx}">Remove Category</button>
      </div>`;

    categoryIndicators.forEach((indicator, indIdx) => {
      html += `<div class="indicator-box" data-cat-index="${catIdx}" data-ind-index="${indIdx}">
        <label>Indicator</label>
        <input class="indicator-name" type="text" value="${escapeHtml(indicator.name || '')}">
        <label>Scores (one per line)</label>
        <textarea class="score-lines" rows="5">${escapeHtml((indicator.scores || []).join('\n'))}</textarea>
        <div class="inline-actions">
          <button class="secondary" type="button" data-action="remove-indicator" data-cat-index="${catIdx}" data-ind-index="${indIdx}">Remove Indicator</button>
        </div>
      </div>`;
    });

    html += '</div>';
  });

  html += '<div class="inline-actions"><button class="secondary" type="button" data-action="add-category">Add Category</button></div>';
  container.innerHTML = html;
}

function readEditor(strict) {
  const categoryEls = document.querySelectorAll('#admin-question-editor .category-box');
  const categories = [];
  const indicators = [];

  categoryEls.forEach((categoryEl, catIdx) => {
    const categoryName = categoryEl.querySelector('.category-name').value.trim() || `Category ${catIdx + 1}`;
    const indicatorEls = categoryEl.querySelectorAll('.indicator-box');

    categories.push(categoryName);
    indicators[catIdx] = [];

    indicatorEls.forEach((indicatorEl, indIdx) => {
      const name = indicatorEl.querySelector('.indicator-name').value.trim() || `Indicator ${indIdx + 1}`;
      const scoreLines = indicatorEl.querySelector('.score-lines').value.split('\n').map((line) => line.trim()).filter(Boolean);

      if (strict && scoreLines.length !== 4) {
        throw new Error(`Indicator "${name}" must have exactly 4 score lines.`);
      }

      while (scoreLines.length < 4) {
        scoreLines.push(`Score ${scoreLines.length + 1}`);
      }

      indicators[catIdx].push({ name, scores: scoreLines.slice(0, 4) });
    });
  });

  if (strict && categories.length === 0) {
    throw new Error('At least one category is required.');
  }

  return { categories, indicators };
}

function mutateEditor(action, catIdx, indIdx) {
  const workingSet = readEditor(false);

  if (action === 'add-category') {
    workingSet.categories.push(`New Category ${workingSet.categories.length + 1}`);
    workingSet.indicators.push([{ name: 'New indicator', scores: ['Score 1', 'Score 2', 'Score 3', 'Score 4'] }]);
  }

  if (action === 'remove-category' && workingSet.categories.length > 1) {
    workingSet.categories.splice(catIdx, 1);
    workingSet.indicators.splice(catIdx, 1);
  }

  if (action === 'add-indicator' && workingSet.indicators[catIdx]) {
    workingSet.indicators[catIdx].push({ name: 'New indicator', scores: ['Score 1', 'Score 2', 'Score 3', 'Score 4'] });
  }

  if (action === 'remove-indicator' && workingSet.indicators[catIdx] && workingSet.indicators[catIdx].length > 1) {
    workingSet.indicators[catIdx].splice(indIdx, 1);
  }

  renderQuestionEditor(workingSet);
}

function editAdminUser(userId) {
  window.location.href = `/admin/users/${userId}/edit`;
}
window.editAdminUser = editAdminUser;

async function deleteAdminUser(userId, email) {
  const confirmed = window.confirm(`Delete user ${email || userId}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  try {
    await AdminAPI.deleteUser(userId);
    showAdminMessage('User deleted.', 'success');
    adminState.loaded.users = false;
    await loadUsersTabData(true);
    renderUsers(adminState.users);
  } catch (error) {
    showAdminMessage(error.message || 'Failed to delete user.', 'error');
  }
}
window.deleteAdminUser = deleteAdminUser;

async function publishQuestionVersion() {
  try {
    const edited = readEditor(true);
    const response = await AdminAPI.createQuestionSet(edited.categories, edited.indicators);
    const savedSet = normalizeQuestionSet(response.questionSet);

    localStorage.setItem('question_set_version', String(savedSet.version || 1));
    localStorage.setItem('question_set_data', JSON.stringify({ categories: savedSet.categories, indicators: savedSet.indicators }));

    showAdminMessage(`Published version ${savedSet.version}.`, 'success');
    adminState.loaded.questionSets = false;
    await loadQuestionSetsData(true);
    if (adminState.activeTab === 'question-versions') {
      renderQuestionVersions(adminState.questionSets);
    }
    if (adminState.activeTab === 'question-editor') {
      renderQuestionEditor(adminState.latestQuestionSet);
    }
  } catch (error) {
    showAdminMessage(error.message || 'Failed to publish version.', 'error');
  }
}

async function loadUsersTabData(force) {
  if (!force && adminState.loaded.users) {
    return;
  }
  const usersResponse = await AdminAPI.getUsers();
  adminState.users = usersResponse.users || [];
  adminState.loaded.users = true;
}

async function loadQuestionSetsData(force) {
  if (!force && adminState.loaded.questionSets) {
    return;
  }
  const questionSetsResponse = await AdminAPI.getQuestionSets();
  adminState.questionSets = (questionSetsResponse.questionSets || []).map(normalizeQuestionSet);
  adminState.latestQuestionSet = adminState.questionSets[0] || null;
  adminState.loaded.questionSets = true;
}

async function loadAssessmentsData(force) {
  if (!force && adminState.loaded.assessments) {
    return;
  }
  const assessmentsResponse = await AdminAPI.getAssessments();
  adminState.assessments = assessmentsResponse.assessments || [];
  adminState.loaded.assessments = true;
}

async function activateTab(tabName, forceReload) {
  adminState.activeTab = tabName;
  setActiveTabUI(tabName);

  try {
    if (tabName === 'users') {
      showAdminMessage('Loading users...', 'info');
      await loadUsersTabData(!!forceReload);
      renderUsers(adminState.users);
    } else if (tabName === 'question-versions') {
      showAdminMessage('Loading question versions...', 'info');
      await loadQuestionSetsData(!!forceReload);
      renderQuestionVersions(adminState.questionSets);
    } else if (tabName === 'question-editor') {
      showAdminMessage('Loading question editor...', 'info');
      await loadQuestionSetsData(!!forceReload);
      renderQuestionEditor(adminState.latestQuestionSet);
    } else if (tabName === 'assessments') {
      showAdminMessage('Loading synced assessments...', 'info');
      await loadAssessmentsData(!!forceReload);
      renderAssessmentSummary(adminState.assessments);
    }

    showAdminMessage('Active tab loaded.', 'success');
  } catch (error) {
    showAdminMessage(error.message || 'Failed to load tab data.', 'error');
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) {
    setStatus('Enter email and password.', 'warning');
    return;
  }

  try {
    const data = await AuthAPI.login(email, password);
    if (!data.user || data.user.role !== 'admin') {
      setAuthenticatedUI(false);
      setStatus('You are not an admin.', 'warning');
      return;
    }

    setStatus(`Logged in as ${data.user.email || data.user.username}`, 'success');
    setAuthenticatedUI(true);
    await activateTab('users', true);
    if (flashMessage) {
      showAdminMessage(flashMessage.text, flashMessage.type);
      flashMessage = null;
    }
  } catch (error) {
    setStatus(error.message || 'Login failed.', 'error');
  }
}

async function handleLogout() {
  await AuthAPI.logout();
  setAuthenticatedUI(false);
  adminState.loaded = {
    users: false,
    questionSets: false,
    assessments: false
  };
  setStatus('Logged out.', 'info');
}

async function bootstrap() {
  const url = new URL(window.location.href);
  const msg = url.searchParams.get('msg');
  if (msg === 'user-saved') {
    flashMessage = {
      text: 'User saved successfully.',
      type: 'success'
    };
    url.searchParams.delete('msg');
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  document.getElementById('login-button').addEventListener('click', handleLogin);
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  document.getElementById('admin-save-version-button').addEventListener('click', publishQuestionVersion);
  document.getElementById('create-user-button').addEventListener('click', () => {
    window.location.href = '/admin/users/new';
  });
  document.querySelectorAll('.admin-tab').forEach((tabButton) => {
    tabButton.addEventListener('click', () => activateTab(tabButton.dataset.tab, true));
  });
  document.getElementById('admin-question-editor').addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    mutateEditor(action, parseInt(event.target.dataset.catIndex || '-1', 10), parseInt(event.target.dataset.indIndex || '-1', 10));
  });

  const token = getToken();
  if (!token) {
    setAuthenticatedUI(false);
    return;
  }

  try {
    const me = await AuthAPI.getMe();
    if (!me.user || me.user.role !== 'admin') {
      setAuthenticatedUI(false);
      setStatus('This account does not have admin access.', 'warning');
      return;
    }

    setStatus(`Logged in as ${me.user.email || me.user.username}`, 'success');
    setAuthenticatedUI(true);
    await activateTab('users', true);
    if (flashMessage) {
      showAdminMessage(flashMessage.text, flashMessage.type);
      flashMessage = null;
    }
  } catch (error) {
    clearToken();
    setAuthenticatedUI(false);
    setStatus(error.message || 'Please log in.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
