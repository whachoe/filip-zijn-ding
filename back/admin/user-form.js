const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('jwt_token');
}

function clearToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('current_user');
}

function setStatus(message, type) {
  const el = document.getElementById('form-status');
  el.textContent = message;
  el.className = `status ${type || 'info'}`;
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
  async getMe() {
    return apiRequest('/api/auth/me');
  },
  async logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  }
};

const AdminAPI = {
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
  }
};

function getUserIdFromPath() {
  const match = window.location.pathname.match(/^\/admin\/users\/(\d+)\/edit$/);
  return match ? Number(match[1]) : null;
}

async function bootstrap() {
  const userId = getUserIdFromPath();
  const isCreate = window.location.pathname === '/admin/users/new';

  if (!isCreate && !userId) {
    window.location.href = '/admin';
    return;
  }

  document.getElementById('page-title').textContent = isCreate ? 'Create User' : 'Edit User';
  document.getElementById('user-password').required = isCreate;

  document.getElementById('cancel-button').addEventListener('click', () => {
    window.location.href = '/admin';
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    await AuthAPI.logout();
    window.location.href = '/admin';
  });

  document.getElementById('save-user-button').addEventListener('click', async () => {
    const firstName = document.getElementById('user-first-name').value.trim();
    const lastName = document.getElementById('user-last-name').value.trim();
    const location = document.getElementById('user-location').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    if (!email) {
      setStatus('Email is required.', 'warning');
      return;
    }

    if (isCreate && !password) {
      setStatus('Password is required.', 'warning');
      return;
    }

    try {
      setStatus('Saving user...', 'info');

      if (isCreate) {
        await AdminAPI.createUser({ firstName, lastName, location, email, password, role });
      } else {
        const payload = { firstName, lastName, location, email, role };
        if (password) {
          payload.password = password;
        }
        await AdminAPI.updateUser(userId, payload);
      }

      setStatus('User saved.', 'success');
      window.location.href = '/admin?msg=user-saved';
    } catch (error) {
      setStatus(error.message || 'Failed to save user.', 'error');
    }
  });

  try {
    const me = await AuthAPI.getMe();
    if (!me.user || me.user.role !== 'admin') {
      clearToken();
      window.location.href = '/admin';
      return;
    }
  } catch (error) {
    clearToken();
    window.location.href = '/admin';
    return;
  }

  if (!isCreate) {
    try {
      setStatus('Loading user...', 'info');
      const response = await AdminAPI.getUser(userId);
      const user = response.user;
      document.getElementById('user-first-name').value = user.first_name || '';
      document.getElementById('user-last-name').value = user.last_name || '';
      document.getElementById('user-location').value = user.location || '';
      document.getElementById('user-email').value = user.email || '';
      document.getElementById('user-role').value = user.role || 'user';
      setStatus('User loaded.', 'success');
    } catch (error) {
      setStatus(error.message || 'Failed to load user.', 'error');
    }
  } else {
    setStatus('Enter details for the new user.', 'info');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
