import { test, expect } from '@playwright/test';
import path from 'node:path';

const adminDir = path.resolve(__dirname, '../../back/admin');

test('admin publishes per-question notes labels and the frontend uses them online and offline', async ({ page }) => {
  const user = { id: 7, email: 'admin@example.com', firstName: 'Admin', role: 'admin' };
  let latest = {
    id: 1,
    version: 1,
    categories: ['Category'],
    indicators: [[
      { name: 'First question', scores: ['One', 'Two', 'Three', 'Four'] },
      { name: 'Second question', scores: ['One', 'Two', 'Three', 'Four'] }
    ]]
  };
  let questionsOffline = false;
  await page.route('**/admin-test', (route) => route.fulfill({ path: path.join(adminDir, 'index.html'), contentType: 'text/html' }));
  await page.route('**/admin-assets/*', (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ path: path.join(adminDir, filename) });
  });
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/assessments/markets', (route) => route.fulfill({ json: { markets: [] } }));
  await page.route('**/api/admin/questions', (route) => {
    if (route.request().method() === 'POST') {
      latest = { id: 2, version: 2, ...route.request().postDataJSON() };
      return route.fulfill({ status: 201, json: { questionSet: latest } });
    }
    return route.fulfill({ json: { questionSets: [latest] } });
  });
  await page.route('**/api/questions/latest', (route) => questionsOffline
    ? route.abort('failed')
    : route.fulfill({ json: { questionSet: latest } }));
  await page.addInitScript((currentUser) => {
    localStorage.setItem('jwt_token', 'test-token');
    localStorage.setItem('current_user', JSON.stringify(currentUser));
  }, user);

  await page.goto('/admin-test#question-editor');
  const labels = page.locator('#admin-question-editor .notes-label');
  await expect(labels).toHaveCount(2);
  await expect(labels.first()).toHaveValue('');
  const customLabel = 'Describe <b>specific</b> observations about the market, including any relevant details or circumstances. '.repeat(5).trim();
  await labels.first().fill(customLabel);
  await labels.nth(1).fill('   ');
  await page.locator('[data-action="add-indicator"]').click();
  await expect(labels.first()).toHaveValue(customLabel);
  await page.locator('[data-action="remove-indicator"]').last().click();
  await expect(labels).toHaveCount(2);
  await page.locator('#admin-save-version-button').click();
  await expect(page.locator('#admin-message')).toContainText('Published version 2');
  expect(latest.indicators[0].map((indicator) => indicator.notesLabel)).toEqual([customLabel, '']);
  await expect(labels.first()).toHaveValue(customLabel);

  await page.evaluate(() => {
    localStorage.removeItem('question_set_data');
    localStorage.removeItem('question_set_version');
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.getCurrentQuestionSet().version)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.getCurrentQuestionSet().indicators[0][0].notesLabel)).toBe(customLabel);
  await page.locator('#market-name').fill('Test market');
  await page.locator('#market-wizard-next').click();
  await page.locator('#market-country').fill('Belgium');
  await page.locator('#market-setting').selectOption("Don't know");
  await page.locator('#market-wizard-next').click();
  await page.locator('#start-market-assessment').click();
  const noteLabel = page.locator('label[for="question-notes"]');
  const noteInput = page.locator('#question-notes');
  await expect(noteLabel).toHaveText('Add notes (optional)');
  await expect(noteInput).toHaveAttribute('placeholder', customLabel);
  await expect(noteLabel.locator('b')).toHaveCount(0);
  await noteInput.focus();
  await expect.poll(() => noteLabel.evaluate((label) => label.clientHeight >= label.scrollHeight)).toBe(true);
  await noteInput.fill('Saved observation');
  await page.locator('#next-btn').click();
  await expect(noteLabel).toHaveText('Add notes (optional)');
  await expect(noteInput).toHaveAttribute('placeholder', 'Notes (optional)');
  await page.locator('#prev-btn').click();
  await expect(noteLabel).toHaveText('Add notes (optional)');
  await expect(noteInput).toHaveAttribute('placeholder', customLabel);
  await expect(noteInput).toHaveValue('Saved observation');
  questionsOffline = true;
  await page.reload();
  await expect(noteLabel).toHaveText('Add notes (optional)');
  await expect(noteInput).toHaveAttribute('placeholder', customLabel);
  await expect(noteInput).toHaveValue('Saved observation');
});
