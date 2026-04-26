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
  async login(username, password) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
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
  updateUserRole(userId, role) {
    return apiRequest(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
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
  questionSets: [],
  latestQuestionSet: null,
  assessments: []
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

function setShellVisible(visible) {
  document.getElementById('admin-shell').classList.toggle('hidden', !visible);
}

function renderUsers(users) {
  const container = document.getElementById('admin-users-list');
  if (!users.length) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }

  let html = '<table class="table"><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>';
  users.forEach((user) => {
    html += `<tr>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.email || '—')}</td>
      <td>
        <select id="role-select-${user.id}">
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td><button class="secondary" type="button" onclick="updateAdminUserRole(${user.id})">Save</button></td>
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
    ${recent.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.username || 'Unknown')}</td><td>${escapeHtml(item.question_set_version || '—')}</td><td>${escapeHtml(new Date(item.created_at).toLocaleString())}</td></tr>`).join('')}
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

async function updateAdminUserRole(userId) {
  try {
    const role = document.getElementById(`role-select-${userId}`).value;
    await AdminAPI.updateUserRole(userId, role);
    showAdminMessage('User role updated.', 'success');
    await loadAdminData();
  } catch (error) {
    showAdminMessage(error.message || 'Failed to update role.', 'error');
  }
}
window.updateAdminUserRole = updateAdminUserRole;

async function publishQuestionVersion() {
  try {
    const edited = readEditor(true);
    const response = await AdminAPI.createQuestionSet(edited.categories, edited.indicators);
    const savedSet = normalizeQuestionSet(response.questionSet);

    localStorage.setItem('question_set_version', String(savedSet.version || 1));
    localStorage.setItem('question_set_data', JSON.stringify({ categories: savedSet.categories, indicators: savedSet.indicators }));

    showAdminMessage(`Published version ${savedSet.version}.`, 'success');
    await loadAdminData();
  } catch (error) {
    showAdminMessage(error.message || 'Failed to publish version.', 'error');
  }
}

async function loadAdminData() {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    setShellVisible(false);
    showAdminMessage('Admin access is required.', 'warning');
    return;
  }

  setShellVisible(true);
  showAdminMessage('Loading admin data...', 'info');

  try {
    const [usersResponse, questionSetsResponse, assessmentsResponse] = await Promise.all([
      AdminAPI.getUsers(),
      AdminAPI.getQuestionSets(),
      AdminAPI.getAssessments()
    ]);

    adminState.questionSets = (questionSetsResponse.questionSets || []).map(normalizeQuestionSet);
    adminState.latestQuestionSet = adminState.questionSets[0] || null;
    adminState.assessments = assessmentsResponse.assessments || [];

    renderUsers(usersResponse.users || []);
    renderQuestionVersions(adminState.questionSets);
    renderQuestionEditor(adminState.latestQuestionSet);
    renderAssessmentSummary(adminState.assessments);
    showAdminMessage('Admin data loaded.', 'success');
  } catch (error) {
    showAdminMessage(error.message || 'Failed to load admin data.', 'error');
  }
}

async function handleLogin() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!username || !password) {
    setStatus('Enter username and password.', 'warning');
    return;
  }

  try {
    const data = await AuthAPI.login(username, password);
    if (!data.user || data.user.role !== 'admin') {
      setShellVisible(false);
      setStatus('Login succeeded, but this account is not an admin.', 'warning');
      return;
    }

    setStatus(`Logged in as ${data.user.username}`, 'success');
    await loadAdminData();
  } catch (error) {
    setStatus(error.message || 'Login failed.', 'error');
  }
}

async function handleLogout() {
  await AuthAPI.logout();
  setShellVisible(false);
  setStatus('Logged out.', 'info');
}

async function bootstrap() {
  document.getElementById('login-button').addEventListener('click', handleLogin);
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  document.getElementById('admin-refresh-button').addEventListener('click', loadAdminData);
  document.getElementById('admin-save-version-button').addEventListener('click', publishQuestionVersion);
  document.getElementById('admin-question-editor').addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    mutateEditor(action, parseInt(event.target.dataset.catIndex || '-1', 10), parseInt(event.target.dataset.indIndex || '-1', 10));
  });

  const token = getToken();
  if (!token) {
    setShellVisible(false);
    return;
  }

  try {
    const me = await AuthAPI.getMe();
    if (!me.user || me.user.role !== 'admin') {
      setShellVisible(false);
      setStatus('This account does not have admin access.', 'warning');
      return;
    }

    setStatus(`Logged in as ${me.user.username}`, 'success');
    await loadAdminData();
  } catch (error) {
    clearToken();
    setShellVisible(false);
    setStatus(error.message || 'Please log in.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
