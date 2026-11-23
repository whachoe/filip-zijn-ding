import { test, expect } from '@playwright/test';

for (const width of [320, 360, 393, 412, 430]) {
  test(`navigation remains on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const tabs = page.locator('.tabs [role="tab"]');
    await expect(tabs).toHaveCount(4);
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('.tabs');
      const buttons = Array.from(nav.querySelectorAll('[role="tab"]'));
      const rectangles = buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
      });
      return {
        rectangles,
        navRight: nav.getBoundingClientRect().right,
        navWidth: nav.clientWidth,
        scrollWidth: nav.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });
    expect(new Set(geometry.rectangles.map((rect) => rect.top)).size).toBe(1);
    expect(geometry.rectangles.every((rect) => rect.height >= 44)).toBe(true);
    expect(geometry.documentWidth).toBe(geometry.viewportWidth);
    if (width >= 393) {
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.navWidth);
      expect(geometry.rectangles[3].right).toBeLessThanOrEqual(geometry.navRight);
    }
    await page.getByRole('tab', { name: 'Export' }).click();
    await expect(page.locator('#panel-export')).toBeVisible();
    await page.getByRole('tab', { name: 'Reports' }).click();
    await expect(page.locator('#panel-reports')).toBeVisible();
  });
}
