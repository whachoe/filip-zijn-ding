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

function isNotApplicableScore(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'na' || normalized === 'not_applicable';
}

function scoreDescription(scoreValue, indicatorDef) {
  if (isNotApplicableScore(scoreValue)) return 'Not applicable';
  const n = scoreNumeric(scoreValue);
  if (!n) return 'Not answered';
  if (!indicatorDef || !Array.isArray(indicatorDef.scores)) return `Score ${n}`;
  return indicatorDef.scores[n - 1] || `Score ${n}`;
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

function renderAssessment(assessmentRow) {
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
  categories.forEach((categoryName, categoryIndex) => {
    const categoryIndicators = indicators[categoryIndex] || [];
    let rows = '';

    categoryIndicators.forEach((indicator, indicatorIndex) => {
      const key = `indicator[${categoryIndex}][${indicatorIndex}]`;
      const value = scores[key];
      const n = scoreNumeric(value);
      const note = questionNotes[key];
      const scoreCell = isNotApplicableScore(value)
        ? '<td class="score-cell score-na">N/A</td>'
        : n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
      rows += `<tr>
        <td>${escapeHtml(indicator.name || `Indicator ${indicatorIndex + 1}`)}</td>
        ${scoreCell}
        <td>${escapeHtml(scoreDescription(value, indicator))}</td>
        <td class="assessment-notes">${escapeHtml(note || '—')}</td>
      </tr>`;
    });

    groupedHtml += `
      <section class="category-box">
        <h3>${escapeHtml(categoryName || `Category ${categoryIndex + 1}`)}</h3>
        <table class="table assessment-answer-table">
          <colgroup>
            <col class="assessment-answer-col-indicator">
            <col class="assessment-answer-col-score">
            <col class="assessment-answer-col-answer">
            <col class="assessment-answer-col-notes">
          </colgroup>
          <thead><tr><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th><th>Notes</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">No indicators found for this category.</td></tr>'}</tbody>
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
        const parsed = parseScoreIndex(key);
        const categoryLabel = parsed ? `Category ${parsed.categoryIndex + 1}` : 'Unknown Category';
        const indicatorLabel = parsed ? `Indicator ${parsed.indicatorIndex + 1}` : key;
        const n = scoreNumeric(val);
        const scoreCell = isNotApplicableScore(val)
          ? '<td class="score-cell score-na">N/A</td>'
          : n ? `<td class="score-cell">${n}</td>` : '<td class="score-cell score-empty">—</td>';
        rows += `<tr><td>${escapeHtml(categoryLabel)}</td><td>${escapeHtml(indicatorLabel)}</td>${scoreCell}<td>${escapeHtml(scoreDescription(val))}</td><td class="assessment-notes">${escapeHtml(questionNotes[key] || '—')}</td></tr>`;
      });
      groupedHtml = `<section class="category-box"><h3>Answers</h3><table class="table"><thead><tr><th>Category</th><th>Indicator</th><th class="score-cell">Score</th><th>Answer</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></section>`;
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
