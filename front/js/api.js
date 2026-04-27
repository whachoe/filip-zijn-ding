// API Client for MMT Assessment Backend
// Handles all communication with the server

const API_BASE_URL = window.location.origin;

// Get JWT token from localStorage
function getToken() {
  return localStorage.getItem('jwt_token');
}

// Set JWT token in localStorage
function setToken(token) {
  localStorage.setItem('jwt_token', token);
}

// Remove JWT token
function clearToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('current_user');
}

// Check if user is logged in
function isLoggedIn() {
  return !!getToken();
}

// Get current user info
function getCurrentUser() {
  const userStr = localStorage.getItem('current_user');
  return userStr ? JSON.parse(userStr) : null;
}

// Set current user info
function setCurrentUser(user) {
  localStorage.setItem('current_user', JSON.stringify(user));
}

// Generic API request helper
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth API
const AuthAPI = {
  async register(email, password) {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
    }
    
    return data;
  },
  
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

// Assessment API
const AssessmentAPI = {
  async sync(assessments) {
    return await apiRequest('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(assessments)
    });
  },
  
  async list() {
    return await apiRequest('/api/assessments');
  },
  
  async get(id) {
    return await apiRequest(`/api/assessments/${id}`);
  },
  
  async delete(id) {
    return await apiRequest(`/api/assessments/${id}`, {
      method: 'DELETE'
    });
  }
};

// Question API
const QuestionAPI = {
  async getLatest() {
    return await apiRequest('/api/questions/latest');
  },
  
  async getVersion(version) {
    return await apiRequest(`/api/questions/${version}`);
  }
};

if (typeof window !== 'undefined') {
  window.AuthAPI = AuthAPI;
  window.AssessmentAPI = AssessmentAPI;
  window.QuestionAPI = QuestionAPI;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    getCurrentUser,
    setCurrentUser,
    AuthAPI,
    AssessmentAPI,
    QuestionAPI
  };
}
