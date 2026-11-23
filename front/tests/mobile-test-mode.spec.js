import { test, expect } from '@playwright/test';

const user = { id: 7, email: 'tester@example.com', firstName: 'Test', lastName: 'User' };
const questionSet = {
  version: 3,
  categories: ['Test category'],
  indicators: [[1, 2, 3, 4, 5].map((n) => ({
    name: `Question ${n}`, scores: ['One', 'Two', 'Three', 'Four']
  }))]
};

async function setup(page, options = {}) {
  const state = { capability: options.enabled ? 'enabled' : 'disabled', synced: [] };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/test-mode', (route) => {
    if (state.capability === 'offline') return route.abort('failed');
    return route.fulfill({ status: state.capability === 'enabled' ? 200 : 404, json: { enabled: state.capability === 'enabled' } });
  });
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user } }));
  await page.route('**/api/questions/latest', (route) => route.fulfill({ json: { questionSet } }));
  await page.route('**/api/assessments/markets', (route) => route.fulfill({ json: { markets: [] } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/assessments', (route) => {
    const assessment = route.request().postDataJSON();
    state.synced.push(assessment);
    return route.fulfill({ json: { uploaded: [assessment.id], marketAssignments: [] } });
  });
  await page.addInitScript(({ currentUser, set }) => {
    localStorage.setItem('jwt_token', 'test-token');
    localStorage.setItem('current_user', JSON.stringify(currentUser));
    localStorage.setItem('question_set_data', JSON.stringify(set));
    localStorage.setItem('question_set_version', String(set.version));
  }, { currentUser: user, set: questionSet });
  return state;
}

async function startAssessment(page) {
  await expect(page.locator('#frontend-welcome-section')).toBeVisible();
  await page.locator('#market-name').fill('Mobile market');
  await page.locator('#market-wizard-next').click();
  await page.locator('#market-country').fill('Belgium');
  await page.locator('#market-setting').selectOption("Don't know");
  await page.locator('#market-wizard-next').click();
  await page.locator('#start-market-assessment').click();
  await expect(page.locator('#question-container')).toBeVisible();
}

test('requires both the URL opt-in and enabled server', async ({ page }) => {
  const state = await setup(page, { enabled: true });
  await page.goto('/');
  await startAssessment(page);
  await expect(page.locator('#mobile-test-fill')).toBeHidden();
  state.capability = 'disabled';
  await page.goto('/?test=1');
  await expect(page.locator('#mobile-test-fill')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('mmt_mobile_test_mode'))).toBeNull();
});

test('sample shortcut preserves data, resumes offline and uses normal finish and sync', async ({ page }) => {
  const state = await setup(page, { enabled: true });
  await page.goto('/?test=1');
  await startAssessment(page);
  await expect(page.locator('#mobile-test-fill')).toBeVisible();
  await page.locator('.score-label').nth(1).click();
  await page.locator('#question-notes').fill('Existing observation');
  const original = await page.evaluate(() => {
    const id = Object.keys(localStorage).find((key) => key.startsWith('assessment_') && key !== 'assessment_list');
    const assessment = JSON.parse(localStorage.getItem(id));
    assessment.questionNotes['indicator[0][1]'] = 'Existing unanswered note';
    localStorage.setItem(id, JSON.stringify(assessment));
    localStorage.setItem('unrelated-data', 'untouched');
    return assessment;
  });
  await page.locator('#mobile-test-fill').click();
  await expect(page.locator('#progress-text')).toHaveText('Question 5 of 5');
  await expect(page.locator('#finish-btn')).toBeVisible();
  const prepared = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), original.id);
  expect(prepared.marketInfo).toEqual(original.marketInfo);
  expect(prepared.created).toBe(original.created);
  expect(prepared.version).toBe(original.version);
  expect(prepared.scores['indicator[0][0]']).toBe('2');
  expect(prepared.questionNotes['indicator[0][0]']).toBe('Existing observation');
  expect(prepared.questionNotes['indicator[0][1]']).toBe('Existing unanswered note');
  expect(Object.values(prepared.scores)).toHaveLength(5);
  expect(Object.values(prepared.scores)).toContain('na');
  expect(Object.values(prepared.scores).every((score) => ['1', '2', '3', '4', 'na'].includes(score))).toBe(true);
  expect(Object.values(prepared.questionNotes)).toContain('Sample observation for testing.');
  expect(prepared.progress.completed).not.toBe(true);
  expect(prepared.synced).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-data'))).toBe('untouched');
  await page.locator('#mobile-test-fill').click();
  const repeated = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), original.id);
  expect(repeated.scores).toEqual(prepared.scores);
  expect(repeated.questionNotes).toEqual(prepared.questionNotes);
  state.capability = 'offline';
  await page.reload();
  await page.getByRole('tab', { name: 'Assessment' }).click();
  await expect(page.locator('#mobile-test-fill')).toBeVisible();
  await expect(page.locator('#progress-text')).toHaveText('Question 5 of 5');
  await page.locator('#finish-btn').click();
  await expect(page.locator('#upload-screen')).toBeVisible();
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.locator('#sync-button').click();
  await expect.poll(() => state.synced.length).toBe(1);
  expect(state.synced[0].id).toBe(original.id);
  expect(state.synced[0].progress.completed).toBe(true);
  expect(state.synced[0].scores).toEqual(prepared.scores);
});

test('reports storage failures without jumping or replacing saved data', async ({ page }) => {
  await setup(page, { enabled: true });
  await page.goto('/?test=1');
  await startAssessment(page);
  await expect(page.locator('#mobile-test-fill')).toBeVisible();
  await page.locator('.score-label').first().click();
  const before = await page.evaluate(() => {
    const id = Object.keys(localStorage).find((key) => key.startsWith('assessment_') && key !== 'assessment_list');
    const value = localStorage.getItem(id);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, data) {
      if (key === id) throw new Error('Storage unavailable');
      return setItem.call(this, key, data);
    };
    return { id, value };
  });
  await page.locator('#mobile-test-fill').click();
  await expect(page.locator('#mobile-test-status')).toContainText('Could not prepare sample answers: Storage unavailable');
  await expect(page.locator('#progress-text')).toHaveText('Question 1 of 5');
  expect(await page.evaluate((id) => localStorage.getItem(id), before.id)).toBe(before.value);
});
