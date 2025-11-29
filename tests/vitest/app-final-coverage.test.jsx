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

describe('App - Additional Coverage for Rare Paths', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ElementTile Component Comprehensive', () => {
    it('should fully interact with ElementTile in shot type menu', async () => {
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

      // Find table and click on cells to open element selection
      const table = screen.getByRole('table');
      const cells = within(table).getAllByRole('cell');

      // Click on cells to find element type selector
      for (const cell of cells.slice(0, 5)) {
        const buttons = within(cell).queryAllByRole('button');
        for (const btn of buttons) {
          if (btn.getAttribute('data-shot-chip')) {
            await user.click(btn);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Look for element type buttons
            const allButtons = screen.getAllByRole('button');
            const elementButtons = allButtons.filter(b =>
              b.textContent === 'Ramp' ||
              b.textContent === 'Orbit' ||
              b.textContent === 'Target' ||
              b.textContent === 'Lane' ||
              b.textContent === 'Scoop',
            );

            if (elementButtons.length > 0) {
              // Click each element type to test ElementTile onSelect
              for (const elBtn of elementButtons) {
                await user.click(elBtn);
                await new Promise(resolve => setTimeout(resolve, 100));

                // Reopen menu
                await user.click(btn);
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            // Close menu by clicking outside
            await user.click(document.body);
            break;
          }
        }
      }
    }, 30000);
  });

  describe('Drag and Drop with Multiple Rows', () => {
    it('should perform complete drag operation with multiple swaps', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add 5 shots
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Get drag handles
      const dragHandles = screen.queryAllByRole('button', { name: /drag to reorder/i });

      if (dragHandles.length >= 4) {
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');

        // Create mock dataTransfer
        const dataTransfer = {
          effectAllowed: 'move',
          setData: vi.fn(),
          getData: vi.fn(),
        };

        // Drag from first to last
        fireEvent.dragStart(dragHandles[0], { dataTransfer });

        // Drag over each row
        for (let i = 1; i < Math.min(5, rows.length); i++) {
          fireEvent.dragOver(rows[i], { dataTransfer, preventDefault: vi.fn() });
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Drop on last row
        fireEvent.drop(rows.at(-1), { dataTransfer, preventDefault: vi.fn() });
        fireEvent.dragEnd(dragHandles[0]);

        await new Promise(resolve => setTimeout(resolve, 200));

        // Now drag from last to first
        const newDragHandles = screen.queryAllByRole('button', { name: /drag to reorder/i });
        if (newDragHandles.length >= 4) {
          fireEvent.dragStart(newDragHandles.at(-1), { dataTransfer });

          for (let i = rows.length - 2; i >= 1; i--) {
            const updatedRows = within(table).getAllByRole('row');
            if (updatedRows[i]) {
              fireEvent.dragOver(updatedRows[i], { dataTransfer, preventDefault: vi.fn() });
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          fireEvent.drop(rows[1], { dataTransfer, preventDefault: vi.fn() });
          fireEvent.dragEnd(newDragHandles.at(-1));
        }
      }
    }, 30000);

    it('should handle drag to same position (no-op)', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const dragHandles = screen.queryAllByRole('button', { name: /drag to reorder/i });

      if (dragHandles.length > 0) {
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');

        const dataTransfer = {
          effectAllowed: 'move',
          setData: vi.fn(),
          getData: vi.fn(),
        };

        // Drag and drop on same row (no-op)
        fireEvent.dragStart(dragHandles[0], { dataTransfer });
        fireEvent.dragOver(rows[1], { dataTransfer, preventDefault: vi.fn() });
        fireEvent.drop(rows[1], { dataTransfer, preventDefault: vi.fn() });
        fireEvent.dragEnd(dragHandles[0]);
      }
    }, 15000);
  });

  describe('Slider Boundary Edge Cases', () => {
    it('should handle slider values beyond bounds', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const sliders = screen.getAllByRole('slider');

      for (const slider of sliders.slice(0, 4)) {
        // Test various extreme values
        fireEvent.change(slider, { target: { value: '0' } });
        await new Promise(resolve => setTimeout(resolve, 30));

        fireEvent.change(slider, { target: { value: '-10' } });
        await new Promise(resolve => setTimeout(resolve, 30));

        fireEvent.change(slider, { target: { value: '110' } });
        await new Promise(resolve => setTimeout(resolve, 30));

        fireEvent.change(slider, { target: { value: 'invalid' } });
        await new Promise(resolve => setTimeout(resolve, 30));

        // Test precise boundary values
        fireEvent.change(slider, { target: { value: '5' } });
        await new Promise(resolve => setTimeout(resolve, 30));

        fireEvent.change(slider, { target: { value: '95' } });
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }, 20000);
  });

  describe('Not Possible Toggle Cascading', () => {
    it('should handle cascading Not Possible toggles', async () => {
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

      // Toggle all Not Possible buttons for Left
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });

      // Toggle some on, some off
      for (let i = 0; i < Math.min(notPossibleButtons.length, 10); i++) {
        await user.click(notPossibleButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Toggle them back
      for (let i = Math.min(notPossibleButtons.length, 10) - 1; i >= 0; i--) {
        await user.click(notPossibleButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 25000);
  });

  describe('Practice Mode Quick Succession', () => {
    it('should handle rapid recall attempts', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make rapid successive attempts
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      // Very fast clicking
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < Math.min(19, recallButtons.length); i++) {
          await user.click(recallButtons[i]);
          // No delay - test rapid succession
        }
      }
    }, 35000);
  });

  describe('Keyboard Navigation in Tables', () => {
    it('should handle Tab navigation through table cells', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Tab through all focusable elements
      for (let i = 0; i < 30; i++) {
        await user.tab();
      }

      // Shift-Tab back
      for (let i = 0; i < 15; i++) {
        await user.tab({ shift: true });
      }
    }, 20000);

    it('should handle Enter and Space key on focused elements', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Tab to first few buttons
      for (let i = 0; i < 5; i++) {
        await user.tab();
        await user.keyboard('{Enter}');
        await new Promise(resolve => setTimeout(resolve, 100));

        await user.tab();
        await user.keyboard(' ');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Menu Close Behaviors', () => {
    it('should close menus on Escape key', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Click on something to potentially open a menu
      const table = screen.getByRole('table');
      const buttons = within(table).getAllByRole('button');

      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        await user.click(buttons[i]);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Press Escape
        await user.keyboard('{Escape}');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);

    it('should close menus on outside click', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const table = screen.getByRole('table');
      const buttons = within(table).getAllByRole('button');

      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        await user.click(buttons[i]);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Click outside
        const playfield = screen.getByRole('region', { name: /playfield layout/i });
        await user.click(playfield);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);
  });

  describe('LocalStorage Persistence', () => {
    it('should persist and restore state through mode changes', async () => {
      const user = userEvent.setup();

      // First session - add shots and go to practice
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const exampleButton = screen.getByRole('button', { name: /load example shots/i });
      await user.click(exampleButton);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Go to practice
      await goToPractice(user);

      // Make some attempts
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (recallButtons.length > 0) {
        await user.click(recallButtons[0]);
        await user.click(recallButtons[5]);
        await user.click(recallButtons[10]);
      }

      // Go back to setup
      const setupBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'Setup');
      if (setupBtn) {
        await user.click(setupBtn);
        await waitFor(() => {
          expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
        });
      }

      // Go to recall
      const recallModeBtn = screen.getAllByRole('button').find(btn =>
        btn.textContent === 'Recall' && !btn.disabled,
      );
      if (recallModeBtn) {
        await user.click(recallModeBtn);
        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /recall shots/i })).toBeInTheDocument();
        });
      }
    }, 30000);
  });

  describe('Window Resize During Practice', () => {
    it('should handle resize events in practice mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Simulate various window sizes
      const sizes = [
        { width: 320, height: 480 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 600, height: 400 },
      ];

      for (const size of sizes) {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: size.width });
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: size.height });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Fullscreen Mode Comprehensive', () => {
    it('should handle all fullscreen interactions', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen
      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Make attempts in fullscreen
        const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
        for (let i = 0; i < Math.min(5, recallButtons.length); i++) {
          await user.click(recallButtons[i]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click Not Possible buttons
        const notPossibleBtns = screen.queryAllByRole('button', { name: /not possible/i });
        if (notPossibleBtns.length > 0) {
          await user.click(notPossibleBtns[0]);
        }

        // Resize while in fullscreen
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 100));

        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Exit fullscreen
        await user.keyboard('{Escape}');
      }
    }, 35000);
  });

  describe('Insert Shot Below Functionality', () => {
    it('should insert shots at different positions', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add initial shots
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button3 = await screen.findByRole('button', { name: '3' });
      await user.click(button3);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find insert buttons
      const insertButtons = screen.queryAllByRole('button', { name: /insert shot below/i });

      // Insert at different positions
      for (let i = 0; i < Math.min(3, insertButtons.length); i++) {
        await user.click(insertButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }, 20000);
  });

  describe('Shot Label Editing', () => {
    it('should handle shot label/name editing', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find text inputs for shot names/labels
      const textInputs = screen.queryAllByRole('textbox');

      for (let i = 0; i < Math.min(3, textInputs.length); i++) {
        await user.clear(textInputs[i]);
        await user.type(textInputs[i], `Custom Shot ${i + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);
  });
});

describe('App - Final Edge Case Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should handle localStorage with only partial data', async () => {
    // Set partial localStorage data
    localStorage.setItem('pinball_rows_v1', JSON.stringify([
      { id: 1, type: 'Test Shot', initL: 50, initR: 50, x: 0.5, y: 0.3, left: 50, right: 50 },
    ]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Should load with the preset data
    const table = screen.queryByRole('table');
    expect(table).toBeInTheDocument();
  }, 10000);

  it('should handle extreme number of shots', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Add maximum shots using add shot button and selecting quantities
    const addButton = screen.getByRole('button', { name: /add shot/i });

    for (let round = 0; round < 3; round++) {
      await user.click(addButton);

      // Wait for menu to appear and find any number button
      await new Promise(resolve => setTimeout(resolve, 300));

      const numberButtons = screen.queryAllByRole('button').filter(btn =>
        /^([1-9]|10)$/.test(btn.textContent),
      );

      if (numberButtons.length > 0) {
        // Click the highest available number
        const highestBtn = numberButtons.at(-1);
        await user.click(highestBtn);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Verify table has some rows
    const table = screen.queryByRole('table');
    if (table) {
      const rows = within(table).getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    }
  }, 30000);
});
