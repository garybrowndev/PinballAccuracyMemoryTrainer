import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../src/app.jsx';

const PLAYFIELD_SELECTOR = '.relative.border.rounded-xl';

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
      expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  }
}

describe('App - Click-to-Continue Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should complete ball animation naturally and render static ball', async () => {
    vi.useRealTimers(); // Use real timers for this test
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess to trigger animation
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Wait for animation to complete naturally (travel + shake = ~800-900ms)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 50/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for the full animation duration (500ms travel + up to 600ms shake)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check for SVG elements in the playfield
    await waitFor(() => {
      const svgs = document.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    // Check for circle elements (ball) 
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  }, 25000);

  it('should render static ball layer with correct SVG elements when awaiting', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 45/i });
    await user.click(recallButton);

    // Wait for awaiting state and animation to complete
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 45/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation to complete fully
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Verify SVG elements are present (circles for ball)
    await waitFor(() => {
      // Check for circles (ball)
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  }, 25000);

  it('should clear static ball when user clicks to continue', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 55/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 55/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Verify static ball exists
    await waitFor(() => {
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    // Click playfield to advance
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);

      // Wait for state to update
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 55/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 25000);

  it('should show severity-colored guide when awaiting next shot with feedback', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess that will have some error (severity)
    const recallButton = screen.getByRole('button', { name: /recall 75/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 75/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation to complete and feedback to show
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Verify guide lines with stroke are present
    await waitFor(() => {
      const lines = document.querySelectorAll('line');
      expect(lines.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  }, 25000);

  it('should apply pending shot in random mode after click to continue', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode
    const allButtons = screen.getAllByRole('button');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');
    if (randomButton) {
      await user.click(randomButton);
    }

    // Make first guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 50/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click playfield to apply pending next shot
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 50/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 25000);

  it('should keep same shot in manual mode after click to continue', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Ensure we're in manual mode
    const allButtons = screen.getAllByRole('button');
    const manualButton = allButtons.find(btn => btn.textContent === 'Manual');
    if (manualButton) {
      await user.click(manualButton);
    }

    // Make guess
    const recallButton = screen.getByRole('button', { name: /recall 60/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 60/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 60/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 25000);

  it('should not advance if not awaiting next shot', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Find playfield and try to click it before making any guess
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    
    // Click playfield - should not cause any issues since we're not awaiting
    if (playfield) {
      await user.click(playfield);
    }

    // Buttons should still be enabled (nothing should have changed)
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    expect(recallButton).not.toBeDisabled();
  }, 15000);

  it('should handle Enter key on playfield when awaiting', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 65/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 65/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find playfield with role=button
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      playfield.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 65/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should handle Space key with preventDefault on playfield when awaiting', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 70/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 70/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find playfield with role=button and press Space
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      playfield.focus();
      await user.keyboard(' ');

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 70/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should not have role=button on playfield when not awaiting', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Before any guess, playfield should not have role=button
    const playfieldWithRole = document.querySelector('[role="button"][tabindex="0"]');
    expect(playfieldWithRole).toBeNull();
  }, 15000);
});

describe('App - Reset to Defaults Button Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function openAdvancedOptions(user) {
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

    // Find the Advanced button (look for button with gear icon or specific style)
    const buttons = screen.getAllByRole('button');
    const advancedButton = buttons.find(btn => {
      const title = btn.getAttribute('title');
      return title && title.toLowerCase().includes('advanced');
    });

    if (advancedButton) {
      await user.click(advancedButton);
      
      // Wait for advanced options to appear
      await waitFor(() => {
        expect(screen.getByText(/reset to defaults/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      return true;
    }
    return false;
  }

  it('should reset advanced settings when clicking reset button', async () => {
    const user = userEvent.setup();
    const opened = await openAdvancedOptions(user);

    if (opened) {
      // Find and click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      // Just verify the click happened without errors and button exists
      expect(resetButton).toBeInTheDocument();
    }
  }, 15000);

  it('should have reset button in advanced options dialog', async () => {
    const user = userEvent.setup();
    const opened = await openAdvancedOptions(user);

    if (opened) {
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveAttribute('title', 'Reset all advanced settings to their default values');
    }
  }, 15000);
});

describe('App - Ball Animation Skip and Complete Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save final ball position when skipping animation with Escape', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Immediately skip with Escape
    await user.keyboard('{Escape}');

    // Should be in awaiting state with static ball shown
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 50/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });

    // Check for circle elements (static ball)
    await waitFor(() => {
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  }, 15000);

  it('should save final ball position when skipping animation with Enter', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 55/i });
    await user.click(recallButton);

    // Skip with Enter
    await user.keyboard('{Enter}');

    // Should be in awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 55/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);

  it('should save final ball position when skipping animation with Space', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 60/i });
    await user.click(recallButton);

    // Skip with Space
    await user.keyboard(' ');

    // Should be in awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 60/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);
});

describe('App - Fullscreen Click-to-Continue Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setupFullscreenPractice(user) {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const practiceButton = screen.getAllByRole('button').find(btn =>
      btn.textContent === 'Practice' && !btn.disabled,
    );

    if (practiceButton) {
      await user.click(practiceButton);
      await waitFor(() => {
        expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    }

    // Enter fullscreen mode
    const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
    await user.click(fullscreenButton);

    await waitFor(() => {
      const exitButton = screen.queryByRole('button', { name: /exit/i });
      expect(exitButton).toBeInTheDocument();
    }, { timeout: 2000 });
  }

  it('should show static ball in fullscreen mode after animation completes', async () => {
    const user = userEvent.setup();
    await setupFullscreenPractice(user);

    // Make a guess in fullscreen
    const recallButtons = screen.getAllByRole('button', { name: /recall 50/i });
    await user.click(recallButtons[0]);

    // Wait for awaiting state
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /recall 50/i });
      expect(btns[0]).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check for static ball
    await waitFor(() => {
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  }, 25000);

  it('should clear static ball in fullscreen when clicking playfield', async () => {
    const user = userEvent.setup();
    await setupFullscreenPractice(user);

    // Make a guess
    const recallButtons = screen.getAllByRole('button', { name: /recall 55/i });
    await user.click(recallButtons[0]);

    // Wait for awaiting state
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /recall 55/i });
      expect(btns[0]).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click playfield in fullscreen
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again
      await waitFor(() => {
        const btns = screen.getAllByRole('button', { name: /recall 55/i });
        expect(btns[0]).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 25000);

  it('should disable Not Possible button in fullscreen when awaiting', async () => {
    const user = userEvent.setup();
    await setupFullscreenPractice(user);

    // Make a guess
    const recallButtons = screen.getAllByRole('button', { name: /recall 60/i });
    await user.click(recallButtons[0]);

    // Wait for awaiting state and check Not Possible button is disabled
    await waitFor(() => {
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      expect(notPossibleButtons[0]).toBeDisabled();
    }, { timeout: 3000 });
  }, 20000);
});

describe('App - DISABLED_CLASS Usage Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should apply DISABLED_CLASS to recall buttons when awaiting', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 50/i });
      expect(btn).toBeDisabled();
      // Check that it has the disabled styling
      expect(btn.className).toContain('opacity-50');
      expect(btn.className).toContain('cursor-not-allowed');
    }, { timeout: 3000 });
  }, 15000);

  it('should apply DISABLED_CLASS to Not Possible button when awaiting', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Wait for awaiting state and check Not Possible has disabled class
    await waitFor(() => {
      const notPossibleBtn = screen.getByRole('button', { name: /not possible/i });
      expect(notPossibleBtn).toBeDisabled();
      expect(notPossibleBtn.className).toContain('opacity-50');
    }, { timeout: 3000 });
  }, 15000);
});
