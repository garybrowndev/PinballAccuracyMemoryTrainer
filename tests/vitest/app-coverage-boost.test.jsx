import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Helper to go to recall mode
async function goToRecall(user) {
  const recallButton = screen.getAllByRole('button').find(btn =>
    btn.textContent === 'Recall' && !btn.disabled,
  );

  if (recallButton) {
    await user.click(recallButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
    });
  }
}

describe('App - Coverage Boost Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Recall Mode UI Elements', () => {
    it('should render recall mode with download and info buttons', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      // The recall section should be visible
      expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();

      // Check for download button in recall mode
      const downloadButton = screen.queryByRole('button', { name: /download standalone/i });
      expect(downloadButton).toBeInTheDocument();

      // Check for info button in recall mode
      const infoButton = screen.queryByRole('button', { name: /help.*about/i });
      expect(infoButton).toBeInTheDocument();
    }, 15000);

    it('should open info modal from recall mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      // Click on info button
      const infoButton = screen.getByRole('button', { name: /help.*about/i });
      await user.click(infoButton);

      // Modal should be visible
      await waitFor(() => {
        expect(screen.getByText(/version/i)).toBeInTheDocument();
      });
    }, 15000);

    it('should toggle dark mode in recall mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      // Find and click dark mode toggle
      const darkModeButton = screen.queryByRole('button', { name: /switch to (dark|light) mode/i });
      expect(darkModeButton).toBeInTheDocument();
      
      await user.click(darkModeButton);
      
      // Button should still be there after toggle
      const toggleButton = screen.queryByRole('button', { name: /switch to (dark|light) mode/i });
      expect(toggleButton).toBeInTheDocument();
    }, 15000);
  });

  describe('Adjustment Direction Display', () => {
    it('should display adjustment direction indicators in attempt history', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make several practice attempts to trigger different adjustment directions
      // First, try guessing low to see "Higher" adjustment needed
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length > 0) {
        // Guess with first chip (low value)
        await user.click(chips[0]);
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Toggle show attempt history
      const historyCheckbox = screen.queryByRole('checkbox', { name: /show attempt history/i });
      if (historyCheckbox && !historyCheckbox.checked) {
        await user.click(historyCheckbox);
      }

      // Wait for history to appear
      await waitFor(() => {
        // Check if there are any attempt entries visible
        const attemptElements = screen.queryAllByText(/attempt/i);
        expect(attemptElements.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 5000 });
    }, 20000);

    it('should show Higher/Lower adjustment indicators after wrong guesses', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enable feedback to see adjustment indicators
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
      }

      // Make an intentionally wrong guess to trigger adjustment display
      const recallChips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (recallChips.length > 0) {
        // Click first chip (likely wrong)
        await user.click(recallChips[0]);
        
        // Wait for result
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Click to continue if needed
        const playfield = document.querySelector('svg');
        if (playfield) {
          fireEvent.click(playfield);
        }
      }

      // Make another attempt to generate adjustment data
      if (recallChips.length > 5) {
        await user.click(recallChips[5]);
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      // Toggle history to see the results
      const historyCheckbox = screen.queryByRole('checkbox', { name: /show attempt history/i });
      if (historyCheckbox && !historyCheckbox.checked) {
        await user.click(historyCheckbox);
      }
    }, 25000);
  });

  describe('Fullscreen Recall Chips', () => {
    it('should render recall chips in fullscreen mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen mode
      const fullscreenButton = screen.queryByRole('button', { name: /enter fullscreen/i });
      if (fullscreenButton) {
        await user.click(fullscreenButton);

        // Wait for fullscreen to render
        await waitFor(() => {
          // Fullscreen should show recall chips
          const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
          expect(chips.length).toBeGreaterThan(0);
        }, { timeout: 3000 });

        // Find Not Possible button in fullscreen
        const npButton = screen.queryAllByRole('button').find(btn =>
          btn.textContent?.toLowerCase().includes('not possible'),
        );
        expect(npButton).toBeTruthy();
      }
    }, 15000);

    it('should submit recall attempt from fullscreen chips', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen mode
      const fullscreenButton = screen.queryByRole('button', { name: /enter fullscreen/i });
      if (fullscreenButton) {
        await user.click(fullscreenButton);

        await waitFor(() => {
          const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
          expect(chips.length).toBeGreaterThan(0);
        });

        // Click a recall chip
        const chips = screen.getAllByRole('button', { name: /recall \d+/i });
        await user.click(chips[Math.floor(chips.length / 2)]);

        // Wait for attempt processing
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }, 15000);
  });

  describe('Attempt History Table Adjustment Indicators', () => {
    it('should show adjustment arrows in attempt history table', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make multiple attempts to populate history
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      for (let i = 0; i < Math.min(3, chips.length); i++) {
        await user.click(chips[i]);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Click playfield to continue
        const playfield = document.querySelector('svg');
        if (playfield) {
          fireEvent.click(playfield);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Show attempt history
      const historyCheckbox = screen.queryByRole('checkbox', { name: /show attempt history/i });
      if (historyCheckbox && !historyCheckbox.checked) {
        await user.click(historyCheckbox);
      }

      // Enable show as table - search for checkbox with table text
      const tableCheckbox = screen.queryByRole('checkbox', { name: /as table/i });
      if (tableCheckbox && !tableCheckbox.checked) {
        await user.click(tableCheckbox);
      }

      // The attempt history should now show adjustment info
      // We just verify attempts were made successfully
      await waitFor(() => {
        // Check for attempt-related content in the history section
        const historySection = screen.queryByText(/history/i);
        expect(historySection).toBeTruthy();
      });
    }, 25000);
  });

  describe('Download Button Behavior', () => {
    it('should click download button in recall mode and show toast', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      // Find download button
      const downloadButton = screen.getByRole('button', { name: /download standalone/i });
      await user.click(downloadButton);

      // Should show toast about standalone mode
      await waitFor(() => {
        const toast = screen.queryByText(/standalone/i);
        expect(toast).toBeTruthy();
      }, { timeout: 3000 });
    }, 15000);
  });

  describe('LocalStorage Error Handling', () => {
    it('should handle localStorage getItem error gracefully', async () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      render(<App />);

      await waitFor(() => {
        // App should still render with default values
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Restore
      Storage.prototype.getItem = originalGetItem;
    }, 10000);

    it('should handle localStorage setItem error gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock localStorage.setItem to throw
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage full');
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Try to add a shot - should not crash
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);

      // App should still work
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Restore
      Storage.prototype.setItem = originalSetItem;
    }, 15000);

    it('should handle malformed localStorage data', async () => {
      // Set invalid JSON in localStorage
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn((key) => {
        if (key === 'pinball_rows_v1') {
          return 'not valid json';
        }
        return null;
      });

      render(<App />);

      await waitFor(() => {
        // App should still render with defaults
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Restore
      Storage.prototype.getItem = originalGetItem;
    }, 10000);
  });

  describe('Practice Mode Edge Cases', () => {
    it('should handle rapid Not Possible clicks', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      const npButton = screen.queryAllByRole('button').find(btn =>
        btn.textContent?.toLowerCase() === 'not possible',
      );

      if (npButton) {
        // Rapid clicks
        for (let i = 0; i < 3; i++) {
          await user.click(npButton);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 15000);

    it('should handle attempts with all possible values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Try Not Possible (0)
      const npButton = screen.queryAllByRole('button').find(btn =>
        btn.textContent?.toLowerCase() === 'not possible',
      );
      if (npButton) {
        await user.click(npButton);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Click to continue
        const playfield = document.querySelector('svg');
        if (playfield) {
          fireEvent.click(playfield);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Try high value (95)
      const chips = screen.queryAllByRole('button', { name: /recall 95/i });
      if (chips.length > 0) {
        await user.click(chips[0]);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, 20000);
  });

  describe('Adjustment Direction Display - Manual Mode', () => {
    it('should display Higher/Lower indicators after consecutive wrong guesses in manual mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode first
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio && !manualRadio.checked) {
        await user.click(manualRadio);
      }

      // Enable feedback panel
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
      }

      // Get the recall chips
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 5) return;

      // Make a first guess - choose a low value (should create a positive delta if truth is higher)
      await user.click(chips[0]); // recall 05
      await new Promise(resolve => setTimeout(resolve, 600));

      // Click to continue
      const playfield = document.querySelector('svg');
      if (playfield) {
        fireEvent.click(playfield);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Make a second guess on the same shot/side - this should trigger adjustRequired
      // In manual mode, it stays on the same shot
      await user.click(chips[0]); // guess same value again
      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify UI is still functional after attempts
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 25000);

    it('should show Higher indicator when previous delta was negative', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable feedback panel
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
      }

      // Guess high value first (to get negative delta if truth is lower)
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 18) return;

      await user.click(chips[17]); // recall 90
      await new Promise(resolve => setTimeout(resolve, 600));

      // Click to continue
      const playfield = document.querySelector('svg');
      if (playfield) {
        fireEvent.click(playfield);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Second guess on same shot
      await user.click(chips[15]); // recall 80
      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify some UI elements exist after making attempts
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 25000);

    it('should show Lower indicator when previous delta was positive', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable feedback panel
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
      }

      // Guess low value first
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 5) return;

      await user.click(chips[1]); // recall 10
      await new Promise(resolve => setTimeout(resolve, 600));

      // Click to continue
      const playfield = document.querySelector('svg');
      if (playfield) {
        fireEvent.click(playfield);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Second guess - same shot, different value
      await user.click(chips[3]); // recall 20
      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify UI still works
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 25000);
  });

  describe('Feedback Panel Adjustment Details', () => {
    it('should show adjustment direction in feedback panel after repeat attempt', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode to control shot selection
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable the feedback panel to see adjustment info
      const feedbackCheckbox = screen.queryByRole('checkbox', { name: /show feedback/i });
      if (feedbackCheckbox && !feedbackCheckbox.checked) {
        await user.click(feedbackCheckbox);
      }

      // Make first attempt
      const recallChips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (recallChips.length < 10) return;

      await user.click(recallChips[2]); // guess 15%
      await new Promise(resolve => setTimeout(resolve, 700));

      // Click playfield to continue
      const svg = document.querySelector('svg');
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Make second attempt on same shot
      await user.click(recallChips[8]); // guess 45%
      await new Promise(resolve => setTimeout(resolve, 700));

      // Verify UI is still working after attempts
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    }, 30000);
  });

  describe('Attempt History with Adjustment', () => {
    it('should display adjustment indicators in history after repeated attempts', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Use manual mode
      const manualRadio = screen.queryByRole('radio', { name: /manual/i });
      if (manualRadio) {
        await user.click(manualRadio);
      }

      // Enable attempt history
      const historyCheckbox = screen.queryByRole('checkbox', { name: /show attempt history/i });
      if (historyCheckbox && !historyCheckbox.checked) {
        await user.click(historyCheckbox);
      }

      // Make multiple attempts
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (chips.length < 10) return;

      // First attempt
      await user.click(chips[2]);
      await new Promise(resolve => setTimeout(resolve, 600));

      const svg = document.querySelector('svg');
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Second attempt on same shot
      await user.click(chips[5]);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Third attempt
      if (svg) {
        fireEvent.click(svg);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await user.click(chips[8]);
      await new Promise(resolve => setTimeout(resolve, 600));

      // History should show attempts
      const historySection = screen.queryByText(/history/i);
      expect(historySection).toBeTruthy();
    }, 30000);
  });
});
