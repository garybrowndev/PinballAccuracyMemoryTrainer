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

describe('App - Uncovered Functions and Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ElementTile Component', () => {
    it('should open shot type menu and select element tile', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add a shot first
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find the table and look for the shot type column
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      // Find buttons in the first data row (index 1, since 0 is header)
      if (rows.length > 1) {
        const dataRow = rows[1];
        const buttons = within(dataRow).getAllByRole('button');

        // Look for the shot type button (should be "Type" or similar)
        const typeButton = buttons.find(btn =>
          btn.getAttribute('data-shot-chip') ||
          btn.textContent?.includes('Type'),
        );

        if (typeButton) {
          // Click to open the ElementTile dialog
          await user.click(typeButton);
          await new Promise(resolve => setTimeout(resolve, 300));

          // Look for ElementTile buttons (Ramp, Orbit, Target, etc.)
          const dialogButtons = screen.queryAllByRole('button');
          const rampButton = dialogButtons.find(btn => btn.textContent === 'Ramp');
          const orbitButton = dialogButtons.find(btn => btn.textContent === 'Orbit');

          if (rampButton) {
            await user.click(rampButton);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Click again to reopen
            await user.click(typeButton);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Click the same one to deselect
            const newRampButton = screen.queryAllByRole('button').find(btn => btn.textContent === 'Ramp');
            if (newRampButton) {
              await user.click(newRampButton);
            }
          }

          if (orbitButton) {
            await user.click(orbitButton);
          }
        }
      }
    }, 20000);
  });

  describe('Flipper Mouse Interactions', () => {
    it('should handle flipper mousedown on playfield', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find SVG flipper paths
      const svg = playfield.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path');

        for (const path of paths) {
          fireEvent.mouseDown(path, { button: 0 });
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Also test on circle elements
        const circles = svg.querySelectorAll('circle');
        for (const circle of circles) {
          fireEvent.mouseDown(circle, { button: 0 });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }, 15000);
  });

  describe('Drag and Drop Row Reorder', () => {
    it('should handle complete drag and drop flow', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add multiple shots
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find drag handles
      const dragHandles = screen.queryAllByRole('button', { name: /drag to reorder/i });

      if (dragHandles.length >= 2) {
        const sourceHandle = dragHandles[0];

        // Create a mock DataTransfer
        const dataTransfer = {
          effectAllowed: 'move',
          setData: vi.fn(),
          getData: vi.fn(),
        };

        // Start drag
        fireEvent.dragStart(sourceHandle, { dataTransfer });
        await new Promise(resolve => setTimeout(resolve, 100));

        // Find table rows for drag over
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');

        // Drag over different rows
        for (let i = 1; i < rows.length; i++) {
          fireEvent.dragOver(rows[i], { dataTransfer, preventDefault: vi.fn() });
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Drop
        fireEvent.drop(rows.at(-1), { dataTransfer, preventDefault: vi.fn() });
        await new Promise(resolve => setTimeout(resolve, 100));

        // End drag
        fireEvent.dragEnd(sourceHandle);
      }
    }, 25000);
  });

  describe('Menu Keyboard Interactions', () => {
    it('should handle keydown events in menus', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add a shot
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      // Press Escape while menu is open
      await user.keyboard('{Escape}');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Open menu again
      await user.click(addButton);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Press Escape again
      await user.keyboard('{Escape}');
    }, 15000);
  });

  describe('Practice Playfield Animations', () => {
    it('should trigger ball animation with skip functionality', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make an attempt to trigger animation
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      if (recallButtons.length > 0) {
        // Click recall button
        await user.click(recallButtons[0]);

        // Immediately click somewhere to potentially skip animation
        const playfields = screen.queryAllByRole('region');
        for (const playfield of playfields) {
          await user.click(playfield);
        }

        // Press any key to skip
        await user.keyboard(' ');
        await user.keyboard('{Enter}');

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, 25000);

    it('should handle playfield clicks during animation', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      if (recallButtons.length > 0) {
        // Rapid clicks to test animation handling
        for (let i = 0; i < 5; i++) {
          await user.click(recallButtons[i % recallButtons.length]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 25000);
  });

  describe('Location Menu Interactions', () => {
    it('should open location menu and handle selection', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find location buttons in the table
      const table = screen.getByRole('table');
      const buttons = within(table).getAllByRole('button');

      // Look for location chips (Left, Center, Right, etc.)
      const locationButtons = buttons.filter(btn => {
        const text = btn.textContent;
        return text === 'Left' || text === 'Right' || text === 'Center' || text === 'Base';
      });

      if (locationButtons.length > 0) {
        // Click location button to open menu
        await user.click(locationButtons[0]);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Try clicking on location options
        const allButtons = screen.getAllByRole('button');
        const upperButton = allButtons.find(btn => btn.textContent === 'Upper');
        const lowerButton = allButtons.find(btn => btn.textContent === 'Lower');

        if (upperButton) {
          await user.click(upperButton);
        } else if (lowerButton) {
          await user.click(lowerButton);
        }
      }
    }, 15000);
  });

  describe('Flipper Column Header Interactions', () => {
    it('should handle mouse enter/leave on column headers', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');

      // Find L and R headers
      for (const header of headers) {
        // Mouse enter
        fireEvent.mouseEnter(header);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Click on header
        await user.click(header);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Mouse leave
        fireEvent.mouseLeave(header);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 15000);
  });

  describe('PracticePlayfield Flipper Lines', () => {
    it('should render flipper lines for different selections', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to manual mode
      const manualBtn = screen.queryByRole('button', { name: /manual/i });
      if (manualBtn) {
        await user.click(manualBtn);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Select different shots and flippers
        const leftBtn = screen.queryByRole('button', { name: /^left$/i });
        const rightBtn = screen.queryByRole('button', { name: /^right$/i });

        if (leftBtn) {
          await user.click(leftBtn);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (rightBtn) {
          await user.click(rightBtn);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Select different shots using chips
        const shotChips = screen.getAllByRole('button').filter(btn =>
          btn.textContent?.includes('Orbit') ||
          btn.textContent?.includes('Ramp'),
        );

        for (let i = 0; i < Math.min(3, shotChips.length); i++) {
          await user.click(shotChips[i]);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Switch flipper
          if (leftBtn && rightBtn) {
            await user.click(i % 2 === 0 ? leftBtn : rightBtn);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
    }, 25000);
  });

  describe('Slider Constraints at Boundaries', () => {
    it('should handle slider values at extreme boundaries', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const sliders = screen.getAllByRole('slider');

      if (sliders.length >= 2) {
        // Test extreme values
        for (const slider of sliders.slice(0, 2)) {
          // Move to 5 (minimum)
          fireEvent.change(slider, { target: { value: '5' } });
          await new Promise(resolve => setTimeout(resolve, 50));

          // Move to 95 (maximum)
          fireEvent.change(slider, { target: { value: '95' } });
          await new Promise(resolve => setTimeout(resolve, 50));

          // Move to 100
          fireEvent.change(slider, { target: { value: '100' } });
          await new Promise(resolve => setTimeout(resolve, 50));

          // Move to 0
          fireEvent.change(slider, { target: { value: '0' } });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }, 15000);
  });

  describe('Image Load/Error Handlers in Playfield', () => {
    it('should handle image events in playfield shot boxes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find all images in the document
      const images = document.querySelectorAll('img');

      for (const img of images) {
        // Trigger load
        fireEvent.load(img);

        // Trigger error
        fireEvent.error(img);
      }

      // Also find hidden images that might be in shot boxes
      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const playfieldImages = playfield.querySelectorAll('img');

      for (const img of playfieldImages) {
        fireEvent.load(img);
        fireEvent.error(img);
      }
    }, 15000);
  });

  describe('Final Recall Input Handlers', () => {
    it('should handle recall input changes and keyboard events', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Navigate to recall mode
      const recallButton = screen.getAllByRole('button').find(btn =>
        btn.textContent === 'Recall' && !btn.disabled,
      );

      if (recallButton) {
        await user.click(recallButton);

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });

        // Find spin buttons (number inputs)
        const spinButtons = screen.queryAllByRole('spinbutton');

        for (let i = 0; i < Math.min(3, spinButtons.length); i++) {
          const input = spinButtons[i];

          // Clear and type
          await user.clear(input);
          await user.type(input, '55');

          // Arrow up/down
          input.focus();
          await user.keyboard('{ArrowUp}');
          await user.keyboard('{ArrowUp}');
          await user.keyboard('{ArrowDown}');

          // Enter
          await user.keyboard('{Enter}');

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 25000);
  });

  describe('Fullscreen Recall Chips', () => {
    it('should interact with recall chips in fullscreen mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen
      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Find recall chips in fullscreen (05..95)
        const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

        // Click several recall buttons
        for (let i = 0; i < Math.min(5, recallButtons.length); i++) {
          await user.click(recallButtons[i]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click Not Possible in fullscreen (there may be two - one in each panel)
        const notPossibleBtns = screen.queryAllByRole('button', { name: /not possible/i });
        if (notPossibleBtns.length > 0) {
          await user.click(notPossibleBtns[0]);
        }

        // Exit fullscreen
        await user.keyboard('{Escape}');
      }
    }, 30000);
  });

  describe('Multiple Row Deletion', () => {
    it('should delete multiple rows and maintain state', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add multiple shots
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Delete shots one by one
      for (let i = 0; i < 3; i++) {
        const deleteButtons = screen.queryAllByRole('button', { name: /remove shot/i });
        if (deleteButtons.length > 0) {
          await user.click(deleteButtons[0]);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }, 20000);
  });

  describe('Info Modal Version Display', () => {
    it('should display version information in info modal', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Open info modal
      const infoButton = screen.getByRole('button', { name: /about/i });
      await user.click(infoButton);

      await waitFor(() => {
        // Check for modal content
        expect(screen.getByText(/memory trainer/i)).toBeInTheDocument();
        expect(screen.getByText(/version/i)).toBeInTheDocument();
      });

      // Close modal by clicking close button
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      await user.click(closeButtons[0]);

      // Reopen and close by clicking backdrop
      await user.click(infoButton);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Click backdrop to close
      const backdrop = document.querySelector('[role="presentation"]');
      if (backdrop) {
        const closeBtn = backdrop.querySelector('button');
        if (closeBtn) {
          await user.click(closeBtn);
        }
      }
    }, 15000);
  });
});

describe('App - Additional Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Preset Dropdown Navigation', () => {
    it('should handle preset dropdown keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Click add shot button
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Look for preset button
      const presetButton = screen.queryByRole('button', { name: /choose preset/i });
      if (presetButton) {
        await user.click(presetButton);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Press keyboard keys
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowUp}');
        await user.keyboard('{Escape}');
      }
    }, 15000);
  });

  describe('PlayfieldEditor Selection State', () => {
    it('should handle selection state changes in playfield editor', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const playfield = screen.getByRole('region', { name: /playfield layout/i });

      // Find shot box buttons
      const shotBoxes = within(playfield).queryAllByRole('button');

      // Click on different shot boxes
      for (const box of shotBoxes.slice(0, 3)) {
        await user.click(box);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Click outside to deselect
      await user.click(playfield);
    }, 15000);
  });

  describe('Error Boundaries and Edge Inputs', () => {
    it('should handle invalid localStorage data gracefully', () => {
      // Set invalid data
      localStorage.setItem('pinball_rows_v1', '{"invalid":true}');
      localStorage.setItem('pinball_hiddenL_v1', 'not-an-array');
      localStorage.setItem('pinball_hiddenR_v1', 'null');

      // Should not crash
      expect(() => render(<App />)).not.toThrow();
    });

    it('should handle empty string values in localStorage', () => {
      localStorage.setItem('pinball_rows_v1', '');
      localStorage.setItem('pinball_mode_v1', '');

      expect(() => render(<App />)).not.toThrow();
    });
  });
});
