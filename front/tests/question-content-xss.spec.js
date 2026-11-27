import { test, expect } from '@playwright/test';

const injectedMarkup = '<img data-xss="question-content">';

test('renders cached question text and report categories as text, not markup', async ({ page }) => {
  await page.addInitScript((markup) => {
    localStorage.setItem('question_set_version', '77');
    localStorage.setItem('question_set_data', JSON.stringify({
      categories: [markup],
      indicators: [[{
        name: markup,
        scores: [markup, 'Second', 'Third', 'Fourth'],
        notesLabel: markup
      }]]
    }));
  }, injectedMarkup);

  await page.goto('/');
  const assessmentTab = page.locator('#tab-assessment');
  await assessmentTab.evaluate((element) => element.removeAttribute('disabled'));
  await assessmentTab.click();

  await expect(page.locator('.category-indicator')).toHaveText(injectedMarkup);
  await expect(page.locator('.indicator-label')).toHaveText(injectedMarkup);
  await expect(page.locator('.score-description').first()).toHaveText(injectedMarkup);
  await expect(page.locator('#question-container img')).toHaveCount(0);

  await page.locator('#tab-reports').click();
  await expect(page.locator('#reports-scoretable tbody img')).toHaveCount(0);
  await expect(page.locator('#reports-scoretable tbody tr td').first()).toHaveText(injectedMarkup);
});
