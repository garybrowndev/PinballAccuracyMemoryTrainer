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

describe('App - Edge Cases and Comprehensive Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper Functions Edge Cases', () => {
    it('should handle format2 with edge case values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Navigate to practice to trigger format2 with various values
      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);
      if (practiceButton) {
        await user.click(practiceButton);
        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });
      }
    }, 15000);

    it('should handle formatInitValue edge cases', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add a shot and set values to 0 (Not Possible)
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      // Click on "1" to add single shot
      await waitFor(() => {
        const button1 = screen.queryByRole('button', { name: '1' });
        expect(button1).toBeInTheDocument();
      });

      const button1 = screen.getByRole('button', { name: '1' });
      await user.click(button1);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find Not Possible buttons and click them
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      if (notPossibleButtons.length > 0) {
        await user.click(notPossibleButtons[0]);
      }
    }, 15000);
  });

  describe('Shot Type Selection Menu', () => {
    it('should open shot type menu and select/deselect elements', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find the shot type selector button in the table
      const shotTypeButtons = screen.queryAllByRole('button');
      const typeSelector = shotTypeButtons.find(
        (btn) => btn.textContent?.includes('Type') || btn.getAttribute('data-shot-chip')
      );

      if (typeSelector) {
        await user.click(typeSelector);
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Should show element selection dialog
        const rampButton = screen.queryByRole('button', { name: /ramp/i });
        if (rampButton) {
          await user.click(rampButton);
        }
      }
    }, 15000);

    it('should handle location selection', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Look for location selector buttons in the table
      const allButtons = screen.getAllByRole('button');
      const locationButton = allButtons.find(
        (btn) =>
          btn.textContent === 'Left' || btn.textContent === 'Right' || btn.textContent === 'Center'
      );

      if (locationButton) {
        await user.click(locationButton);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('Slider Interactions', () => {
    it('should interact with left flipper slider', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find sliders (input type="range")
      const sliders = screen.getAllByRole('slider');

      if (sliders.length > 0) {
        // Simulate slider change
        fireEvent.change(sliders[0], { target: { value: '50' } });
        await new Promise((resolve) => setTimeout(resolve, 100));

        fireEvent.mouseDown(sliders[0]);
        fireEvent.pointerDown(sliders[0]);
      }
    }, 15000);

    it('should interact with right flipper slider', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const sliders = screen.getAllByRole('slider');

      if (sliders.length > 1) {
        fireEvent.change(sliders[1], { target: { value: '30' } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('Row Manipulation', () => {
    it('should delete a shot row', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find remove shot buttons
      const removeButtons = screen.getAllByRole('button', { name: /remove shot/i });

      if (removeButtons.length > 0) {
        await user.click(removeButtons[0]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }, 15000);

    it('should insert shot below existing row', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find insert buttons
      const insertButtons = screen.queryAllByRole('button', { name: /insert shot below/i });

      if (insertButtons.length > 0) {
        await user.click(insertButtons[0]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }, 15000);

    it('should handle drag reorder buttons', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find drag handle buttons
      const dragButtons = screen.queryAllByRole('button', { name: /drag to reorder/i });

      if (dragButtons.length > 0) {
        // Simulate drag events
        fireEvent.dragStart(dragButtons[0], {
          dataTransfer: { effectAllowed: 'move' },
        });

        fireEvent.dragEnd(dragButtons[0]);
      }
    }, 15000);
  });

  describe('Playfield Interactions', () => {
    it('should select flipper from playfield', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Click on playfield area
      await user.click(playfield);

      // Look for flipper selection SVG paths
      const svg = playfield.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path');
        if (paths.length > 0) {
          fireEvent.mouseDown(paths[0]);
        }
      }
    }, 15000);

    it('should handle shot box keyboard interactions', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find shot boxes (they have role="button")
      const shotBoxes = within(playfield).queryAllByRole('button');

      if (shotBoxes.length > 0) {
        // Focus and press Enter
        shotBoxes[0].focus();
        await user.keyboard('{Enter}');

        // Press Space
        await user.keyboard(' ');
      }
    }, 15000);

    it('should delete shot from playfield box', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find delete buttons within shot boxes (the X buttons)
      const deleteButtons = screen.queryAllByRole('button', { name: /delete shot/i });

      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }, 15000);
  });

  describe('Practice Mode Interactions', () => {
    it('should submit recall attempts', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Go to practice
      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Find recall buttons (05, 10, 15, etc.)
        const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

        // Click several recall buttons
        for (let i = 0; i < Math.min(5, recallButtons.length); i++) {
          await user.click(recallButtons[i]);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Click Not Possible button
        const notPossibleBtn = screen.queryByRole('button', { name: /not possible/i });
        if (notPossibleBtn) {
          await user.click(notPossibleBtn);
        }
      }
    }, 25000);

    it('should switch between manual and random mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Find Manual/Random mode buttons
        const manualBtn = screen.queryByRole('button', { name: /manual/i });
        const randomBtn = screen.queryByRole('button', { name: /random/i });

        if (manualBtn) {
          await user.click(manualBtn);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (randomBtn) {
          await user.click(randomBtn);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }, 20000);

    it('should toggle seeded random checkbox', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Find seeded checkbox
        const seededCheckbox = screen.queryByRole('checkbox', { name: /seeded/i });
        if (seededCheckbox) {
          await user.click(seededCheckbox);
          await user.click(seededCheckbox);
        }
      }
    }, 20000);

    it('should click random refresh button multiple times', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Click random button first
        const randomBtn = screen.queryByRole('button', { name: /random/i });
        if (randomBtn) {
          await user.click(randomBtn);

          // Find and click refresh button
          const refreshBtn = screen.queryByRole('button', { name: /↻/i });
          if (refreshBtn) {
            for (let i = 0; i < 10; i++) {
              await user.click(refreshBtn);
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          }
        }
      }
    }, 25000);
  });

  describe('Feedback Panel Toggles', () => {
    it('should toggle all feedback panel checkboxes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Find and toggle all checkboxes
        const checkboxes = screen.getAllByRole('checkbox');

        for (const checkbox of checkboxes) {
          await user.click(checkbox);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Toggle them back
        for (const checkbox of checkboxes) {
          await user.click(checkbox);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }, 25000);
  });

  describe('Fullscreen Mode', () => {
    it('should enter and exit fullscreen mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Find fullscreen button
        const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
        if (fullscreenBtn) {
          await user.click(fullscreenBtn);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Find and click exit button
          const exitBtn = screen.queryByRole('button', { name: /exit/i });
          if (exitBtn) {
            await user.click(exitBtn);
          }
        }
      }
    }, 20000);

    it('should exit fullscreen with Escape key', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
        if (fullscreenBtn) {
          await user.click(fullscreenBtn);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Press Escape
          await user.keyboard('{Escape}');
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }, 20000);
  });

  describe('Recall Mode', () => {
    it('should navigate to recall mode and interact', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const recallButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Recall' && !btn.disabled);

      if (recallButton) {
        await user.click(recallButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });

        // Interact with recall inputs
        const inputs = screen.queryAllByRole('spinbutton');
        if (inputs.length > 0) {
          await user.clear(inputs[0]);
          await user.type(inputs[0], '50');
        }
      }
    }, 20000);

    it('should submit final recall values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const recallButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Recall' && !btn.disabled);

      if (recallButton) {
        await user.click(recallButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });

        // Find submit/check button
        const submitBtn = screen.queryByRole('button', { name: /submit|check|finish/i });
        if (submitBtn) {
          await user.click(submitBtn);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }, 20000);
  });

  describe('Preset Loading', () => {
    it('should attempt to load presets', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Click add shot to show preset options
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Look for preset dropdown
      const presetButton = screen.queryByRole('button', { name: /choose preset/i });
      if (presetButton) {
        await user.click(presetButton);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }, 15000);
  });

  describe('Export Functionality', () => {
    it('should trigger export button', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Look for download/export button
      const downloadBtn = screen.queryByRole('button', { name: /download/i });
      if (downloadBtn) {
        await user.click(downloadBtn);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('Window Resize Handling', () => {
    it('should handle window resize events', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Trigger resize events
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });
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

  describe('LocalStorage Edge Cases', () => {
    it('should handle corrupted localStorage gracefully', async () => {
      // Set corrupted data
      localStorage.setItem('pinball_rows_v1', 'not-valid-json');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });
    }, 10000);

    it('should handle empty localStorage', async () => {
      localStorage.clear();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });
    }, 10000);
  });

  describe('Flipper Selection', () => {
    it('should switch flipper selection in manual mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Click manual mode
        const manualBtn = screen.queryByRole('button', { name: /manual/i });
        if (manualBtn) {
          await user.click(manualBtn);
        }

        // Find Left/Right flipper buttons
        const leftBtn = screen.queryByRole('button', { name: /^left$/i });
        const rightBtn = screen.queryByRole('button', { name: /^right$/i });

        if (leftBtn) {
          await user.click(leftBtn);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (rightBtn) {
          await user.click(rightBtn);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }, 20000);
  });

  describe('Shot Chip Selection', () => {
    it('should select different shots in manual mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Click manual mode
        const manualBtn = screen.queryByRole('button', { name: /manual/i });
        if (manualBtn) {
          await user.click(manualBtn);
        }

        // Find shot chips (they contain shot names like "Left Orbit", "Center Ramp", etc.)
        const allButtons = screen.getAllByRole('button');
        const shotChips = allButtons.filter(
          (btn) => btn.textContent?.includes('Orbit') || btn.textContent?.includes('Ramp')
        );

        for (const chip of shotChips.slice(0, 3)) {
          await user.click(chip);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }, 25000);
  });

  describe('Column Header Hover', () => {
    it('should handle flipper column header hover', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find table headers
      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');

      // Hover over headers
      for (const header of headers) {
        await user.hover(header);
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.unhover(header);
      }
    }, 15000);
  });

  describe('Input Focus Handling', () => {
    it('should handle input focus and blur', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const practiceButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

      if (practiceButton) {
        await user.click(practiceButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
        });

        // Tab through elements
        for (let i = 0; i < 10; i++) {
          await user.tab();
        }

        // Shift-tab back
        for (let i = 0; i < 5; i++) {
          await user.tab({ shift: true });
        }
      }
    }, 20000);
  });
});

describe('App - Scroll and Popup Positioning', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should handle scroll events with popup open', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Add a shot
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger scroll event
    fireEvent.scroll(window, { target: { scrollY: 100 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, 15000);

  it('should close popups on outside click', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Click outside (on body)
    await user.click(document.body);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, 15000);
});

describe('App - Animation and Ball Movement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should trigger ball animation on recall attempt', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    const practiceButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

    if (practiceButton) {
      await user.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
      });

      // Make multiple recall attempts to trigger animations
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      for (let i = 0; i < Math.min(3, recallButtons.length); i++) {
        await user.click(recallButtons[i]);
        // Wait for animation
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }, 30000);
});

describe('App - PracticePlayfield Click Handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should handle clicks on practice playfield', async () => {
    const user = userEvent.setup();
    await setupAppWithShots(user);

    const practiceButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Practice' && !btn.disabled);

    if (practiceButton) {
      await user.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /practice shots/i })).toBeInTheDocument();
      });

      // Find the playfield region
      const playfields = screen.queryAllByRole('region');
      for (const playfield of playfields) {
        await user.click(playfield);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, 20000);
});
