import { expect, test } from '@playwright/test';

// Skip visual regression tests in CI - they're fragile and slow
// Run locally with: npm run test:e2e:visual or npm run test:e2e:visual:update
test.describe('Visual Regression Tests', () => {
  test.skip(
    Boolean(process.env.CI),
    'Visual regression tests skipped in CI - run locally to update snapshots'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('homepage matches snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('setup screen matches snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('setup-screen.png', {
      animations: 'disabled',
    });
  });

  test('dark mode matches snapshot', async ({ page }) => {
    // Toggle dark mode
    const darkModeButton = page
      .locator('button')
      .filter({ hasText: /dark|light/i })
      .first();
    await darkModeButton.click();
    await page.waitForTimeout(500); // Wait for transition

    await expect(page).toHaveScreenshot('homepage-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('preset dropdown matches snapshot', async ({ page }) => {
    // Click preset button to open dropdown
    const presetButton = page.getByRole('button', { name: /preset|table/i });
    await presetButton.click();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('preset-dropdown.png', {
      animations: 'disabled',
    });
  });

  test('practice mode matches snapshot', async ({ page }) => {
    // Load example shots first
    const exampleButton = page.getByRole('button', { name: /example|load/i });
    await exampleButton.click();
    await page.waitForTimeout(300);

    // Start practice mode
    const practiceButton = page.getByRole('button', { name: /practice|start/i }).first();
    await practiceButton.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('practice-mode.png', {
      animations: 'disabled',
    });
  });

  test('recall mode matches snapshot', async ({ page }) => {
    // Load example shots first
    const exampleButton = page.getByRole('button', { name: /example|load/i });
    await exampleButton.click();
    await page.waitForTimeout(300);

    // Start recall mode
    const recallButton = page.getByRole('button', { name: /recall|test/i }).first();
    await recallButton.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('recall-mode.png', {
      animations: 'disabled',
    });
  });

  test('mobile viewport matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('mobile-view.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('tablet viewport matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('tablet-view.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('desktop viewport matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('desktop-view.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
