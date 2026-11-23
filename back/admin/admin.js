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
  getAssessments(page, limit) {
    const params = new URLSearchParams();
    params.set('page', String(page || 1));
    params.set('limit', String(limit || 10));
    return apiRequest(`/api/admin/assessments?${params.toString()}`);
  },
  getAssessmentsExport() {
    return apiRequest('/api/admin/assessments?full=true');
  },
  getAssessment(assessmentId) {
    return apiRequest(`/api/admin/assessments/${assessmentId}`);
  },
  deleteAssessment(assessmentId) {
    return apiRequest(`/api/admin/assessments/${assessmentId}`, {
      method: 'DELETE'
    });
  }
};

let adminState = {
  users: [],
  questionSets: [],
  latestQuestionSet: null,
  assessments: [],
  assessmentsPagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
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

function bindMediaDownloadLinks(container) {
  if (!container) return;

  const statusEl = document.getElementById('assessment-detail-status');
  container.querySelectorAll('[data-media-download="true"]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();

      try {
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.className = 'status info hidden';
        }
        await downloadProtectedFile(link.dataset.mediaUrl, link.dataset.mediaFilename);
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = error.message || 'Failed to download media.';
          statusEl.className = 'status error';
          statusEl.classList.remove('hidden');
        }
      }
    });
  });
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

function buildPagerItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1, 2, totalPages - 1, totalPages];
  const middleCandidates = [page - 1, page, page + 1];

  middleCandidates.forEach((item) => {
    if (item > 2 && item < totalPages - 1) {
      pages.push(item);
    }
  });

  const uniquePages = Array.from(new Set(pages)).sort((left, right) => left - right);
  const items = [];

  uniquePages.forEach((item, index) => {
    if (index > 0 && item - uniquePages[index - 1] > 1) {
      items.push('ellipsis');
    }
    items.push(item);
  });

  return items;
}

function renderPagerNumbers(page, totalPages) {
  const items = buildPagerItems(page, totalPages);

  return `<div class="pager-numbers">${items.map((item, index) => {
    if (item === 'ellipsis') {
      return `<span class="pager-ellipsis" aria-hidden="true" data-ellipsis-index="${index}">...</span>`;
    }

    const isCurrent = item === page;
    return `<a href="#" class="pager-number${isCurrent ? ' is-active' : ''}" data-page="${item}" ${isCurrent ? 'aria-current="page"' : ''}>${item}</a>`;
  }).join('')}</div>`;
}

function renderAssessmentSummary(assessments, pagination) {
  const container = document.getElementById('admin-assessment-summary');
  const page = pagination && pagination.page ? pagination.page : 1;
  const total = pagination && typeof pagination.total === 'number' ? pagination.total : assessments.length;
  const totalPages = pagination && typeof pagination.totalPages === 'number' ? pagination.totalPages : (assessments.length ? 1 : 0);

  if (!assessments.length) {
    container.innerHTML = '<p>No synced assessments found.</p>';
    return;
  }

  container.innerHTML = `<p><strong>Total synced assessments:</strong> ${escapeHtml(total)}</p>
    <table class="table"><thead><tr><th>ID</th><th>User</th><th>Version</th><th>Created</th><th>Action</th></tr></thead><tbody>
    ${assessments.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.email || item.username || 'Unknown')}</td><td>${escapeHtml(item.question_set_version || '—')}</td><td>${escapeHtml(new Date(item.created_at).toLocaleString())}</td><td class="inline-actions"><button class="secondary" type="button" onclick="showAdminAssessment('${escapeHtml(item.id)}')">Show</button><button class="secondary" type="button" onclick="deleteAdminAssessment('${escapeHtml(item.id)}')">Delete</button></td></tr>`).join('')}
    </tbody></table>
    <div class="pager" aria-label="Assessment pagination">
      <button id="assessment-page-prev" class="secondary" type="button" ${page <= 1 ? 'disabled' : ''}>Previous</button>
      ${renderPagerNumbers(page, totalPages || 1)}
      <button id="assessment-page-next" class="secondary" type="button" ${!totalPages || page >= totalPages ? 'disabled' : ''}>Next</button>
    </div>`;

  const prevBtn = document.getElementById('assessment-page-prev');
  const nextBtn = document.getElementById('assessment-page-next');
  const pageButtons = container.querySelectorAll('.pager-number[data-page]');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => goToAssessmentPage(page - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => goToAssessmentPage(page + 1));
  }

  pageButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      goToAssessmentPage(parseInt(button.dataset.page, 10));
    });
  });
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function buildExportRows(assessments) {
  // Group all assessments by question-set version.
  // Use the first assessment's question set as the column template.
  const first = assessments.find((a) => a.categories && a.indicators);
  if (!first) return null;

  const categories = parseJsonMaybe(first.categories, []);
  const indicators = parseJsonMaybe(first.indicators, []);

  const headerRow = [
    'Date', 'Market name', 'Alternative/local name', 'Country', 'Province/state',
    'District', 'City/town/village', 'Market setting', 'Latitude', 'Longitude',
    'Assessment sequence', 'Lead assessor', 'Lead assessor email', 'Other assessors',
    'General market notes', 'Assessment notes'
  ];
  const categoryRow = Array(headerRow.length).fill('');
  const merges = [];
  let startCol = headerRow.length;

  indicators.forEach((cat, catX) => {
    const endCol = startCol + cat.length - 1;
    merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: endCol } });

    cat.forEach((indicator, indX) => {
      categoryRow.push(indX === 0 ? (categories[catX] || `Category ${catX + 1}`) : '');
      headerRow.push(indicator.name || `Indicator ${catX + 1}.${indX + 1}`);
    });

    startCol = endCol + 1;
  });

  const dataRows = assessments.map((row) => {
    const assessment = row.data || {};
    const scores = assessment.scores || {};
    const market = assessment.marketInfo || {};
    const leadAssessor = market.leadAssessor || {};
    const created = assessment.created_at || assessment.created || row.created_at;
    const otherAssessors = Array.isArray(market.otherAssessors)
      ? market.otherAssessors.map((assessor) => [assessor.name, assessor.organization].filter(Boolean).join(' — ')).join('; ')
      : '';
    const sequence = Number(market.assessmentSequence);
    const sequenceLabel = sequence === 1
      ? 'Initial assessment'
      : sequence > 1 ? `Repeat ${sequence - 1}` : '';

    const scoreValues = [];
    indicators.forEach((cat, catX) => {
      cat.forEach((_, indX) => {
        const key = `indicator[${catX}][${indX}]`;
        const v = scores[key];
        scoreValues.push(isNotApplicableScore(v) ? 'Not applicable' : v != null && v !== '' ? Number(v) : '');
      });
    });

    return [
      created ? new Date(created).toLocaleString() : '',
      market.marketName || '',
      market.localName || '',
      market.country || '',
      market.provinceState || '',
      market.district || '',
      market.cityTownVillage || '',
      market.setting === 'Other' && market.settingOther ? `Other: ${market.settingOther}` : market.setting || '',
      market.latitude == null ? '' : market.latitude,
      market.longitude == null ? '' : market.longitude,
      sequenceLabel,
      leadAssessor.name || '',
      leadAssessor.email || '',
      otherAssessors,
      market.generalNotes || '',
      assessment.notes || '',
      ...scoreValues
    ];
  });

  return { rows: [categoryRow, headerRow, ...dataRows], merges };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportAssessments(format) {
  const statusEl = document.getElementById('export-status');
  statusEl.textContent = 'Exporting…';
  try {
    const response = await AdminAPI.getAssessmentsExport();
    const assessments = response.assessments || [];

    if (!assessments.length) {
      statusEl.textContent = 'No assessments to export.';
      return;
    }

    const built = buildExportRows(assessments);
    if (!built) {
      statusEl.textContent = 'No question-set data available for export.';
      return;
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(built.rows);
      ws['!merges'] = built.merges;
      XLSX.utils.book_append_sheet(wb, ws, 'MMT Indicator Scores');
      XLSX.writeFile(wb, 'mmt_assessments.xlsx');
    } else {
      const csvContent = built.rows.map((row) =>
        row.map((cell) => {
          const s = String(cell == null ? '' : cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
      ).join('\r\n');
      triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), 'mmt_assessments.csv');
    }

    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = err.message || 'Export failed.';
  }
}

function showAdminAssessment(assessmentId) {
  document.getElementById('assessment-list-view').classList.add('hidden');
  const detailView = document.getElementById('assessment-detail-view');
  detailView.classList.remove('hidden');
  document.getElementById('assessment-detail-title').textContent = `Assessment ${assessmentId}`;
  document.getElementById('assessment-meta').innerHTML = '';
  document.getElementById('assessment-answer-groups').innerHTML = '';

  const statusEl = document.getElementById('assessment-detail-status');
  statusEl.textContent = 'Loading...';
  statusEl.className = 'status info';

  AdminAPI.getAssessment(assessmentId)
    .then((data) => {
      statusEl.className = 'status hidden';
      renderAssessmentDetail(data.assessment);
    })
    .catch((error) => {
      statusEl.textContent = error.message || 'Failed to load assessment.';
      statusEl.className = 'status error';
    });
}
window.showAdminAssessment = showAdminAssessment;

function hideAssessmentDetail() {
  document.getElementById('assessment-detail-view').classList.add('hidden');
  document.getElementById('assessment-list-view').classList.remove('hidden');
}

function parseJsonMaybe(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }
  try {
    return JSON.parse(value || 'null') || fallback;
  } catch (e) {
    return fallback;
  }
}

function scoreNumeric(v) {
  const n = Number(v);
  return n >= 1 && n <= 4 ? n : null;
}

function isNotApplicableScore(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'na' || normalized === 'not_applicable';
}

function scoreDescription(v, indicatorDef) {
  if (isNotApplicableScore(v)) return 'Not applicable';
  const n = scoreNumeric(v);
  if (!n) return 'Not answered';
  if (!indicatorDef || !Array.isArray(indicatorDef.scores)) return `Score ${n}`;
  return indicatorDef.scores[n - 1] || `Score ${n}`;
}

function formatScoreSummary(scoreValues, totalKnown) {
  let scoreTotal = 0;
  let answeredCount = 0;
  let applicableCount = 0;

  scoreValues.forEach((value) => {
    if (isNotApplicableScore(value)) return;
    applicableCount++;
    const score = scoreNumeric(value);
    if (score !== null) {
      scoreTotal += score;
      answeredCount++;
    }
  });

  const average = answeredCount ? (scoreTotal / answeredCount).toFixed(0) : '—';
  const confidence = totalKnown && scoreValues.length
    ? `${applicableCount ? Math.round((answeredCount * 100) / applicableCount) : 0}%`
    : '—';
  return `${average} (${confidence})`;
}

function renderMarketDetails(marketInfo, legacyContactInfo) {
  if (!marketInfo || typeof marketInfo !== 'object') {
    return `
      <strong>Contact Name:</strong> ${escapeHtml(legacyContactInfo.fullName || '—')}<br>
      <strong>Contact Email:</strong> ${escapeHtml(legacyContactInfo.email || '—')}<br>
      <strong>Location:</strong> ${escapeHtml(legacyContactInfo.location || '—')}<br>`;
  }

  const sequence = Number(marketInfo.assessmentSequence);
  const sequenceLabel = sequence === 1
    ? 'Initial assessment'
    : sequence > 1 ? `Repeat ${sequence - 1}` : '—';
  const setting = marketInfo.setting === 'Other' && marketInfo.settingOther
    ? `Other: ${marketInfo.settingOther}`
    : marketInfo.setting || '—';
  const coordinates = marketInfo.latitude != null && marketInfo.longitude != null
    ? `${marketInfo.latitude}, ${marketInfo.longitude}`
    : '—';
  const leadAssessor = marketInfo.leadAssessor || {};
  const otherAssessors = Array.isArray(marketInfo.otherAssessors)
    ? marketInfo.otherAssessors.map((assessor) => [assessor.name, assessor.organization].filter(Boolean).join(' — ')).filter(Boolean).join('; ')
    : '';
  const fields = [
    ['Market ID', marketInfo.marketId],
    ['Market name', marketInfo.marketName],
    ['Alternative/local name', marketInfo.localName],
    ['Country', marketInfo.country],
    ['Province/state', marketInfo.provinceState],
    ['District', marketInfo.district],
    ['City/town/village', marketInfo.cityTownVillage],
    ['Market setting', setting],
    ['GPS coordinates', coordinates],
    ['Lead assessor', leadAssessor.name],
    ['Lead assessor email', leadAssessor.email],
    ['Other assessors present', otherAssessors],
    ['Assessment sequence', sequenceLabel],
    ['General market notes', marketInfo.generalNotes]
  ];

  return fields.map(([label, value]) => {
    const noteClass = label === 'General market notes' ? ' class="assessment-notes"' : '';
    const map = label === 'GPS coordinates' ? renderMarketMap(marketInfo) : '';
    return `<strong>${escapeHtml(label)}:</strong> <span${noteClass}>${escapeHtml(value || '—')}</span><br>${map}`;
  }).join('');
}

function renderAssessmentDetail(assessmentRow) {
  const assessment = assessmentRow.data || {};
  const scores = assessment.scores || {};
  const questionNotes = assessment.questionNotes || {};
  const categories = parseJsonMaybe(assessmentRow.categories, []);
  const indicators = parseJsonMaybe(assessmentRow.indicators, []);
  const mediaItems = Array.isArray(assessmentRow.media) ? assessmentRow.media : [];

  const metaEl = document.getElementById('assessment-meta');
  const groupsEl = document.getElementById('assessment-answer-groups');

  const contactInfo = assessment.contactInfo || {};
  const marketInfo = assessment.marketInfo || null;
  const created = assessment.created_at || assessment.created || assessmentRow.created_at;
  const scoreColumns = `<colgroup>
    <col class="assessment-answer-col-indicator">
    <col class="assessment-answer-col-score">
    <col class="assessment-answer-col-answer">
    <col class="assessment-answer-col-notes">
  </colgroup>`;

  metaEl.innerHTML = `
    <div class="version-item">
      <strong>Assessment ID:</strong> ${escapeHtml(assessmentRow.id)}<br>
      <strong>User:</strong> ${escapeHtml(assessmentRow.email || assessmentRow.username || 'Unknown')}<br>
      <strong>Question Set Version:</strong> ${escapeHtml(assessmentRow.question_set_version || '—')}<br>
      <strong>Created:</strong> ${escapeHtml(created ? new Date(created).toLocaleString() : '—')}<br>
      ${renderMarketDetails(marketInfo, contactInfo)}
      <strong>Assessment notes:</strong> <span class="assessment-notes">${escapeHtml(assessment.notes || '—')}</span><br>
      ${renderMediaLinks(mediaItems, escapeHtml)}
    </div>
  `;
  bindMediaDownloadLinks(metaEl);

  let groupedHtml = '';
  const overallScores = [];
  let overallTotalKnown = categories.length > 0;
  categories.forEach((categoryName, categoryIndex) => {
    const categoryTotalKnown = Array.isArray(indicators[categoryIndex]);
    const categoryIndicators = categoryTotalKnown ? indicators[categoryIndex] : [];
    if (!categoryTotalKnown) overallTotalKnown = false;
    const categoryScores = [];
    let rows = '';
    categoryIndicators.forEach((indicator, indicatorIndex) => {
      const key = `indicator[${categoryIndex}][${indicatorIndex}]`;
      const value = scores[key];
      categoryScores.push(value);
      overallScores.push(value);
      const n = scoreNumeric(value);
      const scoreCell = isNotApplicableScore(value)
        ? '<td class="score-cell score-na">N/A</td>'
        : n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
      const note = questionNotes[key];
      rows += `<tr><td>${escapeHtml(indicator.name || `Indicator ${indicatorIndex + 1}`)}</td>${scoreCell}<td>${escapeHtml(scoreDescription(value, indicator))}</td><td class="assessment-notes">${escapeHtml(note || '—')}</td></tr>`;
    });
    groupedHtml += `
      <section class="category-box">
        <h3>${escapeHtml(categoryName || `Category ${categoryIndex + 1}`)}</h3>
        <table class="table assessment-answer-table">
          ${scoreColumns}
          <thead><tr><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th><th>Notes</th></tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="4">No indicators found for this category.</td></tr>'}
            <tr><td><strong>Category Score(Confidence Score)</strong></td><td class="score-cell">${formatScoreSummary(categoryScores, categoryTotalKnown)}</td><td></td><td></td></tr>
          </tbody>
        </table>
      </section>
    `;
  });

  if (!groupedHtml) {
    const questionKeys = Array.from(new Set(Object.keys(scores).concat(Object.keys(questionNotes))));
    if (questionKeys.length) {
      let rows = '';
      questionKeys.forEach((key) => {
        const val = scores[key];
        const match = String(key).match(/^indicator\[(\d+)\]\[(\d+)\]$/);
        const catLabel = match ? `Category ${Number(match[1]) + 1}` : 'Unknown';
        const indLabel = match ? `Indicator ${Number(match[2]) + 1}` : key;
        const n = scoreNumeric(val);
        const scoreCell = isNotApplicableScore(val)
          ? '<td class="score-cell score-na">N/A</td>'
          : n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
        rows += `<tr><td>${escapeHtml(catLabel)}</td><td>${escapeHtml(indLabel)}</td>${scoreCell}<td>${escapeHtml(scoreDescription(val))}</td><td class="assessment-notes">${escapeHtml(questionNotes[key] || '—')}</td></tr>`;
      });
      groupedHtml = `<section class="category-box"><h3>Answers</h3><table class="table"><thead><tr><th>Category</th><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    } else {
      groupedHtml = '<p>No answers found for this assessment.</p>';
    }
  }

  if (!categories.length) {
    Object.entries(scores).forEach(([key, value]) => {
      if (/^indicator\[\d+\]\[\d+\]$/.test(key)) overallScores.push(value);
    });
  }
  const overallScore = formatScoreSummary(overallScores, overallTotalKnown);
  groupsEl.innerHTML = `${groupedHtml}
    <section class="category-box overall-score">
      <table class="table assessment-answer-table">
        ${scoreColumns}
        <tbody><tr><td><strong>Overall Score</strong></td><td class="score-cell">${overallScore}</td><td></td><td></td></tr></tbody>
      </table>
    </section>`;
}

async function deleteAdminAssessment(assessmentId) {
  const confirmed = window.confirm(`Delete assessment ${assessmentId}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  try {
    await AdminAPI.deleteAssessment(assessmentId);
    showAdminMessage('Assessment deleted.', 'success');
    adminState.loaded.assessments = false;
    await loadAssessmentsData(true, adminState.assessmentsPagination.page);
    renderAssessmentSummary(adminState.assessments, adminState.assessmentsPagination);
  } catch (error) {
    showAdminMessage(error.message || 'Failed to delete assessment.', 'error');
  }
}
window.deleteAdminAssessment = deleteAdminAssessment;

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
        <label for="notes-label-${catIdx}-${indIdx}">Notes label (optional)</label>
        <input id="notes-label-${catIdx}-${indIdx}" class="notes-label" type="text" value="${escapeHtml(indicator.notesLabel || '')}" placeholder="Notes (optional)">
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
      const notesLabel = indicatorEl.querySelector('.notes-label').value.trim();

      if (strict && scoreLines.length !== 4) {
        throw new Error(`Indicator "${name}" must have exactly 4 score lines.`);
      }

      while (scoreLines.length < 4) {
        scoreLines.push(`Score ${scoreLines.length + 1}`);
      }

      indicators[catIdx].push({ name, scores: scoreLines.slice(0, 4), notesLabel });
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

async function loadAssessmentsData(force, page) {
  if (!force && adminState.loaded.assessments) {
    return;
  }

  const targetPage = page || adminState.assessmentsPagination.page || 1;
  const assessmentsResponse = await AdminAPI.getAssessments(targetPage, adminState.assessmentsPagination.limit);
  adminState.assessments = assessmentsResponse.assessments || [];
  adminState.assessmentsPagination = Object.assign({}, adminState.assessmentsPagination, assessmentsResponse.pagination || {});

  if (!adminState.assessments.length && adminState.assessmentsPagination.totalPages > 0 && targetPage > adminState.assessmentsPagination.totalPages) {
    return loadAssessmentsData(true, adminState.assessmentsPagination.totalPages);
  }

  adminState.loaded.assessments = true;
}

async function goToAssessmentPage(page) {
  const totalPages = adminState.assessmentsPagination.totalPages || 0;
  if (page < 1 || (totalPages && page > totalPages)) {
    return;
  }

  try {
    showAdminMessage('Loading synced assessments...', 'info');
    adminState.loaded.assessments = false;
    await loadAssessmentsData(true, page);
    renderAssessmentSummary(adminState.assessments, adminState.assessmentsPagination);
    document.getElementById('admin-message').classList.add('hidden');
  } catch (error) {
    showAdminMessage(error.message || 'Failed to load assessments.', 'error');
  }
}

async function activateTab(tabName, forceReload) {
  adminState.activeTab = tabName;
  setActiveTabUI(tabName);

  // Always return to list view when switching tabs
  if (tabName !== 'assessments') {
    document.getElementById('assessment-detail-view').classList.add('hidden');
    document.getElementById('assessment-list-view').classList.remove('hidden');
  }

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
      renderAssessmentSummary(adminState.assessments, adminState.assessmentsPagination);
    }

    document.getElementById('admin-message').classList.add('hidden');
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
  adminState.assessmentsPagination = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
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
  document.getElementById('assessment-back-button').addEventListener('click', hideAssessmentDetail);
  document.getElementById('export-xlsx-button').addEventListener('click', () => exportAssessments('xlsx'));
  document.getElementById('export-csv-button').addEventListener('click', () => exportAssessments('csv'));
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
    const me = await AuthAPI.getMe(true);
    if (!me.user || me.user.role !== 'admin') {
      setAuthenticatedUI(false);
      setStatus('This account does not have admin access.', 'warning');
      return;
    }

    setStatus(`Logged in as ${me.user.email || me.user.username}`, 'success');
    setAuthenticatedUI(true);
    const hashTab = window.location.hash.replace('#', '');
    const validTabs = ['users', 'question-versions', 'question-editor', 'assessments'];
    await activateTab(validTabs.includes(hashTab) ? hashTab : 'users', true);
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
