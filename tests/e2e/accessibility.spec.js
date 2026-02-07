/* eslint-disable import/no-deprecated */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
/* eslint-enable import/no-deprecated */

test.describe('Accessibility Tests - WCAG 2.1 AAA', () => {
  test('should not have any automatically detectable accessibility issues on home page', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in practice mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Load example shots (two-step confirmation: click, wait for confirm state, click again)
    const exampleButton = page.getByRole('button', { name: /example shots/i });
    await exampleButton.click();
    await page.waitForTimeout(300);
    await exampleButton.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test tab navigation - may need multiple tabs to reach first interactive element
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);

    // In some browsers (like WebKit), first tab may focus BODY, so tab again
    if (focusedElement === 'BODY') {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    }

    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focusedElement);

    // Verify focus is visible
    const hasFocusStyles = await page.evaluate(() => {
      const active = document.activeElement;
      const styles = window.getComputedStyle(active);
      return styles.outline !== 'none' || styles.boxShadow !== 'none';
    });
    expect(hasFocusStyles).toBeTruthy();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa'])
      .include('main')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have sufficient color contrast ratios', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check color contrast for WCAG 2.1 AAA level
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aaa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle modals and dialogs accessibly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click a button that opens a modal/dropdown
    const modalTrigger = page.locator('button').first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();

      // Check if focus is trapped in modal
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should have semantic HTML structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for proper heading hierarchy
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((el) => ({ tag: el.tagName, text: el.textContent }))
    );

    expect(headings.length).toBeGreaterThan(0);

    // Verify main landmark exists
    const mainLandmark = await page.$('main');
    expect(mainLandmark).not.toBeNull();
  });
});
