const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('jwt_token');
}

function clearToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('current_user');
}

function setStatus(message, type) {
  const el = document.getElementById('assessment-status');
  el.textContent = message;
  el.className = `status ${type || 'info'}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function bindMediaDownloadLinks(container) {
  if (!container) return;

  container.querySelectorAll('[data-media-download="true"]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();

      try {
        await downloadProtectedFile(link.dataset.mediaUrl, link.dataset.mediaFilename);
      } catch (error) {
        setStatus(error.message || 'Failed to download media.', 'error');
      }
    });
  });
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
  getAssessment(assessmentId) {
    return apiRequest(`/api/admin/assessments/${assessmentId}`);
  }
};

function parseJsonMaybe(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }
  try {
    return JSON.parse(value || 'null') || fallback;
  } catch (error) {
    return fallback;
  }
}

function parseScoreIndex(label) {
  const match = String(label).match(/^indicator\[(\d+)\]\[(\d+)\]$/);
  if (!match) return null;
  return {
    categoryIndex: Number(match[1]),
    indicatorIndex: Number(match[2])
  };
}

function scoreNumeric(scoreValue) {
  const n = Number(scoreValue);
  return n >= 1 && n <= 4 ? n : null;
}

function scoreDescription(scoreValue, indicatorDef) {
  const n = scoreNumeric(scoreValue);
  if (!n) return 'Not answered';
  if (!indicatorDef || !Array.isArray(indicatorDef.scores)) return `Score ${n}`;
  return indicatorDef.scores[n - 1] || `Score ${n}`;
}

function renderMediaLinks(mediaItems) {
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

function renderAssessment(assessmentRow) {
  const assessment = assessmentRow.data || {};
  const scores = assessment.scores || {};
  const categories = parseJsonMaybe(assessmentRow.categories, []);
  const indicators = parseJsonMaybe(assessmentRow.indicators, []);
  const mediaItems = Array.isArray(assessmentRow.media) ? assessmentRow.media : [];

  const metaEl = document.getElementById('assessment-meta');
  const groupsEl = document.getElementById('assessment-answer-groups');

  const contactInfo = assessment.contactInfo || {};
  const created = assessment.created_at || assessment.created || assessmentRow.created_at;

  metaEl.innerHTML = `
    <div class="version-item">
      <strong>Assessment ID:</strong> ${escapeHtml(assessmentRow.id)}<br>
      <strong>User:</strong> ${escapeHtml(assessmentRow.email || assessmentRow.username || 'Unknown')}<br>
      <strong>Question Set Version:</strong> ${escapeHtml(assessmentRow.question_set_version || '—')}<br>
      <strong>Created:</strong> ${escapeHtml(created ? new Date(created).toLocaleString() : '—')}<br>
      <strong>Contact Name:</strong> ${escapeHtml(contactInfo.fullName || '—')}<br>
      <strong>Contact Email:</strong> ${escapeHtml(contactInfo.email || '—')}<br>
      <strong>Location:</strong> ${escapeHtml(contactInfo.location || '—')}<br>
      ${renderMediaLinks(mediaItems)}
    </div>
  `;
  bindMediaDownloadLinks(metaEl);

  let groupedHtml = '';
  categories.forEach((categoryName, categoryIndex) => {
    const categoryIndicators = indicators[categoryIndex] || [];
    let rows = '';

    categoryIndicators.forEach((indicator, indicatorIndex) => {
      const key = `indicator[${categoryIndex}][${indicatorIndex}]`;
      const value = scores[key];
      const n = scoreNumeric(value);
      const scoreCell = n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
      rows += `<tr>
        <td>${escapeHtml(indicator.name || `Indicator ${indicatorIndex + 1}`)}</td>
        ${scoreCell}
        <td>${escapeHtml(scoreDescription(value, indicator))}</td>
      </tr>`;
    });

    groupedHtml += `
      <section class="category-box">
        <h3>${escapeHtml(categoryName || `Category ${categoryIndex + 1}`)}</h3>
        <table class="table">
          <thead><tr><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">No indicators found for this category.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  });

  if (!groupedHtml) {
    const scoredEntries = Object.entries(scores);
    if (scoredEntries.length) {
      let rows = '';
      scoredEntries.forEach(([key, val]) => {
        const parsed = parseScoreIndex(key);
        const categoryLabel = parsed ? `Category ${parsed.categoryIndex + 1}` : 'Unknown Category';
        const indicatorLabel = parsed ? `Indicator ${parsed.indicatorIndex + 1}` : key;
        const n = scoreNumeric(val);
        const scoreCell = n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
        rows += `<tr><td>${escapeHtml(categoryLabel)}</td><td>${escapeHtml(indicatorLabel)}</td>${scoreCell}<td>${escapeHtml(n ? `Score ${n}` : 'Not answered')}</td></tr>`;
      });
      groupedHtml = `<section class="category-box"><h3>Answers</h3><table class="table"><thead><tr><th>Category</th><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    } else {
      groupedHtml = '<p>No answers found for this assessment.</p>';
    }
  }

  groupsEl.innerHTML = groupedHtml;
}

function getAssessmentIdFromPath() {
  const match = window.location.pathname.match(/^\/admin\/assessments\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function bootstrap() {
  const assessmentId = getAssessmentIdFromPath();
  if (!assessmentId) {
    window.location.href = '/admin';
    return;
  }

  document.getElementById('assessment-page-title').textContent = `Assessment ${assessmentId}`;
  document.getElementById('back-button').addEventListener('click', () => {
    window.location.href = '/admin#assessments';
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    await AuthAPI.logout();
    window.location.href = '/admin';
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

  try {
    setStatus('Loading assessment details...', 'info');
    const data = await AdminAPI.getAssessment(assessmentId);
    renderAssessment(data.assessment);
    document.getElementById('assessment-status').className = 'status hidden';
  } catch (error) {
    setStatus(error.message || 'Failed to load assessment.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
