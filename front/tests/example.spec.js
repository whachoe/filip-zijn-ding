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
    syncRequests: []
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
          email: payload.email
        }
      })
    });
  });

  await page.route('**/api/auth/me', async (route) => {
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

  await page.route('**/api/assessments', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      serverState.syncRequests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assessments: [] })
    });
  });

  return serverState;
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

  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('#auth-status')).toContainText(`Welcome back, ${mockUser.email}.`);
  await expect(page.locator('#frontend-login-section')).toBeHidden();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();

  await expect(page.getByLabel('Full Name')).toHaveValue('Frontend Tester');
  await expect(page.getByLabel('Email Address')).toHaveValue(mockUser.email);
  await expect(page.getByLabel('Location')).toHaveValue(mockUser.location);

  await page.getByLabel('Full Name').fill('QA Runner');
  await page.getByLabel('Location').fill('Test Lab');
  await page.getByRole('tab', { name: 'Assessment' }).click();
  await expect(page.locator('#progress-text')).toHaveText(/Question 1 of/);
  await expect(page.locator('#question-container')).toBeVisible();

  await page.locator('.score-label').first().click();

  const savedDraft = await page.evaluate(() => {
    const assessmentId = Object.keys(localStorage).find((key) => key.startsWith('assessment_'));
    return JSON.parse(localStorage.getItem(assessmentId));
  });

  expect(savedDraft.contactInfo.fullName).toBe('QA Runner');
  expect(savedDraft.contactInfo.email).toBe(mockUser.email);
  expect(savedDraft.contactInfo.location).toBe('Test Lab');
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

  await page.reload();
  await expect(page.locator('#sync-button')).toHaveText('All Synced');

  const reloadedAssessment = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), assessmentId);
  expect(reloadedAssessment.synced).toBe(true);
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
