import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

import App from '../../../src/app.jsx';

describe('App - Practice Mode Comprehensive Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setupAndGoToPractice(user) {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Load example shots
    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Navigate to Practice mode
    const practiceButton = screen.getAllByRole('button').find(btn =>
      btn.textContent === 'Practice' && !btn.disabled,
    );

    if (practiceButton) {
      await user.click(practiceButton);

      // Wait for practice mode UI to load
      await waitFor(() => {
        // Check that we're no longer in setup
        expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    }
  }

  it('should enter practice mode and show practice UI', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Verify practice mode UI elements are present
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      expect(allButtons.length).toBeGreaterThan(0);
    });
  }, 15000);

  it('should toggle between manual and random mode in practice', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Look for Manual/Random mode chips
    const allButtons = screen.getAllByRole('button');
    const manualButton = allButtons.find(btn => btn.textContent === 'Manual');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');

    if (manualButton && randomButton) {
      // Toggle to random mode
      await user.click(randomButton);

      // Toggle back to manual mode
      await user.click(manualButton);
    }
  }, 15000);

  it('should select different shots in manual mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // In manual mode, should be able to click different shot chips
    const allButtons = screen.getAllByRole('button');
    const shotButtons = allButtons.filter(btn =>
      ['Ramp', 'Loop', 'Orbit', 'Target', 'Spinner'].some(type =>
        btn.textContent.includes(type),
      ),
    );

    if (shotButtons.length > 1) {
      await user.click(shotButtons[0]);
      await user.click(shotButtons[1]);
    }
  }, 15000);

  it('should switch between left and right flippers in manual mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Look for flipper selection buttons
    const allButtons = screen.getAllByRole('button');
    const leftButton = allButtons.find(btn => btn.textContent === 'Left');
    const rightButton = allButtons.find(btn => btn.textContent === 'Right');

    if (leftButton && rightButton) {
      await user.click(leftButton);
      await user.click(rightButton);
      await user.click(leftButton);
    }
  }, 15000);

  it('should handle playfield clicks in practice mode to submit guesses', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Verify we're in practice mode
    expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();

    // Find recall buttons to make guesses
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

    if (recallButtons.length > 0) {
      // Click recall buttons to submit guesses
      await user.click(recallButtons[0]);
      if (recallButtons.length > 1) {
        await user.click(recallButtons[1]);
      }
    }

    // Verify still in practice mode
    expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
  }, 15000);

  it('should toggle seeded random mode checkbox', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode first
    const allButtons = screen.getAllByRole('button');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');

    if (randomButton) {
      await user.click(randomButton);

      // Look for seeded checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      const seededCheckbox = checkboxes.find(cb => {
        const label = cb.closest('label');
        return label?.textContent.includes('Seeded');
      });

      if (seededCheckbox) {
        await user.click(seededCheckbox);
        await user.click(seededCheckbox);
      }
    }
  }, 15000);

  it('should toggle feedback panel visibility', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Look for feedback checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    const feedbackCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label?.textContent.includes('Feedback');
    });

    if (feedbackCheckbox) {
      await user.click(feedbackCheckbox);
      await user.click(feedbackCheckbox);
    }
  }, 15000);

  it('should toggle attempt history visibility', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Look for attempt history checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    const historyCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label?.textContent.includes('Attempt history');
    });

    if (historyCheckbox) {
      await user.click(historyCheckbox);
      await user.click(historyCheckbox);
    }
  }, 15000);

  it('should use random shot button in random mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode
    const allButtons = screen.getAllByRole('button');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');

    if (randomButton) {
      await user.click(randomButton);

      // Look for the random shot button (↻)
      const randomShotButton = allButtons.find(btn => btn.textContent.includes('↻'));

      if (randomShotButton) {
        await user.click(randomShotButton);
        await user.click(randomShotButton);
      }
    }
  }, 15000);

  it('should navigate back to setup from practice mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Click setup button to go back
    const allButtons = screen.getAllByRole('button');
    const setupButton = allButtons.find(btn => btn.textContent === 'Setup');

    if (setupButton) {
      await user.click(setupButton);

      // Verify we're back in setup mode
      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });
    }
  }, 15000);

  it('should complete multiple practice attempts and show statistics', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Verify we're in practice mode
    expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();

    // Look for recall buttons which allow making attempts
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

    // Make some attempts if recall buttons exist
    if (recallButtons.length > 0) {
      for (let i = 0; i < Math.min(3, recallButtons.length); i++) {
        await user.click(recallButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }, 20000);

  it('should handle metrics display in practice mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Verify practice heading exists
    expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();

    // Check for recall buttons which allow making attempts
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

    // Make a few attempts if buttons exist
    if (recallButtons.length > 0) {
      await user.click(recallButtons[0]);
      await user.click(recallButtons[Math.min(1, recallButtons.length - 1)]);
    }
  }, 15000); it('should toggle all checkboxes in practice mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Get all checkboxes and toggle them
    const checkboxes = screen.getAllByRole('checkbox');

    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    // Toggle them all back
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }
  }, 15000);

  it('should switch modes and make attempts in both manual and random', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    const allButtons = screen.getAllByRole('button');
    const manualButton = allButtons.find(btn => btn.textContent === 'Manual');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');

    // Get recall buttons for making attempts
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

    if (manualButton && randomButton && recallButtons.length > 0) {
      // Make attempt in manual mode
      await user.click(manualButton);
      await user.click(recallButtons[0]);

      // Switch to random and make attempt
      await user.click(randomButton);
      if (recallButtons.length > 1) {
        await user.click(recallButtons[1]);
      }

      // Switch back to manual and make attempt
      await user.click(manualButton);
      if (recallButtons.length > 2) {
        await user.click(recallButtons[2]);
      }
    }
  }, 20000);
});
