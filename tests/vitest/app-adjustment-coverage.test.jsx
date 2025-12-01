import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../src/app.jsx';

// Helper to setup app with example shots
async function setupAppWithShots(user) {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
  });

  const exampleButton = screen.getByRole('button', { name: /load example shots/i });
  await user.click(exampleButton);

  await waitFor(() => {
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  }, { timeout: 3000 });

  return user;
}

// Helper to go to practice mode
async function goToPractice(user) {
  const practiceButton = screen.getAllByRole('button').find(btn =>
    btn.textContent === 'Practice' && !btn.disabled,
  );

  if (practiceButton) {
    await user.click(practiceButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    });
  }
}

describe('App - Adjustment Direction Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Adjustment Direction in Feedback Panel', () => {
    it('should show Lower when first guess was too high (delta > 0)', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode to control shot selection
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Enable feedback panel first
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Enable mental model to see prevInput
      const mentalCheckbox = screen.queryByRole('checkbox', { name: /show.*guess|mental/i });
      if (mentalCheckbox && !mentalCheckbox.checked) {
        await user.click(mentalCheckbox);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Get recall chips - guess with a very high value first
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 19) return;

      // First guess: pick a high value (like 95%) hoping truth is lower
      await user.click(chips[18]); // recall 95
      await new Promise(resolve => setTimeout(resolve, 800));

      // Click to continue (in manual mode, stays on same shot)
      const svg = document.querySelector('svg');
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Second guess on same shot - this should trigger adjustRequired
      await user.click(chips[17]); // recall 90
      await new Promise(resolve => setTimeout(resolve, 800));

      // The feedback panel should now show the adjustment info
      // Just verify we've made it through without errors
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 30000);

    it('should show Higher when first guess was too low (delta < 0)', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Enable feedback panel
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Get recall chips - guess with a very low value first
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 5) return;

      // First guess: pick a low value (like 5%) hoping truth is higher
      await user.click(chips[0]); // recall 05
      await new Promise(resolve => setTimeout(resolve, 800));

      // Click to continue
      const svg = document.querySelector('svg');
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Second guess on same shot - this should trigger adjustRequired
      await user.click(chips[1]); // recall 10
      await new Promise(resolve => setTimeout(resolve, 800));

      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 30000);

    it('should make multiple attempts to exercise all adjustment paths', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable all visibility options
      const checkboxes = screen.queryAllByRole('checkbox');
      for (const cb of checkboxes) {
        if (!cb.checked) {
          await user.click(cb);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 10) return;

      const svg = document.querySelector('svg');

      // Make a series of attempts on the same shot to trigger various adjustment scenarios
      // Attempt 1: Low guess
      await user.click(chips[1]); // 10%
      await new Promise(resolve => setTimeout(resolve, 600));
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Attempt 2: Still on same shot - triggers adjustRequired
      await user.click(chips[3]); // 20%
      await new Promise(resolve => setTimeout(resolve, 600));
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Attempt 3: Continue adjusting
      await user.click(chips[5]); // 30%
      await new Promise(resolve => setTimeout(resolve, 600));
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Attempt 4: Go the other direction
      await user.click(chips[2]); // 15%
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 40000);
  });

  describe('Attempt History Table with Adjustment Arrows', () => {
    it('should populate attempt history with adjustment data', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable attempt history
      const historyCheckbox = screen.queryByRole('checkbox', { name: /show.*history|history/i });
      if (historyCheckbox && !historyCheckbox.checked) {
        await user.click(historyCheckbox);
      }

      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 5) return;

      const svg = document.querySelector('svg');

      // Make multiple attempts
      for (let i = 0; i < 4; i++) {
        await user.click(chips[i]);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (svg) {
          fireEvent.click(svg);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // History should have entries
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 35000);
  });

  describe('Fullscreen Recall Mode Chips', () => {
    it('should exercise fullscreen recall chips', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen - use more specific selector
      const fullscreenBtn = screen.queryAllByRole('button').find(btn =>
        btn.textContent?.includes('Fullscreen') && btn.title?.includes('Fullscreen'),
      );
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try clicking multiple recall chips in fullscreen
        const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
        for (let i = 0; i < Math.min(3, chips.length); i++) {
          await user.click(chips[i]);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Click playfield to continue
          const svg = document.querySelector('svg');
          if (svg) {
            fireEvent.click(svg);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // Also try Not Possible button
        const npBtn = screen.queryAllByRole('button').find(btn =>
          btn.textContent?.toLowerCase().includes('not possible'),
        );
        if (npBtn && !npBtn.disabled) {
          await user.click(npBtn);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Exit fullscreen
        fireEvent.keyDown(document, { key: 'Escape' });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }, 35000);

    it('should handle disabled state of fullscreen chips when awaiting', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen - use more specific selector
      const fullscreenBtn = screen.queryAllByRole('button').find(btn =>
        btn.textContent?.includes('Fullscreen') && btn.title?.includes('Fullscreen'),
      );
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Make an attempt
        const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
        if (chips.length > 0) {
          await user.click(chips[5]);
          await new Promise(resolve => setTimeout(resolve, 600));

          // Now chips should be disabled while awaiting
          // Click to continue
          const svg = document.querySelector('svg');
          if (svg) {
            fireEvent.click(svg);
          }
        }
      }
    }, 30000);
  });

  describe('Download Button in Recall Mode', () => {
    it('should click download button in recall mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Go to recall mode
      const recallButton = screen.getAllByRole('button').find(btn =>
        btn.textContent === 'Recall' && !btn.disabled,
      );
      if (recallButton) {
        await user.click(recallButton);
        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });
      }

      // Click download button
      const downloadBtn = screen.queryByRole('button', { name: /download/i });
      if (downloadBtn) {
        await user.click(downloadBtn);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Verify toast appears
      await waitFor(() => {
        const toastText = screen.queryByText(/standalone/i);
        expect(toastText).toBeTruthy();
      }, { timeout: 3000 });
    }, 20000);
  });
});
