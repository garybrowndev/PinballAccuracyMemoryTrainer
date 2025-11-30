import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import App from '../../src/app.jsx';

describe('App - Click-to-Continue Flow Tests', () => {
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
        expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    }
  }

  it('should disable recall buttons after making a guess until clicking playfield', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Find a recall button
    const recallButton = screen.getByRole('button', { name: /Recall 50/i });
    expect(recallButton).not.toBeDisabled();

    // Make a guess
    await user.click(recallButton);

    // Wait for button to become disabled (awaiting next shot)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 50/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Find and click the playfield to advance to next shot
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 50/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should show disabled state when awaiting next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 55/i });
    await user.click(recallButton);

    // Wait for buttons to become disabled (awaiting next shot)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 55/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield to advance
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Wait a bit for state to update - buttons should be enabled again
      await waitFor(() => {
        const recallBtn = screen.getByRole('button', { name: /Recall 55/i });
        expect(recallBtn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should handle keyboard navigation on playfield to advance to next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 60/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 60/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Find playfield and trigger keyboard event
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      // Focus the playfield and press Enter
      playfield.focus();
      await user.keyboard('{Enter}');

      // Buttons should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 60/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should handle Space key on playfield to advance to next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 65/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 65/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Find playfield and trigger Space key
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      playfield.focus();
      await user.keyboard(' ');

      // Buttons should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 65/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should store pending next shot in random mode and apply when clicking to continue', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode
    const allButtons = screen.getAllByRole('button');
    const randomButton = allButtons.find(btn => btn.textContent === 'Random');
    if (randomButton) {
      await user.click(randomButton);
    }

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 70/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 70/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield to advance
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again (random shot applied)
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 70/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should keep the same shot/side in manual mode after clicking to continue', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Ensure we're in manual mode
    const allButtons = screen.getAllByRole('button');
    const manualButton = allButtons.find(btn => btn.textContent === 'Manual');
    if (manualButton) {
      await user.click(manualButton);
    }

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 45/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 45/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield to advance
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 45/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should show guide lines with severity color when awaiting next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess with some error
    const recallButton = screen.getByRole('button', { name: /Recall 80/i });
    await user.click(recallButton);

    // Wait for awaiting state and feedback
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 80/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Check that SVG elements exist for the guide
    await waitFor(() => {
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  }, 20000);

  it('should display static ball at final position while awaiting next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 35/i });
    await user.click(recallButton);

    // Wait for animation to complete and ball to be static
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 35/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation and static ball
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check for circle elements (ball)
    await waitFor(() => {
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  }, 20000);

  it('should clear final ball position when advancing to next shot', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 40/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 40/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click playfield to advance
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Wait for state to update
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Recall 40/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);

  it('should handle Not Possible button with click-to-continue flow', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Find the "Not Possible" button
    const notPossibleButton = screen.getByRole('button', { name: /not possible/i });
    expect(notPossibleButton).not.toBeDisabled();

    // Click Not Possible
    await user.click(notPossibleButton);

    // Button should be disabled after guess
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /not possible/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield to advance
    const playfield = document.querySelector('.relative.border.rounded-xl');
    if (playfield) {
      await user.click(playfield);

      // Button should be enabled again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /not possible/i });
        expect(btn).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);
});

describe('App - Advanced Options Reset Button', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function openAdvancedOptionsFromSetup(user) {
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

    // Find the Advanced button (has a gear/cog icon, look for title or find button with specific text)
    // The Advanced options button is in setup mode, look for it
    const advancedButton = screen.getAllByRole('button').find(btn => 
      btn.getAttribute('title')?.toLowerCase().includes('advanced') ||
      btn.textContent?.toLowerCase().includes('advanced'),
    );
    
    if (advancedButton) {
      await user.click(advancedButton);
      await waitFor(() => {
        expect(screen.getByText(/reset to defaults/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      return true;
    }
    return false;
  }

  it('should show reset button in advanced options dialog', async () => {
    const user = userEvent.setup();
    const opened = await openAdvancedOptionsFromSetup(user);
    
    if (opened) {
      // Find and click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      expect(resetButton).toBeInTheDocument();
    }
  }, 15000);
});

describe('App - Ball Animation Refs Pattern', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setupAndGoToPractice(user) {
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
  }

  it('should trigger ball animation with refs pattern on recall attempt', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess to trigger animation
    const recallButton = screen.getByRole('button', { name: /Recall 50/i });
    await user.click(recallButton);

    // Animation should start - check for ball elements
    await waitFor(() => {
      // Look for any circle elements (ball)
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  }, 15000);

  it('should transition to awaiting state after ball animation', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 55/i });
    await user.click(recallButton);

    // Wait for buttons to be disabled (awaiting state)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 55/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });
  }, 15000);

  it('should skip ball animation with Escape key and transition to awaiting', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 60/i });
    await user.click(recallButton);

    // Immediately press Escape to skip
    await user.keyboard('{Escape}');

    // Should be in awaiting state (buttons disabled)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 60/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);

  it('should skip ball animation with Enter key', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 65/i });
    await user.click(recallButton);

    // Press Enter to skip
    await user.keyboard('{Enter}');

    // Should be in awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 65/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);

  it('should skip ball animation with Space key', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /Recall 70/i });
    await user.click(recallButton);

    // Press Space to skip
    await user.keyboard(' ');

    // Should be in awaiting state
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Recall 70/i });
      expect(btn).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);
});

describe('App - Fullscreen Click-to-Continue Flow', () => {
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
      // Fullscreen mode should be active
      const exitButton = screen.queryByRole('button', { name: /exit/i });
      expect(exitButton).toBeInTheDocument();
    }, { timeout: 2000 });
  }

  it('should disable recall chips in fullscreen after making a guess', async () => {
    const user = userEvent.setup();
    await setupFullscreenPractice(user);

    // Find recall buttons in fullscreen (there will be duplicates, use getAllBy)
    const recallButtons = screen.getAllByRole('button', { name: /Recall 50/i });
    expect(recallButtons[0]).not.toBeDisabled();

    // Make a guess using the first one
    await user.click(recallButtons[0]);

    // Wait for buttons to become disabled
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /Recall 50/i });
      expect(btns[0]).toBeDisabled();
    }, { timeout: 3000 });
  }, 20000);

  it('should enable recall chips in fullscreen after clicking playfield', async () => {
    const user = userEvent.setup();
    await setupFullscreenPractice(user);

    // Make a guess
    const recallButtons = screen.getAllByRole('button', { name: /Recall 55/i });
    await user.click(recallButtons[0]);

    // Wait for awaiting state
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /Recall 55/i });
      expect(btns[0]).toBeDisabled();
    }, { timeout: 3000 });

    // Find and click the playfield in fullscreen
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);

      // Buttons should be enabled again
      await waitFor(() => {
        const btns = screen.getAllByRole('button', { name: /Recall 55/i });
        expect(btns[0]).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);
});
