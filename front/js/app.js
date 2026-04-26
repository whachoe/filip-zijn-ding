function save_settings() {
    // Check if all 3 fields in the form are filled in and if so: enable the "New Assessment" tab
    const fullName = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email-address').value.trim();
    const location = document.getElementById('location').value;

    const assessmentTab = document.getElementById('tab-assessment');
    const assessmentButton = document.getElementById('button-assessment');
    assessmentButton.removeAttribute('hidden');

    // Save contact info
    localStorage.setItem('contactInfo', JSON.stringify({
        fullName: fullName,
        email: email,
        location: location
    }));

    if(fullName !== '' && email !== '' && location !== '') {
        assessmentTab.removeAttribute('disabled');
        u(assessmentButton).removeClass('hidden');
        assessmentButton.removeAttribute('disabled');
    } else {
        assessmentTab.setAttribute('disabled', 'disabled');
        u(assessmentButton).addClass('hidden');
    }
}

function callNTimes(func, num, delay) {
    if (!num) return;
    func();
    setTimeout(function() { callNTimes(func, num - 1, delay); }, delay);
}

function generateRandomDate(from, to) {
  return new Date(
    from.getTime() +
      Math.random() * (to.getTime() - from.getTime()),
  );
}

function updateTotalRecords() {
  const totalRecordsEl = document.getElementById('total_records');
  if(totalRecordsEl) {
      const records = JSON.parse(localStorage.getItem('assessment_list') || '[]');
      totalRecordsEl.textContent = records.length;
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
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');

  if (user) {
    setAuthStatus(`Logged in as ${user.username}`, 'success');
    if (loginButton) loginButton.disabled = false;
    if (logoutButton) {
      logoutButton.hidden = false;
      logoutButton.removeAttribute('hidden');
      logoutButton.classList.remove('hidden');
    }
  } else {
    setAuthStatus('Not logged in.', 'info');
    if (logoutButton) {
      logoutButton.hidden = true;
      logoutButton.setAttribute('hidden', 'hidden');
      logoutButton.classList.add('hidden');
    }
  }

  if (typeof updateSyncStatus === 'function') {
    updateSyncStatus();
  }
}

async function handleLogin() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!username || !password) {
    setAuthStatus('Enter username and password to log in.', 'warning');
    return;
  }

  try {
    await AuthAPI.login(username, password);
    await refreshQuestionSetFromServer();
    updateAuthUI();
    setAuthStatus(`Welcome back, ${username}.`, 'success');
  } catch (error) {
    setAuthStatus(error.message || 'Login failed.', 'error');
  }
}

async function handleLogout() {
  try {
    await AuthAPI.logout();
    updateAuthUI();
    setAuthStatus('You have been logged out.', 'info');
  } catch (error) {
    setAuthStatus(error.message || 'Logout failed.', 'error');
  }
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

  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    AuthAPI.getMe()
      .then(refreshQuestionSetFromServer)
      .catch(() => clearToken())
      .finally(updateAuthUI);
  } else {
    updateAuthUI();
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
    tab.focus();
  }

  tabs.forEach((tab, idx)=>{
    tab.addEventListener('click', ()=> {
      // Start fresh assessment when clicking Assessment tab
      if(tab.id === 'tab-assessment' && typeof startNewAssessment === 'function') {
        startNewAssessment();
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

  // Make the assessment button activate the assessment tab
  document.getElementById('button-assessment').addEventListener('click', () => document.getElementById('tab-assessment').click());

  // Fill in the contact info form if data exists in localStorage
  const contactInfo = localStorage.getItem('contactInfo');
  if(contactInfo) {
      const info = JSON.parse(contactInfo);
      // console.log("Loading contactinfo from localstorage", info);
      document.getElementById('full-name').value = info.fullName || '';
      document.getElementById('email-address').value = info.email || '';
      document.getElementById('location').value = info.location || '';

      // Check if all 3 fields in the form are filled in and if so: enable the "New Assessment" tab
      save_settings();
  }

  // set current year in footer
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = y;

  // Update total records count in export panel
  updateTotalRecords();

  // Initialize account controls
  initAuthControls();
})();

