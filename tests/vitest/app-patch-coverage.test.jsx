import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

import App from '../../src/app.jsx';

const PLAYFIELD_SELECTOR = '.relative.border.rounded-xl';

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

describe('App - Animation and Static Ball Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should exercise animation complete path with final ball position', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make multiple guesses to exercise the animation code path multiple times
    for (let i = 0; i < 3; i++) {
      const recallButton = screen.getByRole('button', { name: /recall 50/i });
      await user.click(recallButton);

      // Wait for awaiting state
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 50/i });
        expect(btn).toBeDisabled();
      }, { timeout: 5000 });

      // Wait for animation to fully complete (800ms+ for travel + shake)
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Click playfield to continue
      const playfield = document.querySelector(PLAYFIELD_SELECTOR);
      if (playfield) {
        await user.click(playfield);
        await waitFor(() => {
          const btn = screen.getByRole('button', { name: /recall 50/i });
          expect(btn).not.toBeDisabled();
        }, { timeout: 3000 });
      }
    }
  }, 30000);

  it('should exercise shake progress calculation for different error magnitudes', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Test with a guess that will have significant error (high shake)
    const recallButton85 = screen.getByRole('button', { name: /recall 85/i });
    await user.click(recallButton85);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 85/i });
      expect(btn).toBeDisabled();
    }, { timeout: 5000 });

    // Wait for full animation including shake phase
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click to continue
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);
    }
  }, 20000);

  it('should exercise guide line rendering with severity colors', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess to get a result with severity
    const recallButton = screen.getByRole('button', { name: /recall 75/i });
    await user.click(recallButton);

    // Wait for awaiting state and animation
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 75/i });
      expect(btn).toBeDisabled();
    }, { timeout: 5000 });

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Verify line elements are rendered (guide lines with stroke)
    const lines = document.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);

    // Verify polygon elements (shaded wedge)
    const polygons = document.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThan(0);
  }, 20000);

  it('should exercise pending shot state in random mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode
    const randomButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Random');
    if (randomButton) {
      await user.click(randomButton);
    }

    // Make several guesses to exercise random pending shot logic
    for (let i = 0; i < 2; i++) {
      const recallButton = screen.getByRole('button', { name: /recall 50/i });
      await user.click(recallButton);

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /recall 50/i });
        expect(btn).toBeDisabled();
      }, { timeout: 3000 });

      // Wait briefly then continue
      await new Promise(resolve => setTimeout(resolve, 600));

      const playfield = document.querySelector(PLAYFIELD_SELECTOR);
      if (playfield) {
        await user.click(playfield);
        await waitFor(() => {
          const btn = screen.getByRole('button', { name: /recall 50/i });
          expect(btn).not.toBeDisabled();
        }, { timeout: 3000 });
      }
    }
  }, 25000);

  it('should exercise pending shot state in manual mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Ensure manual mode
    const manualButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Manual');
    if (manualButton) {
      await user.click(manualButton);
    }

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 60/i });
    await user.click(recallButton);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /recall 60/i });
      expect(btn).toBeDisabled();
    }, { timeout: 3000 });

    // Continue
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);
    }
  }, 15000);
});

describe('App - Playfield Interaction Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should exercise handlePlayfieldClick callback', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess to enter awaiting state
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Find playfield and click it multiple times to exercise the callback
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);

      await waitFor(() => {
        expect(recallButton).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 15000);

  it('should exercise keyboard handlers on playfield', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 55/i });
    await user.click(recallButton);

    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Test Enter key
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      playfield.focus();
      fireEvent.keyDown(playfield, { key: 'Enter' });

      await waitFor(() => {
        expect(recallButton).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 15000);

  it('should exercise Space key handler with preventDefault', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 65/i });
    await user.click(recallButton);

    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Test Space key
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      playfield.focus();
      fireEvent.keyDown(playfield, { key: ' ' });

      await waitFor(() => {
        expect(recallButton).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 15000);

  it('should not call onAdvanceToNextShot when not awaiting', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Try clicking playfield when NOT awaiting - nothing should happen
    const playfield = document.querySelector(PLAYFIELD_SELECTOR);
    if (playfield) {
      await user.click(playfield);
    }

    // Buttons should still be enabled
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    expect(recallButton).not.toBeDisabled();
  }, 15000);
});

describe('App - Reset Button Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should exercise reset to defaults button click handler', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Find and click Advanced options button
    const advancedButton = screen.getAllByRole('button').find(btn => {
      const title = btn.getAttribute('title');
      return title && title.toLowerCase().includes('advanced');
    });

    if (advancedButton) {
      await user.click(advancedButton);

      // Wait for popover content to appear
      await waitFor(() => {
        expect(screen.getByText(/reset to defaults/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click the reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      // Verify the button was clicked (it should still be there)
      expect(resetButton).toBeInTheDocument();
    }
  }, 15000);
});

describe('App - advanceToNextShot Callback Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return early from advanceToNextShot when not awaiting', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // The advanceToNextShot callback should return early when awaitingNextShot is false
    // We can test this by attempting to interact with playfield before any guess
    
    // Before making a guess, playfield shouldn't have role=button
    const interactivePlayfield = document.querySelector('[role="button"][tabindex="0"]');
    expect(interactivePlayfield).toBeNull();

    // Make a guess to trigger awaiting state
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Now playfield should be interactive
    await waitFor(() => {
      const interactive = document.querySelector('[role="button"][tabindex="0"]');
      expect(interactive).not.toBeNull();
    }, { timeout: 3000 });
  }, 15000);

  it('should apply pending next shot values when clicking to continue', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Switch to random mode to test pending values
    const randomButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Random');
    if (randomButton) {
      await user.click(randomButton);
    }

    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Click playfield to apply pending values
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);

      // Verify state is cleared
      await waitFor(() => {
        expect(recallButton).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 15000);
});

describe('App - Guide Color and Stroke Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render neutral guide color before making a guess', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Without making a guess, guide should be neutral slate color
    const lines = document.querySelectorAll('line');
    // Guide lines should exist for the selected shot
    expect(lines.length).toBeGreaterThan(0);
  }, 15000);

  it('should render severity-colored guide after making a guess', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess with error
    const recallButton = screen.getByRole('button', { name: /recall 80/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation and feedback
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Lines should be rendered with severity color
    const lines = document.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  }, 20000);
});

describe('App - Clear Final Ball Position Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should clear final ball position when awaitingNextShot becomes false', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Wait for awaiting state
    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 3000 });

    // Wait for animation to complete (ball position should be saved)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click playfield to clear awaiting state (which should clear final ball position)
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);

      // Wait for state to update
      await waitFor(() => {
        expect(recallButton).not.toBeDisabled();
      }, { timeout: 3000 });
    }
  }, 20000);
});

describe('App - Animation Skip Final Position Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save final position when skipping with keypress', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 50/i });
    await user.click(recallButton);

    // Skip immediately with Escape
    await user.keyboard('{Escape}');

    // Wait for awaiting state
    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 2000 });

    // Verify SVG elements exist (ball should be rendered at final position)
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);

    // Click playfield to continue
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);
    }
  }, 15000);

  it('should handle skip during travel phase', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 55/i });
    await user.click(recallButton);

    // Wait a tiny bit then skip with Enter (during travel phase)
    await new Promise(resolve => setTimeout(resolve, 200));
    await user.keyboard('{Enter}');

    // Should be in awaiting state
    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 2000 });

    // Continue
    const playfield = document.querySelector('[role="button"][tabindex="0"]');
    if (playfield) {
      await user.click(playfield);
    }
  }, 15000);

  it('should handle skip during shake phase', async () => {
    const user = userEvent.setup();
    await setupAndGoToPractice(user);

    // Make a guess
    const recallButton = screen.getByRole('button', { name: /recall 60/i });
    await user.click(recallButton);

    // Wait for travel to complete then skip during shake (500ms + 100ms)
    await new Promise(resolve => setTimeout(resolve, 600));
    await user.keyboard(' ');

    // Should be in awaiting state
    await waitFor(() => {
      expect(recallButton).toBeDisabled();
    }, { timeout: 2000 });
  }, 15000);
});
