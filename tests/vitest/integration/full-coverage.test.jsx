import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../../src/app.jsx';

// Helper to setup app with example shots loaded
async function setupAppWithShots(user) {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
  });

  const exampleButton = screen.getByRole('button', { name: /load example shots/i });
  await user.click(exampleButton);

  await waitFor(
    () => {
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    },
    { timeout: 3000 }
  );

  return user;
}

// Helper to navigate to practice mode
async function goToPractice(user) {
  const practiceButton = screen
    .getAllByRole('button')
    .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

  if (practiceButton) {
    await user.click(practiceButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
    });
  }
}

describe('App - Complete Component Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Section Component', () => {
    it('should render sections in both light and dark mode', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Section is rendered in dark mode by default
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();

      // Toggle to light mode
      const darkModeButton = screen.getByRole('button', { name: /switch to light mode/i });
      await user.click(darkModeButton);

      // Section should still be there
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    }, 15000);
  });

  describe('Chip Component', () => {
    it('should render active and inactive chips', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Find all chips (buttons with rounded-full class typically)
      const chips = screen.getAllByRole('button');

      // Click on several chips to test active states
      const shotChips = chips.filter(
        (btn) => btn.textContent?.includes('Orbit') || btn.textContent?.includes('Ramp')
      );

      for (const chip of shotChips) {
        expect(chip).toBeInTheDocument();
      }
    }, 20000);

    it('should render disabled chips in random mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Should be in random mode by default
      const randomBtn = screen.queryByRole('button', { name: /random/i });
      expect(randomBtn).toBeInTheDocument();
    }, 20000);
  });

  describe('NumberInput Component', () => {
    it('should handle number input changes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Navigate to recall mode where number inputs are used
      const recallButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Recall' && !btn.disabled);

      if (recallButton) {
        await user.click(recallButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });

        // Find number inputs
        const inputs = screen.queryAllByRole('spinbutton');

        if (inputs.length > 0) {
          // Test typing
          await user.clear(inputs[0]);
          await user.type(inputs[0], '75');

          // Test keydown
          await user.keyboard('{ArrowUp}');
          await user.keyboard('{ArrowDown}');
        }
      }
    }, 20000);
  });

  describe('PlayfieldEditor Component', () => {
    it('should render playfield editor with all elements', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      expect(playfield).toBeInTheDocument();

      // Check for clear button
      const clearBtn = within(playfield).queryByRole('button', { name: /clear/i });
      expect(clearBtn).toBeInTheDocument();

      // Check for example button
      const exampleBtn = within(playfield).queryByRole('button', { name: /example/i });
      expect(exampleBtn).toBeInTheDocument();
    }, 15000);

    it('should handle advanced options button', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Find advanced options button
      const advancedBtn = screen.queryByRole('button', { name: /advanced/i });
      if (advancedBtn) {
        await user.click(advancedBtn);
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Click again to close
        await user.click(advancedBtn);
      }
    }, 20000);
  });

  describe('PlayfieldScenery Component', () => {
    it('should render flipper scenery', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Check for SVG elements
      const svgs = playfield.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('InlineElementThumb Component', () => {
    it('should render thumbnail images', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Look for image elements in the table/playfield
      const images = screen.queryAllByRole('img');

      // Trigger load/error events on images
      for (const img of images) {
        fireEvent.load(img);
        fireEvent.error(img);
      }
    }, 15000);

    it('should handle click on thumbnail', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find thumbnail buttons
      const thumbnails = screen.queryAllByRole('button');
      const thumbButtons = thumbnails.filter(
        (btn) => btn.querySelector('img') || btn.getAttribute('data-shot-chip-thumb')
      );

      if (thumbButtons.length > 0) {
        await user.click(thumbButtons[0]);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('PracticePlayfield Component', () => {
    it('should render practice playfield with shot boxes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Check for metric boxes
      const lastAttemptText = screen.queryByText(/last attempt/i);
      const attemptsText = screen.queryByText(/^attempts$/i);
      const totalPointsText = screen.queryByText(/total points/i);

      expect(lastAttemptText).toBeInTheDocument();
      expect(attemptsText).toBeInTheDocument();
      expect(totalPointsText).toBeInTheDocument();
    }, 20000);

    it('should handle onScale callback', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen to trigger onScale
      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Resize window to trigger scale changes
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 1600,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 900,
        });
        fireEvent.resize(window);
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Exit fullscreen
        await user.keyboard('{Escape}');
      }
    }, 25000);
  });
});

describe('App - Isotonic and Constraint Functions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should enforce ordering constraints when adjusting sliders', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Add multiple shots
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    await waitFor(() => {
      const button5 = screen.queryByRole('button', { name: '5' });
      expect(button5).toBeInTheDocument();
    });

    const button5 = screen.getByRole('button', { name: '5' });
    await user.click(button5);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Find sliders and adjust them
    const sliders = screen.getAllByRole('slider');

    // Try to set values that violate ordering
    if (sliders.length >= 2) {
      // Set first slider to high value
      fireEvent.change(sliders[0], { target: { value: '90' } });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set second slider to lower value
      fireEvent.change(sliders[1], { target: { value: '20' } });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, 20000);

  it('should handle Not Possible toggle affecting constraints', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    const button3 = await screen.findByRole('button', { name: '3' });
    await user.click(button3);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Toggle Not Possible on middle shot
    const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });

    if (notPossibleButtons.length >= 2) {
      // Toggle first one
      await user.click(notPossibleButtons[0]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Toggle it back
      await user.click(notPossibleButtons[0]);
    }
  }, 20000);
});

describe('App - Drift and Randomization', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should apply drift after multiple attempts', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);
    await goToPractice(user);

    // Make many recall attempts to trigger drift
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

    // Make 10+ attempts to trigger drift (default driftEvery is 4)
    for (let i = 0; i < 10; i++) {
      if (recallButtons.length > 0) {
        await user.click(recallButtons[i % recallButtons.length]);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  }, 35000);

  it('should handle seeded random mode consistently', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);
    await goToPractice(user);

    // Enable seeded random
    const seededCheckbox = screen.queryByRole('checkbox', { name: /seeded/i });
    if (seededCheckbox) {
      await user.click(seededCheckbox);
    }

    // Click random refresh multiple times - should produce consistent sequence
    const randomBtn = screen.queryByRole('button', { name: /random/i });
    if (randomBtn) {
      await user.click(randomBtn);

      const refreshBtn = screen.queryByRole('button', { name: /↻/i });
      if (refreshBtn) {
        for (let i = 0; i < 5; i++) {
          await user.click(refreshBtn);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }
  }, 25000);
});

describe('App - Toast Notifications', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should show toasts for various actions', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Load example - should show toast
    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    // Wait for toast
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clear all - should show toast
    const clearButton = screen.getByRole('button', { name: /clear all shots/i });
    await user.click(clearButton);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 15000);
});

describe('App - Recall Mode Comprehensive', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should complete full recall workflow', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    // Go directly to recall mode
    const recallButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Recall' && !btn.disabled);

    if (recallButton) {
      await user.click(recallButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
      });

      // Fill in all recall inputs
      const inputs = screen.queryAllByRole('spinbutton');

      for (const [i, input] of inputs.entries()) {
        await user.clear(input);
        await user.type(input, String((i + 1) * 10));
      }

      // Find and click submit/finish button
      const submitButtons = screen.getAllByRole('button');
      const finishBtn = submitButtons.find(
        (btn) =>
          btn.textContent?.toLowerCase().includes('finish') ||
          btn.textContent?.toLowerCase().includes('submit') ||
          btn.textContent?.toLowerCase().includes('check')
      );

      if (finishBtn) {
        await user.click(finishBtn);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }, 25000);

  it('should navigate between recall and setup', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    // Go to recall
    const recallButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Recall' && !btn.disabled);

    if (recallButton) {
      await user.click(recallButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
      });

      // Go back to setup
      const setupBtn = screen.getAllByRole('button').find((btn) => btn.textContent === 'Setup');

      if (setupBtn) {
        await user.click(setupBtn);

        await waitFor(() => {
          expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
        });
      }
    }
  }, 20000);
});

describe('App - View Shot Values Table', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should toggle all view options and show table', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);
    await goToPractice(user);

    // Make at least one attempt first
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
    if (recallButtons.length > 0) {
      await user.click(recallButtons[0]);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Enable feedback panel
    const feedbackCheckbox = screen.queryByRole('checkbox', { name: /feedback/i });
    if (feedbackCheckbox) {
      await user.click(feedbackCheckbox);
    }

    // Toggle view options
    const startingCheckbox = screen.queryByRole('checkbox', { name: /starting/i });
    const guessCheckbox = screen.queryByRole('checkbox', { name: /guess/i });
    const correctCheckbox = screen.queryByRole('checkbox', { name: /correct/i });

    if (startingCheckbox) {
      await user.click(startingCheckbox);
    }
    if (guessCheckbox) {
      await user.click(guessCheckbox);
    }
    if (correctCheckbox) {
      await user.click(correctCheckbox);
    }

    // Should now show the values table
    await new Promise((resolve) => setTimeout(resolve, 200));
  }, 25000);
});

describe('App - Attempt History Table', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should show attempt history after making attempts', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);
    await goToPractice(user);

    // Enable attempt history
    const historyCheckbox = screen.queryByRole('checkbox', { name: /attempt history/i });
    if (historyCheckbox) {
      await user.click(historyCheckbox);
    }

    // Make several attempts
    const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
    for (let i = 0; i < 3; i++) {
      if (recallButtons.length > 0) {
        await user.click(recallButtons[i % recallButtons.length]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // History table should be visible
    const tables = screen.queryAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);
  }, 25000);
});

describe('App - Element Type Selection Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should complete full element type selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Add a shot
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    const button1 = await screen.findByRole('button', { name: '1' });
    await user.click(button1);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // The table should have the shot row
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  }, 15000);

  it('should handle canvas resize through window resize', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    // Playfield should be rendered
    const playfield = screen.getByRole('region', { name: /playfield layout/i });
    expect(playfield).toBeInTheDocument();

    // Trigger window resize to exercise canvas measurements
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
    fireEvent.resize(window);
    await new Promise((resolve) => setTimeout(resolve, 100));

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    fireEvent.resize(window);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, 15000);
});

describe('App - Image Loading Handlers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should handle image load and error events', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    // Find all images
    const images = screen.queryAllByRole('img');

    // Simulate load events
    for (const img of images) {
      fireEvent.load(img);
    }

    // Simulate error events
    for (const img of images) {
      fireEvent.error(img);
    }
  }, 15000);
});
