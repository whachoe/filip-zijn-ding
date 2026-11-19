import { test, expect } from '@playwright/test';

const mockUser = {
  id: 7,
  username: 'frontend-user',
  email: 'tester@example.com',
  firstName: 'Frontend',
  lastName: 'Tester',
  location: 'Utrecht',
  role: 'user',
  createdAt: '2026-05-02T08:00:00.000Z'
};

function buildAssessmentDefinitions() {
  return [
    {
      id: 'assessment_20260501_090000',
      created: '2026-05-01T09:00:00.000Z',
      scoreValue: '2',
      synced: true,
      syncedAt: '2026-05-01T09:05:00.000Z'
    },
    {
      id: 'assessment_20260501_100000',
      created: '2026-05-01T10:00:00.000Z',
      scoreValue: '3',
      synced: true,
      syncedAt: '2026-05-01T10:05:00.000Z'
    },
    {
      id: 'assessment_20260501_110000',
      created: '2026-05-01T11:00:00.000Z',
      scoreValue: '4',
      synced: true,
      syncedAt: '2026-05-01T11:05:00.000Z'
    }
  ];
}

async function installApiMocks(page, options = {}) {
  const serverState = {
    healthOk: options.healthOk !== false,
    syncRequests: [],
    mediaRequests: [],
    events: [],
    markets: options.markets || []
  };

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: serverState.healthOk ? 200 : 503,
      contentType: 'application/json',
      body: JSON.stringify({ ok: serverState.healthOk })
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    const payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'playwright-token',
        user: {
          ...mockUser,
          id: payload.email === 'other@example.com' ? 8 : mockUser.id,
          email: payload.email
        }
      })
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    if (options.authOffline) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockUser })
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  await page.route('**/api/assessments/markets', async (route) => {
    if (options.marketsOffline) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ markets: serverState.markets })
    });
  });

  await page.route('**/api/assessments', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const requestBody = route.request().postDataJSON();
      const assessments = Array.isArray(requestBody) ? requestBody : [requestBody];
      serverState.events.push('sync');
      serverState.syncRequests.push(...assessments);
      const marketAssignments = assessments.filter((assessment) => assessment.marketInfo).map((assessment, index) => {
        const market = {
          id: assessment.marketInfo.marketId || 50 + index,
          marketName: assessment.marketInfo.marketName,
          localName: assessment.marketInfo.localName,
          country: assessment.marketInfo.country,
          provinceState: assessment.marketInfo.provinceState,
          district: assessment.marketInfo.district,
          cityTownVillage: assessment.marketInfo.cityTownVillage
        };
        return {
          assessmentId: assessment.id,
          marketId: market.id,
          assessmentSequence: assessment.marketInfo.assessmentSequence || index + 1,
          market
        };
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, uploaded: assessments.map((assessment) => assessment.id), marketAssignments })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assessments: [] })
    });
  });

  await page.route('**/api/media', async (route) => {
    serverState.events.push('media');
    serverState.mediaRequests.push(route.request().postData() || '');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ media: { id: 8, filename: 'evidence.jpg', url: '/uploads/evidence.jpg' } })
    });
  });

  return serverState;
}

async function completeMarketWizard(page, options = {}) {
  await page.locator('#market-name').fill(options.marketName || 'Test Market');
  if (options.localName) await page.locator('#market-local-name').fill(options.localName);
  await page.locator('#market-wizard-next').click();

  await page.locator('#market-country').fill(options.country || 'Netherlands');
  if (options.provinceState) await page.locator('#market-province-state').fill(options.provinceState);
  if (options.district) await page.locator('#market-district').fill(options.district);
  if (options.cityTownVillage) await page.locator('#market-city-town-village').fill(options.cityTownVillage);
  await page.locator('#market-setting').selectOption(options.setting || "Don't know");
  if (options.settingOther) await page.locator('#market-setting-other').fill(options.settingOther);
  await page.locator('#market-wizard-next').click();

  if (await page.locator('#lead-assessor-name').isEditable()) {
    await page.locator('#lead-assessor-name').fill(options.leadAssessorName || 'Offline Assessor');
  }
  if (options.generalNotes) await page.locator('#market-general-notes').fill(options.generalNotes);
  await page.locator('#start-market-assessment').click();
  await expect(page.locator('#question-container')).toBeVisible();
}

async function login(page) {
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.locator('#login-button').click();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
}

async function finishAssessmentAtUploadScreen(page, marketName = 'Upload Test Market') {
  await completeMarketWizard(page, { marketName });
  const questionCount = await page.evaluate(() => window.getCurrentQuestionSet()
    .indicators.reduce((total, category) => total + category.length, 0));
  for (let i = 1; i < questionCount; i++) await page.locator('#next-btn').click();
  await page.locator('#finish-btn').click();
  await expect(page.locator('#upload-screen')).toBeVisible();
}

async function mockLatestQuestionSet(page) {
  const questionSet = await page.evaluate(() => window.getCurrentQuestionSet());
  await page.route('**/api/questions/latest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ questionSet })
    });
  });
}

async function seedPendingAssessmentBeforeLoad(page) {
  await page.addInitScript(() => {
    const id = 'assessment_20260501_120000';
    localStorage.setItem(id, JSON.stringify({
      id,
      contactInfo: {
        fullName: 'Pending Person',
        email: 'pending@example.com',
        location: 'Leiden'
      },
      scores: {
        'indicator[0][0]': '2'
      },
      created: '2026-05-01T12:00:00.000Z',
      synced: false,
      version: 1,
      progress: {
        currentQuestionIndex: 0,
        totalQuestions: 1,
        completed: true,
        completedAt: '2026-05-01T12:00:00.000Z',
        lastUpdated: '2026-05-01T12:00:00.000Z'
      },
      mediaAttachments: [],
      notes: ''
    }));
    localStorage.setItem('assessment_list', JSON.stringify([id]));
  });
}

async function seedHomeAssessmentsBeforeLoad(page, includeCompletedPending = false) {
  await page.addInitScript((includeCompleted) => {
    const activeId = 'assessment_20260501_120000';
    const activeAssessment = {
      id: activeId,
      marketInfo: {
        marketName: 'Active Market',
        country: 'Netherlands',
        assessmentSequence: 1,
        leadAssessor: { userId: 7, name: 'Frontend Tester', email: 'tester@example.com' }
      },
      scores: {
        'indicator[0][0]': '3'
      },
      created: '2026-05-01T12:00:00.000Z',
      synced: false,
      version: 1,
      progress: {
        currentQuestionIndex: 1,
        totalQuestions: 1,
        completed: false,
        lastUpdated: '2026-05-01T12:00:00.000Z'
      },
      mediaAttachments: [],
      notes: ''
    };
    localStorage.setItem(activeId, JSON.stringify(activeAssessment));

    const assessmentIds = [];
    if (includeCompleted) {
      const completedId = 'assessment_20260501_110000';
      localStorage.setItem(completedId, JSON.stringify({
        ...activeAssessment,
        id: completedId,
        progress: {
          ...activeAssessment.progress,
          completed: true,
          completedAt: '2026-05-01T11:00:00.000Z'
        }
      }));
      assessmentIds.push(completedId);
    }

    localStorage.setItem('assessment_list', JSON.stringify(assessmentIds));
  }, includeCompletedPending);
}

async function seedAssessments(page, definitions) {
  await page.evaluate((items) => {
    const questionSet = window.getCurrentQuestionSet();
    const buildScores = (scoreValue) => {
      const scores = {};
      questionSet.indicators.forEach((category, categoryIndex) => {
        category.forEach((indicator, indicatorIndex) => {
          scores[`indicator[${categoryIndex}][${indicatorIndex}]`] = String(scoreValue);
        });
      });
      return scores;
    };

    items.forEach((item) => {
      localStorage.setItem(item.id, JSON.stringify({
        id: item.id,
        contactInfo: {
          fullName: 'Report User',
          email: 'reports@example.com',
          location: 'Rotterdam'
        },
        scores: buildScores(item.scoreValue),
        created: item.created,
        synced: item.synced,
        syncedAt: item.syncedAt,
        version: questionSet.version,
        progress: {
          currentQuestionIndex: questionSet.indicators.reduce((total, category) => total + category.length, 0) - 1,
          totalQuestions: questionSet.indicators.reduce((total, category) => total + category.length, 0),
          completed: true,
          completedAt: item.created,
          lastUpdated: item.created
        },
        mediaAttachments: [],
        notes: ''
      }));
    });

    localStorage.setItem('assessment_list', JSON.stringify(items.map((item) => item.id)));

    if (typeof window.updateTotalRecords === 'function') {
      window.updateTotalRecords();
    }

    if (typeof window.refreshQuestionnaire === 'function') {
      window.refreshQuestionnaire();
    }
  }, definitions);
}

async function promoteDraftToCompletedAssessment(page) {
  return page.evaluate(() => {
    const questionSet = window.getCurrentQuestionSet();
    const assessmentId = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    const assessment = JSON.parse(localStorage.getItem(assessmentId));
    const totalQuestions = questionSet.indicators.reduce((total, category) => total + category.length, 0);

    questionSet.indicators.forEach((category, categoryIndex) => {
      category.forEach((indicator, indicatorIndex) => {
        const fieldName = `indicator[${categoryIndex}][${indicatorIndex}]`;
        if (!assessment.scores[fieldName]) {
          assessment.scores[fieldName] = '4';
        }
      });
    });

    assessment.progress.currentQuestionIndex = totalQuestions - 1;
    assessment.progress.totalQuestions = totalQuestions;
    assessment.progress.completed = true;
    assessment.progress.completedAt = new Date().toISOString();
    assessment.progress.lastUpdated = new Date().toISOString();
    assessment.created = new Date().toISOString();
    assessment.synced = false;
    assessment.version = questionSet.version;

    localStorage.setItem(assessmentId, JSON.stringify(assessment));

    const assessmentList = JSON.parse(localStorage.getItem('assessment_list') || '[]');
    if (!assessmentList.includes(assessmentId)) {
      assessmentList.push(assessmentId);
      localStorage.setItem('assessment_list', JSON.stringify(assessmentList));
    }

    if (typeof window.updateTotalRecords === 'function') {
      window.updateTotalRecords();
    }

    return assessmentId;
  });
}

test('shows server offline and pending sync state correctly', async ({ page }) => {
  const server = await installApiMocks(page, { healthOk: false });
  await seedPendingAssessmentBeforeLoad(page);
  await page.goto('/');

  await page.getByRole('tab', { name: 'Export' }).click();
  await expect(page.locator('#sync-status-text')).toHaveText('1 assessment pending sync');
  await expect(page.locator('#sync-button')).toHaveText('Server Offline');
  await expect(page.locator('#sync-icon')).toHaveAttribute('title', 'Server offline');

  server.healthOk = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  await expect(page.locator('#sync-button')).toHaveText('Login required');
  await expect(page.locator('#sync-icon')).toHaveAttribute('title', '1 assessment(s) pending sync');
});

test('logs in, saves an assessment draft, syncs it, and keeps synced state after reload', async ({ page }) => {
  const server = await installApiMocks(page);
  await page.goto('/');
  await mockLatestQuestionSet(page);
  await expect(page.locator('#frontend-login-section')).toBeVisible();
  await expect(page.locator('#frontend-welcome-section')).toBeHidden();

  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('#auth-status')).toContainText(`Welcome back, ${mockUser.email}.`);
  await expect(page.locator('#frontend-login-section')).toBeHidden();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();

  await expect(page.locator('#lead-assessor-name')).toHaveValue('Frontend Tester');
  await completeMarketWizard(page, {
    marketName: 'QA Market',
    country: 'Netherlands',
    cityTownVillage: 'Test Lab'
  });
  await expect(page.locator('#progress-text')).toHaveText(/Question 1 of/);
  await expect(page.locator('#question-container')).toBeVisible();

  await page.locator('.score-label').first().click();

  const savedDraft = await page.evaluate(() => {
    const assessmentId = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    return JSON.parse(localStorage.getItem(assessmentId));
  });

  expect(savedDraft.marketInfo.marketName).toBe('QA Market');
  expect(savedDraft.marketInfo.cityTownVillage).toBe('Test Lab');
  expect(savedDraft.marketInfo.leadAssessor).toEqual({
    userId: mockUser.id,
    name: 'Frontend Tester',
    email: mockUser.email
  });
  expect(savedDraft.contactInfo).toBeUndefined();
  expect(savedDraft.scores['indicator[0][0]']).toBe('1');
  expect(savedDraft.synced).toBe(false);

  const assessmentId = await promoteDraftToCompletedAssessment(page);
  await page.getByRole('tab', { name: 'Export' }).click();

  await expect(page.locator('#sync-button')).toHaveText('Send to Server (1)');
  await page.locator('#sync-button').click();

  await expect.poll(() => server.syncRequests.length).toBe(1);
  expect(server.syncRequests[0].id).toBe(assessmentId);
  await expect(page.locator('#sync-message')).toContainText('Successfully synced 1 assessment');
  await expect(page.locator('#sync-button')).toHaveText('All Synced');

  const syncedAssessment = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), assessmentId);
  expect(syncedAssessment.synced).toBe(true);
  expect(syncedAssessment.syncedAt).toBeTruthy();
  expect(syncedAssessment.marketInfo.marketId).toBe(50);
  expect(syncedAssessment.marketInfo.marketName).toBe('QA Market');
  expect(syncedAssessment.marketInfo.assessmentSequence).toBe(1);
  expect(syncedAssessment.marketInfo.id).toBeUndefined();

  await page.reload();
  await expect(page.locator('#sync-button')).toHaveText('All Synced');

  const reloadedAssessment = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), assessmentId);
  expect(reloadedAssessment.synced).toBe(true);
});

test('Home switches between login and welcome on login, reload, and logout', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await expect(page.locator('#frontend-login-section')).toBeVisible();
  await expect(page.locator('#frontend-welcome-section')).toBeHidden();
  await login(page);
  await expect(page.locator('#frontend-login-section')).toBeHidden();
  await page.reload();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
  await expect(page.locator('#frontend-login-section')).toBeHidden();
  await page.locator('#logout-button').click();
  await expect(page.locator('#frontend-login-section')).toBeVisible();
  await expect(page.locator('#frontend-welcome-section')).toBeHidden();
  await page.reload();
  await expect(page.locator('#frontend-login-section')).toBeVisible();
  await expect(page.locator('#frontend-welcome-section')).toBeHidden();
});

test('Home offers to continue or delete an active assessment after login', async ({ page }) => {
  await installApiMocks(page);
  await seedHomeAssessmentsBeforeLoad(page);
  await page.goto('/');

  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  const prompt = page.locator('#home-active-assessment');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('You still have an active assessment.');
  expect(await prompt.evaluate((element) => element.parentElement.id)).toBe('frontend-welcome-section');
  expect(await prompt.evaluate((element) => element.previousElementSibling.id)).toBe('market-wizard');
  await expect(page.locator('#send-completed-assessment')).toBeHidden();

  await page.locator('#continue-active-assessment').click();
  await expect(page.getByRole('tab', { name: 'Assessment' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#progress-text')).toHaveText(/Question 2 of/);

  await page.getByRole('tab', { name: 'Home' }).click();
  await page.locator('#delete-active-assessment').click();
  await expect(prompt).toBeHidden();
  const deletedAssessment = await page.evaluate(() => ({
    assessment: localStorage.getItem('assessment_20260501_120000'),
    contactInfo: localStorage.getItem('contactInfo')
  }));
  expect(deletedAssessment.assessment).toBeNull();
  expect(deletedAssessment.contactInfo).toBeNull();
});

test('Home sends a completed pending assessment when sync is available', async ({ page }) => {
  const server = await installApiMocks(page);
  await seedHomeAssessmentsBeforeLoad(page, true);
  await page.goto('/');

  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  const sendButton = page.locator('#send-completed-assessment');
  await expect(page.locator('#home-active-assessment')).toBeVisible();
  await expect(sendButton).toBeVisible();
  await sendButton.click();

  await expect.poll(() => server.syncRequests.length).toBe(1);
  expect(server.syncRequests[0].id).toBe('assessment_20260501_110000');
  await expect(page.locator('#home-assessment-status')).toContainText('Successfully synced 1 assessment.');
  await expect(sendButton).toBeHidden();
  const assessments = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem('assessment_20260501_120000')),
    completed: JSON.parse(localStorage.getItem('assessment_20260501_110000'))
  }));
  expect(assessments.active.progress.completed).toBe(false);
  expect(assessments.completed.synced).toBe(true);
});

test('Home hides the send action when the server is offline', async ({ page }) => {
  await installApiMocks(page, { healthOk: false });
  await seedHomeAssessmentsBeforeLoad(page, true);
  await page.goto('/');

  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('#home-active-assessment')).toBeVisible();
  await expect(page.locator('#send-completed-assessment')).toBeHidden();
});

test('market wizard works offline and saves market information with the assessment', async ({ page }) => {
  await installApiMocks(page, { healthOk: false, authOffline: true, marketsOffline: true });
  await page.addInitScript((user) => {
    localStorage.setItem('jwt_token', 'offline-token');
    localStorage.setItem('current_user', JSON.stringify(user));
  }, mockUser);
  await page.goto('/');
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();

  await completeMarketWizard(page, {
    marketName: 'Offline Market',
    localName: 'Local Name',
    country: 'Uganda',
    provinceState: 'Central',
    district: 'Kampala',
    cityTownVillage: 'Kampala',
    setting: 'Other',
    settingOther: 'Urban/peri-urban edge',
    generalNotes: 'Main activity is livestock trading.'
  });
  await page.locator('.score-label').first().click();

  const saved = await page.evaluate(() => {
    const id = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    return {
      assessment: JSON.parse(localStorage.getItem(id)),
      globalContactInfo: localStorage.getItem('contactInfo')
    };
  });
  expect(saved.assessment.marketInfo).toMatchObject({
    marketId: null,
    marketName: 'Offline Market',
    localName: 'Local Name',
    country: 'Uganda',
    provinceState: 'Central',
    district: 'Kampala',
    cityTownVillage: 'Kampala',
    setting: 'Other',
    settingOther: 'Urban/peri-urban edge',
    assessmentSequence: 1,
    generalNotes: 'Main activity is livestock trading.',
    leadAssessor: { userId: mockUser.id, name: 'Frontend Tester', email: mockUser.email }
  });
  expect(saved.assessment.contactInfo).toBeUndefined();
  expect(saved.globalContactInfo).toBeNull();
});

test('market wizard requires a setting but accepts an explicit unknown choice', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await login(page);

  await expect(page.locator('[data-market-step="0"]')).toBeVisible();
  await expect(page.locator('[data-market-step="1"]')).toBeHidden();
  await expect(page.locator('[data-market-step="2"]')).toBeHidden();

  await page.locator('#market-name').fill('Setting Validation Market');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('[data-market-step="0"]')).toBeHidden();
  await expect(page.locator('[data-market-step="1"]')).toBeVisible();
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#market-wizard-status')).toContainText('Select a market setting');
  await expect(page.locator('#market-wizard-step-label')).toHaveText('Step 2 of 3');

  await page.locator('#market-setting').selectOption("Don't know");
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#market-wizard-step-label')).toHaveText('Step 3 of 3');
});

test('market wizard selects shared markets and previews the next repeat number', async ({ page }) => {
  await installApiMocks(page, {
    markets: [{
      id: 21,
      marketName: 'Central Market',
      localName: 'Old Town Market',
      country: 'Uganda',
      provinceState: 'Central',
      district: 'Kampala',
      cityTownVillage: 'Kampala',
      setting: 'Other',
      settingOther: 'Urban edge',
      latitude: '0.3',
      longitude: '32.5',
      otherAssessors: [{ name: 'Previous assessor', organization: 'Health unit' }],
      generalNotes: 'Previous market details',
      assessmentCount: 2
    }]
  });
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.locator('#market-select').selectOption('21');
  await expect(page.locator('#market-name')).toHaveValue('Central Market');
  await expect(page.locator('#market-name')).toHaveAttribute('readonly', '');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#market-country')).toHaveValue('Uganda');
  await expect(page.locator('#market-province-state')).toHaveValue('Central');
  await expect(page.locator('#market-district')).toHaveValue('Kampala');
  await expect(page.locator('#market-city-town-village')).toHaveValue('Kampala');
  await expect(page.locator('#market-setting')).toHaveValue('Other');
  await expect(page.locator('#market-setting-other')).toBeVisible();
  await expect(page.locator('#market-setting-other')).toHaveValue('Urban edge');
  await expect(page.locator('#market-latitude')).toHaveValue('0.3');
  await expect(page.locator('#market-longitude')).toHaveValue('32.5');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#assessment-sequence')).toHaveText('Assessment sequence: Repeat 2');
  await expect(page.locator('#lead-assessor-name')).toHaveValue('Frontend Tester');
  await expect(page.locator('[name="otherAssessorName"]').first()).toHaveValue('Previous assessor');
  await expect(page.locator('[name="otherAssessorOrganization"]').first()).toHaveValue('Health unit');
  await expect(page.locator('#market-general-notes')).toHaveValue('Previous market details');
  await page.locator('#market-general-notes').fill('Updated for this visit');
  await page.locator('#start-market-assessment').click();
  await page.locator('.score-label').first().click();

  const marketInfo = await page.evaluate(() => {
    const id = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    return JSON.parse(localStorage.getItem(id)).marketInfo;
  });
  expect(marketInfo.marketId).toBe(21);
  expect(marketInfo.assessmentSequence).toBe(3);
  expect(marketInfo.leadAssessor.userId).toBe(mockUser.id);
  expect(marketInfo.generalNotes).toBe('Updated for this visit');
});

test('cached markets prefill all available details offline and switching markets clears stale details', async ({ page }) => {
  await installApiMocks(page, { healthOk: false, marketsOffline: true });
  await page.addInitScript(() => {
    localStorage.setItem('jwt_token', 'offline-token');
    localStorage.setItem('current_user', JSON.stringify({ id: 7, email: 'tester@example.com' }));
    localStorage.setItem('market_cache_7', JSON.stringify([{
      id: 21, marketName: 'Cached Market', localName: 'Local name',
      country: 'Uganda', provinceState: 'Central', district: 'Kampala', cityTownVillage: 'Kampala',
      setting: 'Peri-urban', latitude: 0.3, longitude: 32.5,
      otherAssessors: [{ name: 'First', organization: 'Clinic' }, { name: 'Second', organization: 'Council' }],
      generalNotes: 'Cached notes', assessmentCount: 2
    }, {
      id: 22, marketName: 'Other Market', country: 'Kenya',
      setting: 'Small town', assessmentCount: 1
    }]));
  });
  await page.goto('/');
  await page.locator('#market-select').selectOption('21');
  await page.reload();
  await expect(page.locator('#market-select')).toHaveValue('21');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#market-setting')).toHaveValue('Peri-urban');
  await expect(page.locator('#market-latitude')).toHaveValue('0.3');
  await expect(page.locator('#market-longitude')).toHaveValue('32.5');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('[name="otherAssessorName"]')).toHaveCount(2);
  await expect(page.locator('[name="otherAssessorName"]').nth(1)).toHaveValue('Second');
  await expect(page.locator('#market-general-notes')).toHaveValue('Cached notes');
  await page.locator('#market-wizard-previous').click();
  await page.locator('#market-wizard-previous').click();
  await page.locator('#market-select').selectOption('22');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('#market-setting')).toHaveValue('Small town');
  await expect(page.locator('#market-latitude')).toHaveValue('');
  await page.locator('#market-wizard-next').click();
  await expect(page.locator('[name="otherAssessorName"]')).toHaveCount(1);
  await expect(page.locator('[name="otherAssessorName"]').first()).toHaveValue('');
  await expect(page.locator('#market-general-notes')).toHaveValue('');
});

test('market cache and wizard drafts are isolated across user accounts', async ({ page }) => {
  await installApiMocks(page, { marketsOffline: true });
  await page.addInitScript(() => {
    localStorage.setItem('market_cache', JSON.stringify([{ id: 99, marketName: 'Legacy shared market' }]));
    localStorage.setItem('market_cache_7', JSON.stringify([{ id: 21, marketName: 'Private market' }]));
    localStorage.setItem('market_wizard_draft_7', JSON.stringify({ marketId: 21, marketName: 'Private market', generalNotes: 'Private notes' }));
    localStorage.setItem('market_cache_8', JSON.stringify([{ id: 22, marketName: 'Other market' }]));
  });
  await page.goto('/');
  await expect(page.locator('#market-select option')).toHaveCount(1);
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.locator('#login-button').click();
  await expect(page.locator('#market-select')).toHaveValue('21');
  await expect(page.locator('#market-name')).toHaveValue('Private market');
  await page.locator('#logout-button').click();
  await expect(page.locator('#market-select option')).toHaveCount(1);
  await expect(page.locator('#market-name')).toHaveValue('');
  await page.locator('#auth-email').fill('other@example.com');
  await page.locator('#auth-password').fill('password123');
  await page.locator('#login-button').click();
  await expect(page.locator('#market-select option')).toHaveCount(2);
  await expect(page.locator('#market-select option').nth(1)).toContainText('Other market');
  await expect(page.locator('#market-name')).toHaveValue('');
});

test('retains the signed-in user and their market cache when account refresh is offline', async ({ page }) => {
  await installApiMocks(page, { healthOk: false, authOffline: true, marketsOffline: true });
  await page.addInitScript(() => {
    localStorage.setItem('jwt_token', 'offline-token');
    localStorage.setItem('current_user', JSON.stringify({ id: 7, email: 'tester@example.com' }));
    localStorage.setItem('market_cache_7', JSON.stringify([{ id: 21, marketName: 'Cached private market' }]));
  });
  await page.goto('/');
  await expect(page.locator('#market-select option').nth(1)).toContainText('Cached private market');
  await expect(page.locator('#logout-button')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('jwt_token'))).toBe('offline-token');
});

test('preserves an anonymous market wizard draft when signing in', async ({ page }) => {
  await installApiMocks(page, { marketsOffline: true });
  await page.addInitScript(() => {
    localStorage.setItem('market_wizard_draft_offline', JSON.stringify({ marketName: 'Offline draft' }));
  });
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.locator('#login-button').click();
  await expect(page.locator('#market-name')).toHaveValue('Offline draft');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('market_wizard_draft_7')).marketName)).toBe('Offline draft');
  expect(await page.evaluate(() => localStorage.getItem('market_wizard_draft_offline'))).toBeNull();
});

test('a sync response cannot cache market details under a different account', async ({ page }) => {
  await installApiMocks(page, { marketsOffline: true });
  let releaseResponse;
  const waitForResponse = new Promise((resolve) => { releaseResponse = resolve; });
  let requestReceived;
  const received = new Promise((resolve) => { requestReceived = resolve; });
  await page.route('**/api/assessments', async (route) => {
    requestReceived();
    await waitForResponse;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        uploaded: ['assessment_race'],
        marketAssignments: [{
          assessmentId: 'assessment_race', marketId: 21, assessmentSequence: 1,
          market: { id: 21, marketName: 'First user market' }
        }]
      })
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('jwt_token', 'user-7');
    localStorage.setItem('current_user', JSON.stringify({ id: 7, email: 'tester@example.com' }));
    localStorage.setItem('assessment_race', JSON.stringify({
      id: 'assessment_race', scores: {}, synced: false,
      progress: { completed: true }, marketInfo: { marketName: 'First user market' }
    }));
    localStorage.setItem('assessment_list', JSON.stringify(['assessment_race']));
  });
  await page.goto('/');
  await page.evaluate(() => { window.raceSync = window.syncAssessments(['assessment_race']); });
  await received;
  await page.evaluate(() => {
    localStorage.setItem('jwt_token', 'user-8');
    localStorage.setItem('current_user', JSON.stringify({ id: 8, email: 'other@example.com' }));
  });
  releaseResponse();
  await page.evaluate(() => window.raceSync);
  expect(await page.evaluate(() => localStorage.getItem('market_cache_8'))).toBeNull();
  const ownerCache = await page.evaluate(() => JSON.parse(localStorage.getItem('market_cache_7')));
  expect(ownerCache[0].marketName).toBe('First user market');
});

test('allows selecting and deselecting the same assessment score', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await login(page);

  await completeMarketWizard(page, { marketName: 'Toggle Market' });
  await expect(page.locator('#question-container')).toBeVisible();

  const firstScoreLabel = page.locator('.score-label').first();
  await firstScoreLabel.click();

  await expect(page.locator('.score-radio').first()).toBeChecked();

  let savedScore = await page.evaluate(() => {
    const assessmentId = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    const assessment = JSON.parse(localStorage.getItem(assessmentId));
    return assessment.scores['indicator[0][0]'];
  });
  expect(savedScore).toBe('1');

  await firstScoreLabel.click();
  await expect(page.locator('.score-radio').first()).not.toBeChecked();

  savedScore = await page.evaluate(() => {
    const assessmentId = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    const assessment = JSON.parse(localStorage.getItem(assessmentId));
    return assessment.scores['indicator[0][0]'];
  });
  expect(savedScore).toBeUndefined();
});

test('offers Not applicable as the final question option and restores it', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
  await completeMarketWizard(page, { marketName: 'N/A Market', country: 'Belgium' });

  const options = page.locator('.score-option');
  const lastOption = options.last();
  await expect(lastOption.locator('.score-description')).toHaveText('Not applicable');
  await expect(lastOption.locator('input')).toHaveAttribute('value', 'na');
  await lastOption.locator('label').click();
  await expect(lastOption.locator('input')).toBeChecked();
  const assessmentId = await page.evaluate(() => {
    const id = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    return { id, score: JSON.parse(localStorage.getItem(id)).scores['indicator[0][0]'] };
  });
  expect(assessmentId.score).toBe('na');

  await page.locator('#next-btn').click();
  await page.locator('#prev-btn').click();
  await expect(page.locator('.score-option').last().locator('input')).toBeChecked();
});

test('excludes Not applicable from category score and confidence', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, [{
    id: 'assessment_20260501_090000',
    created: '2026-05-01T09:00:00.000Z',
    scoreValue: '2',
    synced: true
  }]);

  const categoryQuestionCount = await page.evaluate(() => {
    const questionSet = window.getCurrentQuestionSet();
    const assessmentId = JSON.parse(localStorage.getItem('assessment_list'))[0];
    const assessment = JSON.parse(localStorage.getItem(assessmentId));
    const categorySize = questionSet.indicators[0].length;
    assessment.scores['indicator[0][0]'] = '4';
    assessment.scores['indicator[0][1]'] = 'na';
    assessment.scores['indicator[0][2]'] = '';
    questionSet.indicators[1].forEach((_, index) => {
      assessment.scores[`indicator[1][${index}]`] = 'na';
    });
    localStorage.setItem(assessmentId, JSON.stringify(assessment));
    window.refreshQuestionnaire();
    return categorySize;
  });

  await page.getByRole('tab', { name: 'Reports' }).click();
  const scoreTotal = 4 + (categoryQuestionCount - 3) * 2;
  const answeredCount = categoryQuestionCount - 2;
  const applicableCount = categoryQuestionCount - 1;
  const expectedPercentage = Math.round((scoreTotal * 100) / (4 * answeredCount));
  const expectedConfidence = Math.round((answeredCount * 100) / applicableCount);
  await expect(page.locator('#reports-scoretable tbody tr').nth(0).locator('td').nth(1))
    .toHaveText(`${expectedPercentage}% (${expectedConfidence}%)`);
  await expect(page.locator('#reports-scoretable tbody tr').nth(1).locator('td').nth(1))
    .toHaveText('0% (0%)');
  const radarValues = await page.evaluate(() => window.Chart.getChart('radar-graph').data.datasets[0].data);
  expect(radarValues[0]).toBe(expectedPercentage);
  expect(radarValues[1]).toBe(0);
});

test('reports the newest in-progress assessment even before it is added to the completed list', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, [{
    id: 'assessment_20261116_100000',
    created: '2026-11-16T10:00:00.000Z',
    scoreValue: '4',
    synced: true
  }]);

  await page.evaluate(() => {
    const id = 'assessment_20261117_171719';
    const scores = {
      'indicator[0][0]': '2',
      'indicator[0][1]': 'na',
      'indicator[0][2]': '2',
      'indicator[0][3]': '4',
      'indicator[0][4]': '1',
      'indicator[0][5]': '4',
      'indicator[1][0]': '2',
      'indicator[1][1]': '3',
      'indicator[1][2]': '1',
      'indicator[1][3]': '4',
      'indicator[1][4]': '2',
      'indicator[1][5]': '4',
      'indicator[2][0]': '1',
      'indicator[2][1]': '3',
      'indicator[2][2]': '3',
      'indicator[2][3]': '4',
      'indicator[2][4]': '1',
      'indicator[2][5]': '3',
      'indicator[3][0]': '4',
      'indicator[3][1]': 'na',
      'indicator[3][2]': '1',
      'indicator[3][3]': '3',
      'indicator[3][4]': '4',
      'indicator[4][0]': '1',
      'indicator[4][1]': '3',
      'indicator[4][2]': '4',
      'indicator[4][3]': '2',
      'indicator[4][4]': '1',
      'indicator[4][5]': '3',
      'indicator[5][0]': '4',
      'indicator[5][1]': '1',
      'indicator[5][2]': '2',
      'indicator[5][3]': '3',
      'indicator[5][4]': '1',
      'indicator[6][0]': '4',
      'indicator[6][1]': '1',
      'indicator[6][2]': '3',
      'indicator[6][3]': '4',
      'indicator[6][4]': '1',
      'indicator[7][0]': '2',
      'indicator[7][1]': '4',
      'indicator[7][2]': '3',
      'indicator[7][4]': '1',
      'indicator[8][0]': '4',
      'indicator[8][2]': '1',
      'indicator[8][3]': '4'
    };
    localStorage.setItem(id, JSON.stringify({
      id,
      created: '2026-11-17T16:17:29.126Z',
      scores,
      progress: { currentQuestionIndex: 47, totalQuestions: 49, lastUpdated: '2026-11-17T16:20:25.992Z' },
      synced: false,
      version: 3
    }));
  });

  await page.getByRole('tab', { name: 'Reports' }).click();
  const rows = page.locator('#reports-scoretable tbody tr');
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('65% (100%)');
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText('67% (100%)');
  await expect(rows.nth(7).locator('td').nth(1)).toHaveText('63% (80%)');
  await expect(rows.nth(8).locator('td').nth(1)).toHaveText('75% (60%)');
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText('100% (100%)');
});

test('preserves question notes through navigation and saves final assessment notes', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
  await completeMarketWizard(page, { marketName: 'Notes Market', country: 'Belgium' });
  const questionNotes = page.getByRole('textbox', { name: 'Notes (optional)' });
  const label = page.locator('label[for="question-notes"]');
  await expect(label).toHaveCSS('opacity', '0');
  const collapsedHeight = (await questionNotes.boundingBox()).height;
  await questionNotes.focus();
  await expect(questionNotes).toHaveCSS('outline-style', 'none');
  await expect(questionNotes).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(label).toHaveCSS('opacity', '1');
  await expect.poll(async () => (await questionNotes.boundingBox()).height).toBeGreaterThan(collapsedHeight + 20);
  await questionNotes.fill('First question observation');
  await page.locator('#next-btn').focus();
  await expect(label).toHaveCSS('opacity', '0');
  await expect.poll(async () => (await questionNotes.boundingBox()).height).toBeLessThan(collapsedHeight + 1);
  await expect(questionNotes).toHaveValue('First question observation');
  await page.locator('.score-label').first().click();
  await page.locator('.score-label').first().click();
  await page.locator('#next-btn').click();
  await page.locator('#question-notes').fill('Second question observation');
  await page.locator('#prev-btn').click();
  await expect(page.locator('#question-notes')).toHaveValue('First question observation');

  const questionCount = await page.evaluate(() => window.getCurrentQuestionSet().indicators.reduce((n, category) => n + category.length, 0));
  for (let i = 1; i < questionCount; i++) await page.locator('#next-btn').click();
  await page.locator('#finish-btn').click();
  await page.locator('#assessment-notes').fill('Final assessment notes');
  const assessment = await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('assessment_list'))[0];
    return JSON.parse(localStorage.getItem(id));
  });
  expect(assessment.notes).toBe('Final assessment notes');
  expect(assessment.questionNotes['indicator[0][0]']).toBe('First question observation');
  expect(assessment.questionNotes['indicator[0][1]']).toBe('Second question observation');
  expect(assessment.scores['indicator[0][0]']).toBeUndefined();
  expect(assessment.synced).toBe(false);
});

test('syncs this assessment before uploading selected files', async ({ page }) => {
  const server = await installApiMocks(page);
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.locator('#login-button').click();
  await finishAssessmentAtUploadScreen(page, 'Media Sync Market');

  await page.locator('#upload-file-input').setInputFiles({
    name: 'evidence.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('evidence')
  });
  await page.locator('#upload-btn').click();
  await expect(page.locator('#upload-status')).toContainText('1 file(s) uploaded');

  expect(server.events).toEqual(['sync', 'media']);
  expect(server.syncRequests).toHaveLength(1);
  expect(server.mediaRequests[0]).toContain(server.syncRequests[0].id);
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), server.syncRequests[0].id);
  expect(saved.synced).toBe(true);
  expect(saved.mediaAttachments).toHaveLength(1);
});

test('keeps the Assessment tab available to return to the supporting-media screen', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await login(page);
  await finishAssessmentAtUploadScreen(page, 'Tab Access Market');

  await page.getByRole('tab', { name: 'Reports' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  const assessmentTab = page.getByRole('tab', { name: 'Assessment' });
  await expect(assessmentTab).toBeEnabled();
  await assessmentTab.click();

  await expect(page.locator('#panel-assessment')).toBeVisible();
  await expect(page.locator('#upload-screen')).toBeVisible();

  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('assessment_list')).at(-1);
    const assessment = JSON.parse(localStorage.getItem(id));
    delete assessment.mediaUploadPending;
    localStorage.setItem(id, JSON.stringify(assessment));
  });
  await page.reload();

  const reloadedAssessmentTab = page.getByRole('tab', { name: 'Assessment' });
  await expect(reloadedAssessmentTab).toBeEnabled();
  await reloadedAssessmentTab.click();
  await expect(page.locator('#upload-screen')).toBeVisible();
});

test('renders reports, exports XLSX, and deletes all assessments', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, buildAssessmentDefinitions());

  await page.getByRole('tab', { name: 'Reports' }).click();
  await expect(page.locator('#reports-scoretable tbody tr')).toHaveCount(9);

  const firstReportRow = page.locator('#reports-scoretable tbody tr').first();
  await expect(firstReportRow).toContainText('100% (100%)');
  await expect(firstReportRow).toContainText('75% (100%)');
  await expect(firstReportRow).toContainText('50% (100%)');
  await expect(page.locator('#radar-graph')).toBeVisible();
  await expect(page.locator('#bar-graph')).toBeVisible();

  await page.getByRole('tab', { name: 'Export' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-xlsx-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mmt_assessments.xlsx');
  expect(await download.failure()).toBeNull();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#delete-assessments-button').click();

  await expect(page.locator('#total_records')).toHaveText('0');
  const storageState = await page.evaluate(() => ({
    itemCount: localStorage.length,
    assessmentList: localStorage.getItem('assessment_list')
  }));

  expect(storageState.itemCount).toBe(0);
  expect(storageState.assessmentList).toBeNull();
});

test('radar chart displays fixed 10% circular intervals for low scores and after reopening reports', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, [{
    id: 'assessment_20260501_090000',
    created: '2026-05-01T09:00:00.000Z',
    scoreValue: '1',
    synced: true
  }]);

  const checkScale = async () => {
    await expect.poll(() => page.evaluate(() => {
      const chart = window.Chart.getChart('radar-graph');
      return chart ? chart.scales.r.ticks.length : 0;
    })).toBe(11);
    const scale = await page.evaluate(() => {
      const chart = window.Chart.getChart('radar-graph');
      const radial = chart.scales.r;
      return {
        min: radial.min,
        max: radial.max,
        circular: radial.options.grid.circular,
        gridColor: radial.options.grid.color,
        gridLayer: radial.options.grid.z,
        pointLabelColor: radial.options.pointLabels.color,
        tickColor: radial.options.ticks.color,
        values: radial.ticks.map((tick) => tick.value),
        labels: radial.ticks.map((tick) => tick.label),
        scores: chart.data.datasets[0].data,
        fills: chart.data.datasets.map((dataset) => dataset.backgroundColor)
      };
    });
    expect(scale.min).toBe(0);
    expect(scale.max).toBe(100);
    expect(scale.circular).toBe(true);
    expect(scale.gridColor).toBe('#768797');
    expect(scale.gridLayer).toBe(1);
    expect(scale.pointLabelColor).toBe('#23364a');
    expect(scale.tickColor).toBe('#23364a');
    expect(scale.values).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(scale.labels).toEqual(scale.values.map((value) => `${value}%`));
    expect(scale.scores.every((score) => score === 25)).toBe(true);
    expect(scale.fills.every((fill) => fill.startsWith('rgba('))).toBe(true);
  };

  await page.getByRole('tab', { name: 'Reports' }).click();
  await checkScale();
  const ringDifferences = await page.evaluate(() => {
    const chart = window.Chart.getChart('radar-graph');
    const radial = chart.scales.r;
    const ctx = chart.ctx;
    const ratio = chart.currentDevicePixelRatio;
    chart.stop();
    chart.options.animation = false;
    chart.update('none');
    const withGrid = ctx.getImageData(0, 0, chart.canvas.width, chart.canvas.height).data;
    chart.options.scales.r.grid.display = false;
    chart.update('none');
    const withoutGrid = ctx.getImageData(0, 0, chart.canvas.width, chart.canvas.height).data;
    const differences = [];
    for (let value = 10; value <= 100; value += 10) {
      const radius = radial.getDistanceFromCenterForValue(value);
      let strongestDifference = 0;
      for (let angle = 0.1; angle < Math.PI * 2; angle += 0.1) {
        const x = Math.round((radial.xCenter + Math.cos(angle) * radius) * ratio);
        const y = Math.round((radial.yCenter + Math.sin(angle) * radius) * ratio);
        const index = (y * chart.canvas.width + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          strongestDifference = Math.max(strongestDifference, Math.abs(withGrid[index + channel] - withoutGrid[index + channel]));
        }
      }
      differences.push(strongestDifference);
    }
    chart.options.scales.r.grid.display = true;
    chart.update('none');
    return { differences, width: chart.canvas.width, height: chart.canvas.height, ratio, x: radial.xCenter, y: radial.yCenter, radius: radial.drawingArea };
  });
  expect(ringDifferences.differences).toHaveLength(10);
  expect(ringDifferences.differences.every((difference) => difference >= 50), `Ring pixel differences: ${JSON.stringify(ringDifferences)}`).toBe(true);
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('tab', { name: 'Reports' }).click();
  await checkScale();
});

test('report graphs use a readable palette on light backgrounds', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, buildAssessmentDefinitions());
  await page.getByRole('tab', { name: 'Reports' }).click();
  await expect.poll(() => page.evaluate(() => {
    const chart = window.Chart.getChart('bar-graph');
    return chart ? chart.scales.x.ticks.length : 0;
  })).toBeGreaterThan(0);

  const styles = await page.evaluate(() => {
    const radar = window.Chart.getChart('radar-graph');
    const bar = window.Chart.getChart('bar-graph');
    return {
      backgrounds: [radar, bar].map((chart) => getComputedStyle(chart.canvas).backgroundColor),
      radarText: [radar.scales.r.options.ticks.color, radar.scales.r.options.pointLabels.color, radar.options.plugins.legend.labels.color],
      barText: [bar.scales.x.options.ticks.color, bar.scales.y.options.ticks.color],
      grids: [radar.scales.r.options.grid.color, radar.scales.r.options.angleLines.color, bar.scales.x.options.grid.color, bar.scales.y.options.grid.color],
      radarSeries: radar.data.datasets.map((dataset) => dataset.borderColor),
      barSeries: bar.data.datasets.map((dataset) => dataset.backgroundColor)
    };
  });
  const contrastWithWhite = (hex) => {
    const rgb = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255);
    const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return 1.05 / (luminance + 0.05);
  };
  expect(styles.backgrounds).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
  expect(styles.radarSeries).toEqual(styles.barSeries);
  expect(new Set(styles.radarSeries).size).toBe(3);
  for (const color of [...styles.radarText, ...styles.barText]) {
    expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(4.5);
  }
  for (const color of [...styles.grids, ...styles.radarSeries]) {
    expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(3);
  }
});

test('mobile reports use compact cards, scrollable scores, and readable charts', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installApiMocks(page);
  await page.goto('/');
  await seedAssessments(page, buildAssessmentDefinitions());
  await page.getByRole('tab', { name: 'Reports' }).click();

  await expect(page.getByRole('heading', { name: 'Assessment scores' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Category overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score comparison' })).toBeVisible();
  await expect(page.locator('.report-bar-legend li')).toHaveText(['Current', 'Previous 1', 'Previous 2']);
  await expect.poll(() => page.evaluate(() => window.Chart.getChart('bar-graph')?.scales.y.ticks.length)).toBe(9);

  for (const width of [320, 375, 639]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(() => page.evaluate(() => {
      const chart = window.Chart.getChart('radar-graph');
      return chart && Math.round(chart.width) === Math.round(chart.canvas.parentElement.clientWidth);
    })).toBe(true);

    const layout = await page.evaluate(() => {
      const table = document.querySelector('.report-table-scroll');
      const radar = window.Chart.getChart('radar-graph');
      const bar = window.Chart.getChart('bar-graph');
      return {
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        tableWidth: table.clientWidth,
        tableScrollWidth: table.scrollWidth,
        radarHeight: radar.height,
        barHeight: bar.height,
        radarLabels: radar.scales.r._pointLabels,
        barLabels: bar.scales.y.ticks.map((tick) => tick.label),
        barValues: bar.scales.x.ticks.map((tick) => tick.label),
        backgrounds: [radar, bar].map((chart) => getComputedStyle(chart.canvas).backgroundColor),
        legendColors: [...document.querySelectorAll('.report-legend-swatch')].map((element) => getComputedStyle(element).backgroundColor),
        barColors: bar.data.datasets.map((dataset) => dataset.backgroundColor)
      };
    });
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.tableScrollWidth).toBeGreaterThan(layout.tableWidth);
    expect(layout.radarHeight).toBe(330);
    expect(layout.barHeight).toBe(390);
    expect(layout.radarLabels).toEqual(Array.from({ length: 9 }, (_, i) => `Category ${i + 1}`));
    expect(layout.barLabels).toEqual(Array.from({ length: 9 }, (_, i) => `Category ${i + 1}`));
    expect(layout.barValues).toContain('100');
    expect(layout.backgrounds).toEqual(['rgb(245, 246, 241)', 'rgb(245, 246, 241)']);
    expect(layout.legendColors).toEqual(layout.barColors.map((hex) => {
      const rgb = hex.slice(1).match(/../g).map((value) => parseInt(value, 16));
      return `rgb(${rgb.join(', ')})`;
    }));
  }

  const table = page.locator('.report-table-scroll');
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 900, height: 812 });
  await expect(page.getByRole('heading', { name: 'Assessment scores' })).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const radar = window.Chart.getChart('radar-graph');
    return radar ? radar.scales.r._pointLabels[0].length : 0;
  })).toBeGreaterThan('Category 1'.length);
  const desktop = await page.evaluate(() => {
    const radar = window.Chart.getChart('radar-graph');
    const bar = window.Chart.getChart('bar-graph');
    return {
      firstRadarLabel: radar.scales.r._pointLabels[0],
      firstBarLabel: bar.scales.y.ticks[0].label,
      radarRatio: radar.width / radar.height,
      barRatio: bar.width / bar.height,
      backgrounds: [radar, bar].map((chart) => getComputedStyle(chart.canvas).backgroundColor)
    };
  });
  expect(desktop.firstRadarLabel.length).toBeGreaterThan('Category 1'.length);
  expect(desktop.firstBarLabel).toBe(desktop.firstRadarLabel);
  expect(desktop.radarRatio).toBeCloseTo(1, 1);
  expect(desktop.barRatio).toBeCloseTo(2, 1);
  expect(desktop.backgrounds).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
});
