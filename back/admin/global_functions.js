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
  async getMe(updateCurrentUser = false) {
    const data = await apiRequest('/api/auth/me');
    if (updateCurrentUser && data.user) {
      setCurrentUser(data.user);
    }
    return data;
  }
};

async function downloadProtectedFile(url, filename) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE}${url}`, { headers });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function renderMediaLinks(mediaItems, escapeHtml) {
  if (!Array.isArray(mediaItems) || !mediaItems.length) {
    return '<strong>Uploaded Media:</strong> —';
  }

  return `<strong>Uploaded Media:</strong><br><ul>${mediaItems.map((item) => {
    const filename = escapeHtml(item.filename || `File ${item.id}`);
    const url = escapeHtml(item.url || '#');
    const uploadedAt = item.uploadedAt ? ` <small>(${escapeHtml(new Date(item.uploadedAt).toLocaleString())})</small>` : '';
    return `<li><a href="#" data-media-download="true" data-media-url="${url}" data-media-filename="${filename}">${filename}</a>${uploadedAt}</li>`;
  }).join('')}</ul>`;
}
