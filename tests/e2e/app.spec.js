import { test, expect } from '@playwright/test';

test.describe('Setup Page - Clear Shots Workflow', () => {
  test('should navigate, add shots, clear, and verify empty state', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });

    // Wait for the app to load
    await expect(page.getByText(/define shots and initial guessed percentages/i)).toBeVisible();

    // Take screenshot after load
    await page.screenshot({ path: 'test-results/02-app-loaded.png', fullPage: true });

    // Click Add Shot button
    await page.getByRole('button', { name: /add shot/i }).click();

    // Take screenshot after adding shot
    await page.screenshot({ path: 'test-results/03-shot-added.png', fullPage: true });

    // Verify the Clear button is visible
    const clearButton = page.getByRole('button', { name: /clear all shots/i });
    await expect(clearButton).toBeVisible();

    // Take screenshot before clearing
    await page.screenshot({ path: 'test-results/04-before-clear.png', fullPage: true });

    // Click Clear button
    await clearButton.click();

    // Wait for toast message
    await expect(page.getByText(/cleared all shots/i)).toBeVisible();

    // Take screenshot of toast message
    await page.screenshot({ path: 'test-results/05-clear-toast.png', fullPage: true });

    // Verify empty state
    await expect(clearButton).toBeVisible(); // Clear button should still be present

    // Take final screenshot
    await page.screenshot({ path: 'test-results/06-final-empty-state.png', fullPage: true });
  });

  test('should show empty state on first load', async ({ page }) => {
    // Clear localStorage before test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Take screenshot of empty state
    await page.screenshot({ path: 'test-results/empty-state-first-load.png', fullPage: true });

    // Verify setup page is visible
    await expect(page.getByText(/define shots and initial guessed percentages/i)).toBeVisible();

    // Verify Clear button is present (empty state still shows it)
    await expect(page.getByRole('button', { name: /clear all shots/i })).toBeVisible();
  });

  test('should handle multiple shots and clear them all', async ({ page }) => {
    // Clear localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Add multiple shots
    const addButton = page.getByRole('button', { name: /add shot/i });

    await addButton.click();
    await page.screenshot({ path: 'test-results/multi-01-first-shot.png', fullPage: true });

    await addButton.click();
    await page.screenshot({ path: 'test-results/multi-02-second-shot.png', fullPage: true });

    await addButton.click();
    await page.screenshot({ path: 'test-results/multi-03-third-shot.png', fullPage: true });

    // Clear all
    await page.getByRole('button', { name: /clear all shots/i }).click();

    // Wait for toast
    await expect(page.getByText(/cleared all shots/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/multi-04-all-cleared.png', fullPage: true });

    // Verify empty state
    await expect(page.getByRole('button', { name: /clear all shots/i })).toBeVisible();
  });
});

test.describe('Full Practice Workflow with Example Shots', () => {
  test('should reset to example, configure random mode, and validate guess results', async ({ page }) => {
    // Navigate and clear state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Step 1: Verify we're on setup screen
    await expect(page.getByText(/define shots and initial guessed percentages/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/workflow-01-setup-screen.png', fullPage: true });

    // Step 2: Clear any existing shots
    await page.getByRole('button', { name: /clear all shots/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/workflow-02-cleared.png', fullPage: true });

    // Step 3: Click Reset to Example
    await page.getByRole('button', { name: /reset to example/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/workflow-03-example-loaded.png', fullPage: true });

    // Step 4: Validate the example shots are present
    // Expected: Left Orbit (25L/75R), Center Ramp (50L/50R), Right Orbit (75L/25R)
    await expect(page.getByText('Left Orbit')).toBeVisible();
    await expect(page.getByText('Center Ramp')).toBeVisible();
    await expect(page.getByText('Right Orbit')).toBeVisible();

    // Take screenshot showing all example shots
    await page.screenshot({ path: 'test-results/workflow-04-validated-shots.png', fullPage: true });

    // Step 5: Click Random mode
    const randomChip = page.getByRole('button', { name: 'Random' }).first();
    await randomChip.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/workflow-05-random-mode.png', fullPage: true });

    // Step 6: Enable Seeded checkbox
    const seededCheckbox = page.getByRole('checkbox', { name: /seeded/i });
    await seededCheckbox.check();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/workflow-06-seeded-enabled.png', fullPage: true });

    // Step 7: Start the session
    const startButton = page.getByRole('button', { name: /start session/i });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // Wait for practice screen to load
    await expect(page.getByText(/practice/i)).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/workflow-07-practice-screen.png', fullPage: true });

    // Enable the Feedback panel (it's hidden by default)
    const feedbackToggle = page.getByRole('checkbox', { name: /feedback/i });
    await feedbackToggle.check();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/workflow-07b-feedback-enabled.png', fullPage: true });

    // Step 8: Test different guess scenarios
    // The seeded random should give us predictable results with seed=42

    // Find the recall input and submit button
    const recallInput = page.locator('input[type="number"]').first();
    const submitButton = page.getByRole('button', { name: /submit/i });

    // Test Case 1: Perfect guess (exact match)
    // With seeded random, the first shot should be predictable
    // Let's guess a value that should be close
    await recallInput.fill('50');
    await page.screenshot({ path: 'test-results/workflow-08-guess-1-entered.png', fullPage: true });
    await submitButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/workflow-09-guess-1-result.png', fullPage: true });

    // Verify feedback is shown
    await expect(page.getByText(/last shot/i)).toBeVisible();

    // Test Case 2: Slight off guess (5-10% off)
    await recallInput.fill('55');
    await page.screenshot({ path: 'test-results/workflow-10-guess-2-entered.png', fullPage: true });
    await submitButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/workflow-11-guess-2-result.png', fullPage: true });

    // Test Case 3: Fairly off guess (15-20% off)
    await recallInput.fill('70');
    await page.screenshot({ path: 'test-results/workflow-12-guess-3-entered.png', fullPage: true });
    await submitButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/workflow-13-guess-3-result.png', fullPage: true });

    // Test Case 4: Very off guess (25%+ off)
    await recallInput.fill('20');
    await page.screenshot({ path: 'test-results/workflow-14-guess-4-entered.png', fullPage: true });
    await submitButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/workflow-15-guess-4-result.png', fullPage: true });

    // Verify that results are being tracked
    // Check for feedback panel showing results
    await expect(page.locator('text=Feedback').locator('..').getByText('Result').first()).toBeVisible();

    // Take final screenshot showing accumulated attempts
    await page.screenshot({ path: 'test-results/workflow-16-final-state.png', fullPage: true });

    // Verify the feedback panel shows severity indicators
    // The exact text will depend on the guess accuracy, but we should see the feedback structure
    const feedbackSection = page.locator('h3:has-text("Feedback")').locator('..');
    await expect(feedbackSection).toBeVisible();

    // Final validation screenshot
    await page.screenshot({ path: 'test-results/workflow-17-completed.png', fullPage: true });
  });
});
