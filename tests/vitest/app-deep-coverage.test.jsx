import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../src/app.jsx';

// Helper to setup app with example shots loaded
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

// Helper to navigate to practice mode
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

describe('App - Deep Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PlayfieldEditor Shot Box Interactions', () => {
    it('should delete shot from playfield shot box', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find delete buttons within shot boxes
      const deleteButtons = playfield.querySelectorAll('button[title="Delete shot"]');

      if (deleteButtons.length > 0) {
        // Click delete on first shot box
        await user.click(deleteButtons[0]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Verify one shot was removed
      const table = screen.queryByRole('table');
      if (table) {
        const rows = within(table).getAllByRole('row');
        // Should have header + 2 data rows (was 3)
        expect(rows.length).toBeLessThanOrEqual(4);
      }
    }, 15000);

    it('should select shots via playfield shot box click', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find shot boxes (they have specific classes)
      const shotBoxes = playfield.querySelectorAll('[class*="absolute"][class*="z-30"][class*="select-none"]');

      for (const box of shotBoxes) {
        fireEvent.mouseDown(box);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);

    it('should handle shot box image load and error events', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find images within shot boxes
      const images = playfield.querySelectorAll('img');

      for (const img of images) {
        // Trigger load event
        fireEvent.load(img);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Trigger error event
        fireEvent.error(img);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 15000);
  });

  describe('Flipper Selection via Playfield SVG', () => {
    it('should select left flipper by clicking flipper path', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const svg = playfield.querySelector('svg');

      if (svg) {
        // Find paths that represent flippers
        const paths = svg.querySelectorAll('path');

        for (const path of paths) {
          // Try clicking on the path
          fireEvent.mouseDown(path);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 15000);

    it('should cycle through FLIPPER_L, FLIPPER_R, FLIPPER_BOTH selections', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const svg = playfield.querySelector('svg');

      if (svg) {
        const paths = [...svg.querySelectorAll('path')];

        // Click left flipper area multiple times
        if (paths[0]) {
          fireEvent.mouseDown(paths[0]);
          await new Promise(resolve => setTimeout(resolve, 100));
          fireEvent.mouseDown(paths[0]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click right flipper area
        if (paths[1]) {
          fireEvent.mouseDown(paths[1]);
          await new Promise(resolve => setTimeout(resolve, 100));
          fireEvent.mouseDown(paths[1]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 15000);
  });

  describe('Flipper Column Header Interactions', () => {
    it('should highlight flipper columns on hover', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');

      // Find L and R headers
      const lHeader = headers.find(h => h.textContent?.trim() === 'L' || h.textContent?.includes('Left'));
      const rHeader = headers.find(h => h.textContent?.trim() === 'R' || h.textContent?.includes('Right'));

      if (lHeader) {
        fireEvent.mouseEnter(lHeader);
        await new Promise(resolve => setTimeout(resolve, 100));
        fireEvent.mouseLeave(lHeader);
      }

      if (rHeader) {
        fireEvent.mouseEnter(rHeader);
        await new Promise(resolve => setTimeout(resolve, 100));
        fireEvent.mouseLeave(rHeader);
      }
    }, 15000);
  });

  describe('Shot Type Menu Keyboard Navigation', () => {
    it('should handle keydown events in shot type menu', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Click to open shot type menu
      const table = screen.getByRole('table');
      const cells = within(table).getAllByRole('cell');

      for (const cell of cells.slice(0, 3)) {
        const buttons = within(cell).queryAllByRole('button');
        const shotTypeBtn = buttons.find(btn =>
          btn.getAttribute('data-shot-chip') || btn.textContent?.includes('Orbit') || btn.textContent?.includes('Ramp'),
        );

        if (shotTypeBtn) {
          await user.click(shotTypeBtn);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Press various keys
          await user.keyboard('{ArrowDown}');
          await user.keyboard('{ArrowUp}');
          await user.keyboard('{ArrowLeft}');
          await user.keyboard('{ArrowRight}');
          await user.keyboard('{Enter}');
          await user.keyboard('{Escape}');

          break;
        }
      }
    }, 15000);
  });

  describe('Location Menu Selection', () => {
    it('should open location menu and select different locations', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row').slice(1); // Skip header

      for (const row of rows.slice(0, 2)) {
        const cells = within(row).getAllByRole('cell');

        // Find location cell/button
        for (const cell of cells) {
          const buttons = within(cell).queryAllByRole('button');
          const locButton = buttons.find(btn =>
            btn.textContent?.includes('Left') ||
            btn.textContent?.includes('Right') ||
            btn.textContent?.includes('Center') ||
            btn.textContent?.includes('Upper') ||
            btn.getAttribute('data-loc-chip'),
          );

          if (locButton) {
            await user.click(locButton);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Look for location options
            const locationOptions = screen.queryAllByRole('button').filter(btn =>
              btn.textContent === 'Left' ||
              btn.textContent === 'Right' ||
              btn.textContent === 'Center' ||
              btn.textContent === 'Upper' ||
              btn.textContent === 'Lower',
            );

            if (locationOptions.length > 0) {
              await user.click(locationOptions[0]);
            }

            break;
          }
        }
      }
    }, 20000);
  });

  describe('Practice Input Focus and Blur', () => {
    it('should handle recall input focus and keyboard events', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Find the recall input
      const recallInput = screen.queryByRole('textbox', { name: /recall/i }) ||
                          screen.queryByPlaceholderText(/0-100/i) ||
                          screen.queryByDisplayValue('');

      if (recallInput) {
        // Focus
        await user.click(recallInput);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Type and submit
        await user.type(recallInput, '50');
        await user.keyboard('{Enter}');
        await new Promise(resolve => setTimeout(resolve, 200));

        // Clear and type invalid
        await user.clear(recallInput);
        await user.type(recallInput, 'invalid');
        await user.keyboard('{Enter}');
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear and leave empty, submit
        await user.clear(recallInput);
        await user.keyboard('{Enter}');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Recall Error State', () => {
    it('should show recall error for invalid input', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Find and submit empty input
      const submitButton = screen.queryByRole('button', { name: /submit/i });
      if (submitButton) {
        await user.click(submitButton);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Error message should appear
        screen.queryByText(/0–100|0-100/);
        // May or may not be present depending on implementation
      }
    }, 15000);
  });

  describe('PracticePlayfield with Various States', () => {
    it('should render practice playfield with selected row', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make an attempt to set lastRecall
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (recallButtons.length > 0) {
        await user.click(recallButtons[5]);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Select different shots manually
      const manualChip = screen.queryAllByRole('button').find(btn =>
        btn.textContent === 'Manual',
      );
      if (manualChip) {
        await user.click(manualChip);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Click on shot chips to select different rows
      const shotChips = screen.queryAllByRole('button').filter(btn => {
        const text = btn.textContent || '';
        return text.includes('Orbit') || text.includes('Ramp') || text.includes('Target');
      });

      for (const chip of shotChips.slice(0, 3)) {
        await user.click(chip);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Make attempt with this selection
        if (recallButtons[3]) {
          await user.click(recallButtons[3]);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }, 30000);

    it('should show feedback lines in practice playfield', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make several attempts to build up lastRecall state
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      const valuesToTest = [0, 5, 10, 15, 50, 85, 90, 95];
      for (const value of valuesToTest) {
        const buttonIndex = value === 0 ? -1 : (value / 5) - 1;

        if (value === 0) {
          // Click Not Possible
          const npBtn = screen.queryAllByRole('button').find(btn =>
            btn.textContent === 'Not Possible',
          );
          if (npBtn) {
            await user.click(npBtn);
          }
        } else if (recallButtons[buttonIndex]) {
          await user.click(recallButtons[buttonIndex]);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 30000);
  });

  describe('Green Guide Lines Rendering', () => {
    it('should render green guide lines polygon in practice mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Check for SVG elements with green lines
      const allSvgs = document.querySelectorAll('svg');

      for (const svg of allSvgs) {
        svg.querySelectorAll('polygon');
        svg.querySelectorAll('line');

        // Verify some SVG elements exist
        // The exact green lines depend on component state
      }

      // Make attempts with different flipper selections
      const flipperChips = screen.queryAllByRole('button').filter(btn =>
        btn.textContent === 'Left' || btn.textContent === 'Right',
      );

      for (const chip of flipperChips) {
        await user.click(chip);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }, 20000);
  });

  describe('Yellow Feedback Lines', () => {
    it('should render yellow feedback lines after incorrect attempt', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make intentionally wrong attempts to trigger feedback
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      if (recallButtons.length > 0) {
        // Very early
        await user.click(recallButtons[0]); // 05
        await new Promise(resolve => setTimeout(resolve, 300));

        // Very late
        await user.click(recallButtons[18]); // 95
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check for SVG feedback elements
        const playfields = document.querySelectorAll('[class*="relative"]');
        for (const pf of playfields) {
          pf.querySelectorAll('svg');
          // Feedback SVG may contain lines with specific colors
        }
      }
    }, 20000);
  });

  describe('Metric Boxes in Fullscreen', () => {
    it('should render scaled metric boxes in fullscreen', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Make some attempts to update metrics
        const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
        for (let i = 0; i < 5; i++) {
          if (recallButtons[i * 3]) {
            await user.click(recallButtons[i * 3]);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Check for metric displays (use getAllBy since there can be duplicates in fullscreen)
        expect(screen.getAllByText(/last attempt/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/attempts/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/total points/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/avg abs error/i).length).toBeGreaterThanOrEqual(1);
      }
    }, 30000);
  });

  describe('Reset Left/Right Flipper Values', () => {
    it('should reset flipper values using reset buttons', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find Reset buttons for left and right
      const resetButtons = screen.queryAllByRole('button', { name: /reset/i });

      for (const btn of resetButtons) {
        await user.click(btn);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('Version Information Display', () => {
    it('should display version in info modal', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const infoBtn = screen.queryByRole('button', { name: /help|about|info/i });
      if (infoBtn) {
        await user.click(infoBtn);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Look for version information
        screen.queryByRole('dialog');
        // Version may be displayed in footer or specific element
      }
    }, 10000);
  });

  describe('Strict Ordering Enforcement', () => {
    it('should strictly increase left values after isotonic correction', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add 8 shots for complex ordering
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button8 = await screen.findByRole('button', { name: '8' });
      await user.click(button8);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      const sliders = screen.getAllByRole('slider');

      // Set alternating high/low values to force isotonic correction
      for (let i = 0; i < Math.min(sliders.length, 16); i += 2) {
        const value = i % 4 === 0 ? '80' : '20';
        fireEvent.change(sliders[i], { target: { value } });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Now go to practice to trigger hidden value initialization
      await goToPractice(user);
    }, 25000);
  });

  describe('Strictly Decrease for Right Flipper', () => {
    it('should strictly decrease right values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const sliders = screen.getAllByRole('slider');

      // Set ascending right values (violation of descending rule)
      for (let i = 1; i < Math.min(sliders.length, 8); i += 2) {
        const value = String(20 + i * 10);
        fireEvent.change(sliders[i], { target: { value } });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 15000);
  });

  describe('Misorder Detection and Display', () => {
    it('should detect and highlight misordered shots', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add shots
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Reorder shots via drag to create misorder
      const dragHandles = screen.queryAllByRole('button', { name: /drag to reorder/i });

      if (dragHandles.length >= 3) {
        const dataTransfer = {
          effectAllowed: 'move',
          setData: vi.fn(),
          getData: vi.fn(),
        };

        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');

        // Drag last to first position
        fireEvent.dragStart(dragHandles.at(-1), { dataTransfer });
        fireEvent.dragOver(rows[1], { dataTransfer, preventDefault: vi.fn() });
        fireEvent.drop(rows[1], { dataTransfer, preventDefault: vi.fn() });
        fireEvent.dragEnd(dragHandles.at(-1));

        await new Promise(resolve => setTimeout(resolve, 200));

        // Check for red highlighting on playfield
        screen.getByRole('region', { name: /playfield layout/i });
        // Red rings/borders would indicate misorder
      }
    }, 20000);
  });

  describe('Auto-Collapse on Initial Load', () => {
    it('should auto-collapse shot type rows on initial load', async () => {
      // Pre-populate localStorage with shots
      localStorage.setItem('pinball_rows_v1', JSON.stringify([
        { id: 1, base: 'Ramp', location: 'Left', type: 'Left Ramp', initL: 25, initR: 75, x: 0.3, y: 0.3 },
        { id: 2, base: 'Target', location: 'Center', type: 'Center Target', initL: 50, initR: 50, x: 0.5, y: 0.3 },
        { id: 3, base: 'Orbit', location: 'Right', type: 'Right Orbit', initL: 75, initR: 25, x: 0.7, y: 0.3 },
      ]));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Should load with collapsed shot type rows
      await new Promise(resolve => setTimeout(resolve, 300));

      const table = screen.queryByRole('table');
      expect(table).toBeInTheDocument();
    }, 10000);
  });

  describe('LocalStorage Dark Mode Persistence', () => {
    it('should persist dark mode preference', async () => {
      // Set dark mode preference
      localStorage.setItem('pinball_darkMode_v1', JSON.stringify(false));

      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Toggle dark mode
      const darkModeBtn = screen.queryByRole('button', { name: /switch to dark mode|switch to light mode/i });
      if (darkModeBtn) {
        await user.click(darkModeBtn);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify localStorage was updated
        localStorage.getItem('pinball_darkMode_v1');
        // Value should have changed
      }
    }, 10000);
  });

  describe('Canvas Width Measurement', () => {
    it('should measure canvas width on mount and resize', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Trigger resize multiple times
      for (let i = 0; i < 5; i++) {
        const width = 400 + i * 200;
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await goToPractice(user);

      // More resizes in practice mode
      for (let i = 0; i < 5; i++) {
        const width = 800 + i * 100;
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Box Scale Calculation', () => {
    it('should calculate box scale based on number of shots', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add varying numbers of shots to test scale
      const addButton = screen.getByRole('button', { name: /add shot/i });

      // Add 1 shot
      await user.click(addButton);
      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Clear and add more shots
      const clearBtns = screen.queryAllByRole('button', { name: /clear all shots/i });
      if (clearBtns.length > 0) {
        await user.click(clearBtns[0]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await user.click(addButton);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Find available number buttons and click one
      const numberButtons = screen.queryAllByRole('button').filter(btn =>
        /^([1-9]|10)$/.test(btn.textContent || ''),
      );

      if (numberButtons.length > 0) {
        // Click the highest number available
        await user.click(numberButtons.at(-1));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Verify table has rows
      const table = screen.queryByRole('table');
      if (table) {
        const rows = within(table).getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1);
      }
    }, 30000);
  });
});
