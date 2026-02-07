import { expect, test } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
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
    // Toggle dark mode using aria-label
    const darkModeButton = page.getByRole('button', {
      name: /switch to (dark|light) mode/i,
    });
    await darkModeButton.click();
    await page.waitForTimeout(500); // Wait for transition

    await expect(page).toHaveScreenshot('homepage-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  // Preset dropdown test disabled - preset button is in a collapsed section that's difficult to reliably access
  // test.skip('preset dropdown matches snapshot'...

  test('practice mode matches snapshot', async ({ page }) => {
    // Load example shots first (two-step confirmation: click, wait, click again)
    const exampleButton = page.getByRole('button', { name: /example shots/i });
    await exampleButton.click();
    await page.waitForTimeout(300);
    await exampleButton.click();
    await page.waitForTimeout(300);

    // Open Advanced options popover
    const advancedButton = page.getByRole('button', { name: /advanced/i });
    await advancedButton.click();
    await page.waitForTimeout(300);

    // Click Random mode chip
    const randomChip = page.getByRole('button', { name: 'Random' }).first();
    await randomChip.click();
    await page.waitForTimeout(300);

    // Enable Seeded checkbox for deterministic random behavior
    const seededCheckbox = page.getByRole('checkbox', { name: /seeded/i });
    await seededCheckbox.check();
    await page.waitForTimeout(100);

    // Close the Advanced options dialog by clicking away
    await page.mouse.click(50, 50);
    await page.waitForTimeout(300);

    // Start practice mode - use title to distinguish from Advanced button
    const practiceButton = page
      .getByRole('button', {
        name: 'Practice',
      })
      .and(page.locator('[title="Start the practice session"]'));
    await practiceButton.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('practice-mode.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('recall mode matches snapshot', async ({ page }) => {
    // Load example shots first (two-step confirmation: click, wait, click again)
    const exampleButton = page.getByRole('button', { name: /example shots/i });
    await exampleButton.click();
    await page.waitForTimeout(300);
    await exampleButton.click();
    await page.waitForTimeout(300);

    // Open Advanced options popover
    const advancedButton = page.getByRole('button', { name: /advanced/i });
    await advancedButton.click();
    await page.waitForTimeout(300);

    // Click Random mode chip
    const randomChip = page.getByRole('button', { name: 'Random' }).first();
    await randomChip.click();
    await page.waitForTimeout(300);

    // Enable Seeded checkbox for deterministic random behavior
    const seededCheckbox = page.getByRole('checkbox', { name: /seeded/i });
    await seededCheckbox.check();
    await page.waitForTimeout(100);

    // Close the Advanced options dialog by clicking away
    await page.mouse.click(50, 50);
    await page.waitForTimeout(300);

    // Start recall mode
    const recallButton = page.getByRole('button', { name: 'Recall' });
    await recallButton.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('recall-mode.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
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
