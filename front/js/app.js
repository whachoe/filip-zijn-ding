const MARKET_CACHE_KEY = 'market_cache';
const MARKET_DRAFT_KEY = 'market_wizard_draft';
let marketWizardStep = 0;
let marketWizardTargetAssessmentId = null;
let selectedMarket = null;
let sharedMarkets = [];
let currentMarketInfo = null;
let currentMarketInfoOwner = null;

function marketUserKey() {
  const user = typeof getCurrentUser === 'function' && typeof isLoggedIn === 'function' && isLoggedIn()
    ? getCurrentUser() : null;
  return user && user.id != null ? String(user.id) : null;
}

function marketCacheKey() {
  const userId = marketUserKey();
  return userId ? `${MARKET_CACHE_KEY}_${userId}` : null;
}

function marketDraftKey() {
  return `${MARKET_DRAFT_KEY}_${marketUserKey() || 'offline'}`;
}

function readStoredJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from local storage:`, error);
    return fallback;
  }
}

function readSharedMarketCache() {
  const key = marketCacheKey();
  const cached = key ? readStoredJson(key, []) : [];
  return Array.isArray(cached) ? cached : [];
}

function getMarketIdentityKey(marketInfo) {
  return [
    marketInfo.marketName,
    marketInfo.country,
    marketInfo.provinceState,
    marketInfo.district,
    marketInfo.cityTownVillage
  ].map((value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase())
    .join('|');
}

function setCurrentMarketInfo(marketInfo) {
  currentMarketInfo = marketInfo ? JSON.parse(JSON.stringify(marketInfo)) : null;
  currentMarketInfoOwner = marketUserKey();
}

function getCurrentMarketInfo() {
  return currentMarketInfoOwner === marketUserKey() && currentMarketInfo
    ? currentMarketInfo : readStoredJson(marketDraftKey(), null);
}

window.setCurrentMarketInfo = setCurrentMarketInfo;
window.getCurrentMarketInfo = getCurrentMarketInfo;
window.marketCacheKey = marketCacheKey;
window.marketDraftKey = marketDraftKey;

function setMarketWizardStatus(message, type = 'info') {
  const status = document.getElementById('market-wizard-status');
  if (!status) return;
  status.textContent = message;
  status.className = `sync-message ${type}`;
  status.hidden = !message;
}

function getMarketLabel(market) {
  return [market.marketName, market.cityTownVillage, market.district, market.country]
    .filter(Boolean)
    .join(' — ');
}

function renderMarketOptions(selectedId = '') {
  const select = document.getElementById('market-select');
  if (!select) return;

  select.replaceChildren(new Option('Create a new market', ''));
  sharedMarkets.forEach((market) => {
    select.add(new Option(getMarketLabel(market), String(market.id)));
  });
  if (selectedId && sharedMarkets.some((market) => String(market.id) === String(selectedId))) {
    select.value = String(selectedId);
  }
}

async function refreshSharedMarkets() {
  const cacheKey = marketCacheKey();
  sharedMarkets = readSharedMarketCache();
  renderMarketOptions(selectedMarket ? selectedMarket.id : '');

  if (typeof isLoggedIn !== 'function' || !isLoggedIn() || typeof MarketAPI === 'undefined') return;

  try {
    const response = await MarketAPI.list();
    if (marketCacheKey() !== cacheKey) return;
    sharedMarkets = Array.isArray(response.markets) ? response.markets : [];
    localStorage.setItem(cacheKey, JSON.stringify(sharedMarkets));
    renderMarketOptions(selectedMarket ? selectedMarket.id : '');
    applyMarketInfoToWizard(readStoredJson(marketDraftKey(), null) || getCurrentMarketInfo() || {});
    setMarketWizardStatus('');
  } catch (error) {
    if (marketCacheKey() === cacheKey) {
      setMarketWizardStatus('Could not refresh your markets. You can still create a market offline; it will be matched when synced.', 'warning');
    }
  }
}

function setMarketIdentityFields(market) {
  const fields = {
    'market-name': market.marketName || '',
    'market-local-name': market.localName || '',
    'market-country': market.country || '',
    'market-province-state': market.provinceState || '',
    'market-district': market.district || '',
    'market-city-town-village': market.cityTownVillage || ''
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
}

function setMarketFieldsReadOnly(readOnly) {
  ['market-name', 'market-local-name', 'market-country', 'market-province-state', 'market-district', 'market-city-town-village']
    .forEach((id) => {
      document.getElementById(id).readOnly = readOnly;
    });
}

function countLocalMarketAssessments(marketInfo) {
  const assessmentIds = readStoredJson('assessment_list', []);
  if (!Array.isArray(assessmentIds)) return 0;

  return assessmentIds.reduce((count, id) => {
    const assessment = readStoredJson(id, null);
    if (assessment && assessment.progress && assessment.progress.completed
        && assessment.marketInfo
        && getMarketIdentityKey(assessment.marketInfo) === getMarketIdentityKey(marketInfo)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function updateAssessmentSequencePreview() {
  const sequence = document.getElementById('assessment-sequence');
  if (!sequence) return;

  const marketInfo = {
    marketName: document.getElementById('market-name').value.trim(),
    country: document.getElementById('market-country').value.trim(),
    provinceState: document.getElementById('market-province-state').value.trim(),
    district: document.getElementById('market-district').value.trim(),
    cityTownVillage: document.getElementById('market-city-town-village').value.trim()
  };
  const completedCount = selectedMarket && Number.isInteger(Number(selectedMarket.assessmentCount))
    ? Number(selectedMarket.assessmentCount)
    : countLocalMarketAssessments(marketInfo);
  sequence.textContent = completedCount === 0
    ? 'Assessment sequence: Initial assessment'
    : `Assessment sequence: Repeat ${completedCount}`;
}

function addOtherAssessorRow(assessor = {}) {
  const list = document.getElementById('other-assessors-list');
  const row = document.createElement('div');
  row.className = 'other-assessor-row';

  const name = document.createElement('input');
  name.type = 'text';
  name.name = 'otherAssessorName';
  name.placeholder = 'Name';
  name.maxLength = 255;
  name.value = assessor.name || '';
  name.setAttribute('aria-label', 'Other assessor name');

  const organization = document.createElement('input');
  organization.type = 'text';
  organization.name = 'otherAssessorOrganization';
  organization.placeholder = 'Organization (optional)';
  organization.maxLength = 255;
  organization.value = assessor.organization || '';
  organization.setAttribute('aria-label', 'Other assessor organization');

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', 'Remove assessor');
  remove.addEventListener('click', () => {
    row.remove();
    saveMarketWizardDraft();
  });

  [name, organization].forEach((field) => field.addEventListener('input', saveMarketWizardDraft));
  row.append(name, organization, remove);
  list.appendChild(row);
}

function currentLeadAssessor() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const nameInput = document.getElementById('lead-assessor-name');
  const name = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || ''
    : (nameInput.value || '').trim();

  return {
    userId: user && user.id ? user.id : null,
    name,
    email: user && user.email ? user.email : ''
  };
}

function collectMarketInfo() {
  const leadAssessor = currentLeadAssessor();
  const localMarketInfo = {
    marketId: selectedMarket ? Number(selectedMarket.id) : null,
    marketName: document.getElementById('market-name').value.trim(),
    localName: document.getElementById('market-local-name').value.trim(),
    country: document.getElementById('market-country').value.trim(),
    provinceState: document.getElementById('market-province-state').value.trim(),
    district: document.getElementById('market-district').value.trim(),
    cityTownVillage: document.getElementById('market-city-town-village').value.trim(),
    setting: document.getElementById('market-setting').value,
    settingOther: document.getElementById('market-setting-other').value.trim(),
    latitude: document.getElementById('market-latitude').value,
    longitude: document.getElementById('market-longitude').value,
    leadAssessor,
    otherAssessors: Array.from(document.querySelectorAll('.other-assessor-row')).map((row) => ({
      name: row.querySelector('[name="otherAssessorName"]').value.trim(),
      organization: row.querySelector('[name="otherAssessorOrganization"]').value.trim()
    })).filter((assessor) => assessor.name),
    generalNotes: document.getElementById('market-general-notes').value.trim()
  };
  const assessmentCount = selectedMarket && Number.isInteger(Number(selectedMarket.assessmentCount))
    ? Number(selectedMarket.assessmentCount)
    : countLocalMarketAssessments(localMarketInfo);
  localMarketInfo.assessmentSequence = assessmentCount + 1;
  return localMarketInfo;
}

function saveMarketWizardDraft() {
  const form = document.getElementById('market-wizard-form');
  if (!form) return;
  try {
    localStorage.setItem(marketDraftKey(), JSON.stringify(collectMarketInfo()));
  } catch (error) {
    setMarketWizardStatus(`Could not save market information locally: ${error.message}`, 'error');
  }
  updateAssessmentSequencePreview();
}

function applyMarketInfoToWizard(marketInfo = {}) {
  selectedMarket = marketInfo.marketId
    ? sharedMarkets.find((market) => String(market.id) === String(marketInfo.marketId)) || null
    : null;
  renderMarketOptions(selectedMarket ? selectedMarket.id : '');
  if (selectedMarket) {
    setMarketIdentityFields(selectedMarket);
  } else {
    setMarketIdentityFields(marketInfo);
  }
  setMarketFieldsReadOnly(!!selectedMarket);

  document.getElementById('market-setting').value = marketInfo.setting || '';
  document.getElementById('market-setting-other').value = marketInfo.settingOther || '';
  document.getElementById('market-setting-other-wrap').hidden = marketInfo.setting !== 'Other';
  document.getElementById('market-setting-other-wrap').classList.toggle('hidden', marketInfo.setting !== 'Other');
  document.getElementById('market-latitude').value = marketInfo.latitude == null ? '' : marketInfo.latitude;
  document.getElementById('market-longitude').value = marketInfo.longitude == null ? '' : marketInfo.longitude;
  document.getElementById('market-general-notes').value = marketInfo.generalNotes || '';

  const leadInput = document.getElementById('lead-assessor-name');
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const profileName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || ''
    : '';
  leadInput.value = profileName || (marketInfo.leadAssessor && marketInfo.leadAssessor.name) || '';
  leadInput.readOnly = !!user;
  document.getElementById('lead-assessor-profile').textContent = user
    ? `Linked to your account${user.email ? ` (${user.email})` : ''}.`
    : 'Enter the lead assessor name while offline. It will be linked to your account when you sign in and sync.';

  const assessorList = document.getElementById('other-assessors-list');
  assessorList.replaceChildren();
  (Array.isArray(marketInfo.otherAssessors) ? marketInfo.otherAssessors : []).forEach(addOtherAssessorRow);
  if (!assessorList.children.length) addOtherAssessorRow();
  updateAssessmentSequencePreview();
}

function renderMarketWizardStep() {
  const steps = Array.from(document.querySelectorAll('[data-market-step]'));
  steps.forEach((step, index) => {
    step.hidden = index !== marketWizardStep;
    step.classList.toggle('hidden', index !== marketWizardStep);
  });

  const previous = document.getElementById('market-wizard-previous');
  const next = document.getElementById('market-wizard-next');
  const start = document.getElementById('start-market-assessment');
  previous.hidden = marketWizardStep === 0;
  previous.classList.toggle('hidden', marketWizardStep === 0);
  next.hidden = marketWizardStep === steps.length - 1;
  next.classList.toggle('hidden', marketWizardStep === steps.length - 1);
  start.hidden = marketWizardStep !== steps.length - 1;
  start.classList.toggle('hidden', marketWizardStep !== steps.length - 1);
  start.textContent = marketWizardTargetAssessmentId ? 'Save details and continue' : 'Start assessment';
  document.getElementById('market-wizard-step-label').textContent = `Step ${marketWizardStep + 1} of ${steps.length}`;
  document.getElementById('market-wizard-progress-fill').style.width = `${((marketWizardStep + 1) / steps.length) * 100}%`;
}

function resetMarketWizardToStart() {
  marketWizardTargetAssessmentId = null;
  marketWizardStep = 0;
  renderMarketWizardStep();
  setMarketWizardStatus('');
}

window.resetMarketWizardToStart = resetMarketWizardToStart;

function validateMarketWizardStep() {
  if (marketWizardStep === 0 && !document.getElementById('market-name').value.trim()) {
    setMarketWizardStatus('Enter a market name to continue.', 'warning');
    document.getElementById('market-name').focus();
    return false;
  }
  if (marketWizardStep === 1 && !document.getElementById('market-setting').value) {
    setMarketWizardStatus('Select a market setting, or choose “Don’t know” if it cannot be determined.', 'warning');
    document.getElementById('market-setting').focus();
    return false;
  }
  if (marketWizardStep === 1 && document.getElementById('market-setting').value === 'Other'
      && !document.getElementById('market-setting-other').value.trim()) {
    setMarketWizardStatus('Specify the other market setting or choose another option.', 'warning');
    document.getElementById('market-setting-other').focus();
    return false;
  }
  if (marketWizardStep === 1) {
    const latitude = document.getElementById('market-latitude').value;
    const longitude = document.getElementById('market-longitude').value;
    if ((latitude && !longitude) || (!latitude && longitude)
        || (latitude && (Number(latitude) < -90 || Number(latitude) > 90))
        || (longitude && (Number(longitude) < -180 || Number(longitude) > 180))) {
      setMarketWizardStatus('Enter both GPS coordinates within their valid ranges, or leave both blank.', 'warning');
      return false;
    }
  }
  setMarketWizardStatus('');
  return true;
}

function initializeMarketWizard() {
  const form = document.getElementById('market-wizard-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  sharedMarkets = readSharedMarketCache();
  renderMarketOptions();
  applyMarketInfoToWizard(readStoredJson(marketDraftKey(), {}));

  document.getElementById('market-select').addEventListener('change', (event) => {
    const market = sharedMarkets.find((item) => String(item.id) === event.target.value);
    const leadAssessor = currentLeadAssessor();
    applyMarketInfoToWizard(market ? { ...market, marketId: market.id, leadAssessor } : { leadAssessor });
    saveMarketWizardDraft();
  });

  form.addEventListener('input', (event) => {
    if (event.target.id === 'market-setting') return;
    saveMarketWizardDraft();
  });
  document.getElementById('market-setting').addEventListener('change', (event) => {
    const isOther = event.target.value === 'Other';
    const otherWrap = document.getElementById('market-setting-other-wrap');
    otherWrap.hidden = !isOther;
    otherWrap.classList.toggle('hidden', !isOther);
    saveMarketWizardDraft();
  });
  document.getElementById('add-other-assessor').addEventListener('click', () => addOtherAssessorRow());
  document.getElementById('market-wizard-next').addEventListener('click', () => {
    if (!validateMarketWizardStep()) return;
    marketWizardStep = Math.min(marketWizardStep + 1, 2);
    renderMarketWizardStep();
  });
  document.getElementById('market-wizard-previous').addEventListener('click', () => {
    marketWizardStep = Math.max(marketWizardStep - 1, 0);
    renderMarketWizardStep();
  });
  document.getElementById('start-market-assessment').addEventListener('click', () => {
    if (!document.getElementById('market-name').value.trim()) {
      marketWizardStep = 0;
      renderMarketWizardStep();
      validateMarketWizardStep();
      return;
    }
    const marketInfo = collectMarketInfo();
    if (!marketInfo.leadAssessor.name) {
      setMarketWizardStatus('Enter the lead assessor name while offline.', 'warning');
      document.getElementById('lead-assessor-name').focus();
      return;
    }
    if (marketWizardTargetAssessmentId) {
      const assessment = readStoredJson(marketWizardTargetAssessmentId, null);
      if (!assessment) {
        setMarketWizardStatus('The active assessment could not be found in local storage.', 'error');
        return;
      }
      assessment.marketInfo = marketInfo;
      delete assessment.contactInfo;
      assessment.synced = false;
      try {
        localStorage.setItem(marketWizardTargetAssessmentId, JSON.stringify(assessment));
      } catch (error) {
        setMarketWizardStatus(`Could not save market information: ${error.message}`, 'error');
        return;
      }
      marketWizardTargetAssessmentId = null;
      updateHomeAssessmentPrompt();
    } else {
      try {
        localStorage.setItem(marketDraftKey(), JSON.stringify(marketInfo));
      } catch (error) {
        setMarketWizardStatus(`Could not save market information locally: ${error.message}`, 'error');
        return;
      }
    }
    setCurrentMarketInfo(marketInfo);
    const assessmentTab = document.getElementById('tab-assessment');
    assessmentTab.dataset.startNewAssessment = 'true';
    assessmentTab.removeAttribute('disabled');
    assessmentTab.click();
  });

  document.getElementById('capture-market-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      setMarketWizardStatus('This device does not support GPS location capture. Enter coordinates manually.', 'warning');
      return;
    }
    const captureButton = document.getElementById('capture-market-location');
    captureButton.disabled = true;
    setMarketWizardStatus('Getting your location…');
    navigator.geolocation.getCurrentPosition((position) => {
      document.getElementById('market-latitude').value = position.coords.latitude;
      document.getElementById('market-longitude').value = position.coords.longitude;
      saveMarketWizardDraft();
      setMarketWizardStatus('GPS coordinates added.');
      captureButton.disabled = false;
    }, (error) => {
      setMarketWizardStatus(`Could not get GPS location: ${error.message}. Enter coordinates manually.`, 'error');
      captureButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000 });
  });

  renderMarketWizardStep();
}

function callNTimes(func, num, delay) {
    if (!num) return;
    func();
    setTimeout(function() { callNTimes(func, num - 1, delay); }, delay);
}

function updateTotalRecords() {
  const totalRecordsEl = document.getElementById('total_records');
  if(totalRecordsEl) {
    let records = JSON.parse(localStorage.getItem('assessment_list') || '[]');
    if (!Array.isArray(records)) {
      records = [];
    }

    // Keep only unique IDs that still exist in localStorage.
    const normalized = [...new Set(records)].filter((id) => !!localStorage.getItem(id));

    // Self-heal stale list entries so other features use consistent data.
    if (normalized.length !== records.length) {
      localStorage.setItem('assessment_list', JSON.stringify(normalized));
    }

    totalRecordsEl.textContent = normalized.length;
  }
  
  // Also update sync status if function exists
  if (typeof updateSyncStatus === 'function') {
      updateSyncStatus();
  }
}

function makeArrayUnique(a) {
  return [...new Set(a)];
}

function setAuthStatus(message, type) {
  const statusEl = document.getElementById('auth-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `sync-status ${type || 'info'}`;
}

async function refreshQuestionSetFromServer() {
  if (typeof QuestionAPI === 'undefined' || typeof isLoggedIn !== 'function' || !isLoggedIn()) {
    return;
  }

  try {
    const data = await QuestionAPI.getLatest();
    if (!data || !data.questionSet) return;

    const questionSet = data.questionSet;
    const categories = Array.isArray(questionSet.categories) ? questionSet.categories : JSON.parse(questionSet.categories || '[]');
    const indicators = Array.isArray(questionSet.indicators) ? questionSet.indicators : JSON.parse(questionSet.indicators || '[]');

    localStorage.setItem('question_set_version', String(questionSet.version || 1));
    localStorage.setItem('question_set_data', JSON.stringify({ categories, indicators }));

    if (typeof window.refreshQuestionnaire === 'function') {
      window.refreshQuestionnaire();
    }
  } catch (error) {
    console.log('Question set refresh skipped:', error.message);
  }
}

function updateAuthUI() {
  const user = typeof isLoggedIn === 'function' && isLoggedIn() && typeof getCurrentUser === 'function'
    ? getCurrentUser() : null;
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const loginSection = document.getElementById('frontend-login-section');
  const welcomeSection = document.getElementById('frontend-welcome-section');

  if (welcomeSection) {
    welcomeSection.hidden = !user;
    welcomeSection.classList.toggle('hidden', !user);
  }

  if (user) {
    setAuthStatus(`Logged in as ${user.email || user.username}`, 'success');
    if (loginButton) loginButton.disabled = false;
    if (logoutButton) {
      logoutButton.hidden = false;
      logoutButton.removeAttribute('hidden');
      logoutButton.classList.remove('hidden');
    }
    if (loginSection) {
      loginSection.hidden = true;
      loginSection.classList.add('hidden');
    }
  } else {
    setAuthStatus('Not logged in.', 'info');
    if (logoutButton) {
      logoutButton.hidden = true;
      logoutButton.setAttribute('hidden', 'hidden');
      logoutButton.classList.add('hidden');
    }
    if (loginSection) {
      loginSection.hidden = false;
      loginSection.classList.remove('hidden');
    }
  }

  const savedMarketInfo = getCurrentMarketInfo();
  const nameInput = document.getElementById('lead-assessor-name');
  if (nameInput) {
    const profileName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || ''
      : '';
    nameInput.value = profileName || (savedMarketInfo && savedMarketInfo.leadAssessor && savedMarketInfo.leadAssessor.name) || '';
    nameInput.readOnly = !!user;
    document.getElementById('lead-assessor-profile').textContent = user
      ? `Linked to your account${user.email ? ` (${user.email})` : ''}.`
      : 'Enter the lead assessor name while offline. It will be linked to your account when you sign in and sync.';
  }

  if (typeof updateSyncStatus === 'function') {
    updateSyncStatus();
  }
  updateHomeAssessmentPrompt();
}

function updateHomeAssessmentPrompt() {
  const prompt = document.getElementById('home-active-assessment');
  const sendButton = document.getElementById('send-completed-assessment');
  const wizard = document.getElementById('market-wizard');
  if (!prompt || !sendButton || !wizard) return;

  const activeAssessment = typeof window.getIncompleteAssessment === 'function'
    ? window.getIncompleteAssessment()
    : null;
  const isVisible = !!activeAssessment;
  const hasUploadScreen = typeof window.getPendingMediaUploadAssessment === 'function'
    && !!window.getPendingMediaUploadAssessment();

  prompt.hidden = !isVisible;
  prompt.classList.toggle('hidden', !isVisible);
  const showWizard = !activeAssessment || !activeAssessment.marketInfo;
  wizard.hidden = !showWizard;
  wizard.classList.toggle('hidden', !showWizard);
  const assessmentTab = document.getElementById('tab-assessment');
  if (assessmentTab) {
    if (hasUploadScreen || activeAssessment && activeAssessment.marketInfo) assessmentTab.removeAttribute('disabled');
    else assessmentTab.setAttribute('disabled', 'disabled');
  }
  const canSend = isVisible
    && typeof window.canSyncCompletedAssessments === 'function'
    && window.canSyncCompletedAssessments();
  sendButton.hidden = !canSend;
  sendButton.classList.toggle('hidden', !canSend);
}

window.updateHomeAssessmentPrompt = updateHomeAssessmentPrompt;

async function handleLogin() {
  const emailField = document.getElementById('auth-email');
  const email = emailField ? emailField.value.trim() : '';
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    setAuthStatus('Enter email and password to log in.', 'warning');
    return;
  }

  try {
    const anonymousDraftKey = marketDraftKey();
    const anonymousDraft = !marketUserKey() ? readStoredJson(anonymousDraftKey, null) : null;
    const loginData = await AuthAPI.login(email, password);
    if (anonymousDraft && !anonymousDraft.marketId && !localStorage.getItem(marketDraftKey())) {
      localStorage.setItem(marketDraftKey(), JSON.stringify(anonymousDraft));
      localStorage.removeItem(anonymousDraftKey);
    }
    await refreshQuestionSetFromServer();
    await refreshSharedMarkets();
    applyMarketInfoToWizard(readStoredJson(marketDraftKey(), {}));
    updateAuthUI();
    setAuthStatus(`Welcome back, ${email}.`, 'success');
  } catch (error) {
    setAuthStatus(error.message || 'Login failed.', 'error');
  }
}

async function handleLogout() {
  let logoutError = null;
  try {
    await AuthAPI.logout();
  } catch (error) {
    logoutError = error;
  }
  selectedMarket = null;
  setCurrentMarketInfo(null);
  await refreshSharedMarkets();
  applyMarketInfoToWizard(readStoredJson(marketDraftKey(), {}));
  updateAuthUI();
  setAuthStatus(logoutError
    ? `Logged out locally, but server logout failed: ${logoutError.message}`
    : 'You have been logged out.', logoutError ? 'warning' : 'info');
}

function initAuthControls() {
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');

  if (loginButton && !loginButton.dataset.bound) {
    loginButton.addEventListener('click', handleLogin);
    loginButton.dataset.bound = 'true';
  }

  if (logoutButton && !logoutButton.dataset.bound) {
    logoutButton.addEventListener('click', handleLogout);
    logoutButton.dataset.bound = 'true';
  }

  const deleteActiveAssessmentButton = document.getElementById('delete-active-assessment');
  if (deleteActiveAssessmentButton && !deleteActiveAssessmentButton.dataset.bound) {
    deleteActiveAssessmentButton.addEventListener('click', () => {
      const activeAssessment = typeof window.getIncompleteAssessment === 'function'
        ? window.getIncompleteAssessment()
        : null;
      if (!activeAssessment) {
        updateHomeAssessmentPrompt();
        return;
      }

      try {
        const storedIds = localStorage.getItem('assessment_list');
        const parsedIds = storedIds ? JSON.parse(storedIds) : [];
        const assessmentIds = Array.isArray(parsedIds) ? parsedIds : [];
        localStorage.removeItem(activeAssessment.id);
        if (storedIds !== null) {
          localStorage.setItem('assessment_list', JSON.stringify(assessmentIds.filter((id) => id !== activeAssessment.id)));
        }
        marketWizardTargetAssessmentId = null;
        const status = document.getElementById('home-assessment-status');
        if (status) {
          status.textContent = 'Active assessment deleted.';
          status.className = 'sync-message info';
          status.hidden = false;
        }
        if (typeof updateTotalRecords === 'function') updateTotalRecords();
        updateHomeAssessmentPrompt();
        document.getElementById('tab-home').click();
      } catch (error) {
        const status = document.getElementById('home-assessment-status');
        if (status) {
          status.textContent = `Could not delete the active assessment: ${error.message}`;
          status.className = 'sync-message error';
          status.hidden = false;
        }
      }
    });
    deleteActiveAssessmentButton.dataset.bound = 'true';
  }

  const continueActiveAssessmentButton = document.getElementById('continue-active-assessment');
  if (continueActiveAssessmentButton && !continueActiveAssessmentButton.dataset.bound) {
    continueActiveAssessmentButton.addEventListener('click', () => {
      const activeAssessment = typeof window.getIncompleteAssessment === 'function'
        ? window.getIncompleteAssessment()
        : null;
      if (activeAssessment && !activeAssessment.marketInfo) {
        marketWizardTargetAssessmentId = activeAssessment.id;
        marketWizardStep = 0;
        applyMarketInfoToWizard(activeAssessment.marketInfo || readStoredJson(marketDraftKey(), {}));
        renderMarketWizardStep();
        document.getElementById('market-wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      document.getElementById('tab-assessment').click();
    });
    continueActiveAssessmentButton.dataset.bound = 'true';
  }

  const sendCompletedAssessmentButton = document.getElementById('send-completed-assessment');
  if (sendCompletedAssessmentButton && !sendCompletedAssessmentButton.dataset.bound) {
    sendCompletedAssessmentButton.addEventListener('click', async () => {
      if (typeof window.syncAssessments !== 'function') return;

      const status = document.getElementById('home-assessment-status');
      sendCompletedAssessmentButton.disabled = true;
      try {
        const result = await window.syncAssessments();
        if (status) {
          const uploadedCount = result.uploaded ? result.uploaded.length : 0;
          const failedCount = result.failed ? result.failed.length : 0;
          let message = result.message || 'No completed assessments to sync.';
          if (uploadedCount > 0 && failedCount > 0) {
            message = `Synced ${uploadedCount} assessment${uploadedCount > 1 ? 's' : ''}; ${failedCount} failed to sync.`;
          } else if (uploadedCount > 0) {
            message = `Successfully synced ${uploadedCount} assessment${uploadedCount > 1 ? 's' : ''}.`;
          } else if (failedCount > 0) {
            message = `Could not sync ${failedCount} assessment${failedCount > 1 ? 's' : ''}.`;
          }
          status.textContent = message;
          status.className = `sync-message ${result.success ? 'success' : 'error'}`;
          status.hidden = false;
        }
      } catch (error) {
        if (status) {
          status.textContent = `Could not sync assessments: ${error.message}`;
          status.className = 'sync-message error';
          status.hidden = false;
        }
      } finally {
        sendCompletedAssessmentButton.disabled = false;
        updateHomeAssessmentPrompt();
      }
    });
    sendCompletedAssessmentButton.dataset.bound = 'true';
  }

  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    const initialToken = getToken();
    AuthAPI.getMe()
      .then(() => {
        if (getToken() === initialToken) {
          return Promise.all([refreshQuestionSetFromServer(), refreshSharedMarkets()]);
        }
      })
      .catch((error) => {
        if (getToken() !== initialToken) return;
        if (error.status === 401 || error.status === 403) {
          clearToken();
          refreshSharedMarkets();
          applyMarketInfoToWizard(readStoredJson(marketDraftKey(), {}));
        } else {
          console.warn('Could not refresh account; using locally stored profile:', error);
        }
      })
      .finally(updateAuthUI);
  } else {
    updateAuthUI();
    refreshSharedMarkets();
  }
}

window.updateAuthUI = updateAuthUI;

//////////////////// GLOBAL SETUP ////////////////////
(function(){
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function activateTab(tab){
    // deactivate others
    tabs.forEach(t=>{
      t.setAttribute('aria-selected','false');
      t.setAttribute('tabindex','-1');
    });
    panels.forEach(p=>{ p.hidden = true; p.classList.add('hidden'); });

    // activate chosen
    tab.setAttribute('aria-selected','true');
    tab.setAttribute('tabindex','0');
    const id = tab.getAttribute('aria-controls');
    const panel = document.getElementById(id);
    if(panel){ panel.hidden = false; panel.classList.remove('hidden'); }
    if (tab.id === 'tab-home') updateHomeAssessmentPrompt();
    tab.focus();
  }

  window.openFrontendLoginScreen = function() {
    const homeTab = document.getElementById('tab-home');
    const loginSection = document.getElementById('frontend-login-section');
    const emailField = document.getElementById('auth-email');

    if (homeTab) {
      activateTab(homeTab);
    }

    if (loginSection && typeof loginSection.scrollIntoView === 'function') {
      loginSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (emailField) {
      emailField.focus();
    }
  };

  tabs.forEach((tab, idx)=>{
    tab.addEventListener('click', ()=> {
      // Start fresh assessment when clicking Assessment tab
      if(tab.id === 'tab-assessment' && typeof startNewAssessment === 'function') {
        const shouldStartAssessment = tab.dataset.startNewAssessment === 'true'
          || !document.getElementById('upload-screen');
        delete tab.dataset.startNewAssessment;
        if (shouldStartAssessment) startNewAssessment();
      }
      if(tab.id === 'tab-reports' && typeof window.refreshReports === 'function') {
        window.refreshReports();
      }
      activateTab(tab);
    });

    // Disabled keyboard navigation for now so we can get the slider working properly. slider uses the same keys.
    // tab.addEventListener('keydown', (e)=>{
    //   const key = e.key;
    //   let newIdx = null;
    //   if(key === 'ArrowRight' || key === 'ArrowDown') newIdx = (idx + 1) % tabs.length;
    //   if(key === 'ArrowLeft' || key === 'ArrowUp') newIdx = (idx - 1 + tabs.length) % tabs.length;
    //   if(key === 'Home') newIdx = 0;
    //   if(key === 'End') newIdx = tabs.length -1;
    //   if(newIdx !== null){
    //     e.preventDefault();
    //     activateTab(tabs[newIdx]);
    //   }
    //   if(key === 'Enter' || key === ' '){
    //     e.preventDefault();
    //     activateTab(tab);
    //   }
    // });    
  });

  // set current year in footer
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = y;

  // Update total records count in export panel
  updateTotalRecords();

  // Initialize account controls
  initializeMarketWizard();
  localStorage.removeItem('contactInfo');
  initAuthControls();
})();
