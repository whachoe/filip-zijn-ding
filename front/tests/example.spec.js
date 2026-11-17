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
        body: JSON.stringify({ success: true, uploaded: [route.request().postDataJSON().id] })
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

async function seedHomeAssessmentsBeforeLoad(page, includeCompletedPending = false) {
  await page.addInitScript((includeCompleted) => {
    const activeId = 'assessment_20260501_120000';
    const activeAssessment = {
      id: activeId,
      contactInfo: {
        fullName: 'Active Person',
        email: 'active@example.com',
        location: 'Leiden'
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
  await expect(page.locator('#button-assessment')).toHaveCount(0);
  expect(await prompt.evaluate((element) => element.parentElement.id)).toBe('frontend-welcome-section');
  expect(await prompt.evaluate((element) => element.previousElementSibling.id)).toBe('settings-form');
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
  expect(deletedAssessment.contactInfo).not.toBeNull();
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

test('allows selecting and deselecting the same assessment score', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');

  await page.getByLabel('Full Name').fill('Toggle Tester');
  await page.getByLabel('Email Address').fill('toggle@example.com');
  await page.getByLabel('Location').fill('Lab');

  await page.getByRole('tab', { name: 'Assessment' }).click();
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
  await page.getByLabel('Full Name').fill('N/A Tester');
  await page.getByLabel('Email Address').fill(mockUser.email);
  await page.getByLabel('Location').fill('Market');
  await page.getByRole('tab', { name: 'Assessment' }).click();

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

test('preserves question notes through navigation and saves final assessment notes', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await page.locator('#auth-email').fill(mockUser.email);
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
  await page.getByLabel('Full Name').fill('Notes Tester');
  await page.getByLabel('Email Address').fill('notes@example.com');
  await page.getByLabel('Location').fill('Market');
  await page.getByRole('tab', { name: 'Assessment' }).click();
  const questionNotes = page.getByRole('textbox', { name: 'Notes (optional)' });
  const label = page.locator('label[for="question-notes"]');
  await expect(label).toHaveCSS('opacity', '0');
  const collapsedHeight = (await questionNotes.boundingBox()).height;
  await questionNotes.focus();
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
