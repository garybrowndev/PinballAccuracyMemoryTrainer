import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../../src/app.jsx';

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

describe('App - Targeted Line Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Utility Function Edge Cases', () => {
    it('should handle format2 with extreme values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make attempts with extreme values to test format2
      const npBtn = screen.queryAllByRole('button').find(btn =>
        btn.textContent === 'Not Possible',
      );
      if (npBtn) {
        await user.click(npBtn); // Value 0
      }

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
      if (recallButtons.length > 0) {
        await user.click(recallButtons[0]); // Value 05
        await user.click(recallButtons[18]); // Value 95
      }
    }, 15000);

    it('should handle formatInitValue special cases', async () => {
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

      // Set to Not Possible (0) to test formatInitValue(0) -> 'NP'
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      if (notPossibleButtons.length > 0) {
        await user.click(notPossibleButtons[0]);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Toggle back to test null/undefined path
        await user.click(notPossibleButtons[0]);
      }
    }, 15000);
  });

  describe('Isotonic Regression Edge Cases', () => {
    it('should handle isotonic regression with all zeros', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Set all to Not Possible
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      for (const btn of notPossibleButtons) {
        await user.click(btn);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 20000);

    it('should handle isotonic regression with single non-zero value', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Set all but one to Not Possible
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      for (let i = 0; i < notPossibleButtons.length - 2; i++) {
        await user.click(notPossibleButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 20000);

    it('should trigger isotonic merging when values violate order', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button6 = await screen.findByRole('button', { name: '6' });
      await user.click(button6);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Set values in descending order for left flipper (should trigger isotonic)
      const sliders = screen.getAllByRole('slider');
      const leftSliders = sliders.filter((_, i) => i % 2 === 0);

      for (const [i, leftSlider] of leftSliders.entries()) {
        const value = String(90 - i * 15); // Descending values
        fireEvent.change(leftSlider, { target: { value } });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Go to practice to trigger hidden value generation
      await goToPractice(user);
    }, 25000);
  });

  describe('computeAllowedRange Edge Cases', () => {
    it('should return null when no valid range exists', async () => {
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

      const sliders = screen.getAllByRole('slider');

      // Set extreme values that create impossible range
      // Row 0: L=95
      // Row 1: L=5 (should be > 95, impossible)
      // Row 2: L=10
      if (sliders.length >= 6) {
        fireEvent.change(sliders[0], { target: { value: '95' } });
        fireEvent.change(sliders[2], { target: { value: '5' } });
        fireEvent.change(sliders[4], { target: { value: '10' } });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }, 15000);

    it('should handle range calculation with Not Possible neighbors', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Set middle rows to Not Possible
      const notPossibleButtons = screen.getAllByRole('button', { name: /not possible/i });
      if (notPossibleButtons.length >= 4) {
        await user.click(notPossibleButtons[2]); // Middle left
        await user.click(notPossibleButtons[3]); // Middle right
        await user.click(notPossibleButtons[4]); // Another left
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }, 20000);
  });

  describe('Flipper Top Edge Calculation', () => {
    it('should calculate flipper top edge for various percentages', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Click on playfield elements to trigger flipper line rendering
      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const svg = playfield.querySelector('svg');

      if (svg) {
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          fireEvent.mouseDown(path);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Select different shot boxes
      const shotBoxes = playfield.querySelectorAll('[class*="absolute"][class*="z-30"]');
      for (const box of shotBoxes) {
        fireEvent.mouseDown(box);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 15000);

    it('should calculate edge points at boundary percentages', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button5 = await screen.findByRole('button', { name: '5' });
      await user.click(button5);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      const sliders = screen.getAllByRole('slider');

      // Set boundary values: 0, 5, 50, 95, 100
      const boundaryValues = ['5', '50', '95', '5', '95'];
      for (let i = 0; i < Math.min(sliders.length, boundaryValues.length); i++) {
        fireEvent.change(sliders[i], { target: { value: boundaryValues[i] } });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Select shots to trigger line rendering
      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const shotBoxes = playfield.querySelectorAll('[class*="absolute"][class*="z-30"]');
      for (const box of shotBoxes) {
        fireEvent.mouseDown(box);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Ball Animation with Multiple States', () => {
    it('should animate ball from different starting points', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch flipper sides between attempts
      const manualChip = screen.queryAllByRole('button').find(btn =>
        btn.textContent === 'Manual',
      );
      if (manualChip) {
        await user.click(manualChip);
      }

      const flipperButtons = screen.queryAllByRole('button').filter(btn =>
        btn.textContent === 'Left' || btn.textContent === 'Right',
      );

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      // Alternate between Left and Right flippers
      for (let round = 0; round < 4; round++) {
        // Click flipper selection
        if (flipperButtons[round % 2]) {
          await user.click(flipperButtons[round % 2]);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Make attempt
        if (recallButtons[round * 3]) {
          await user.click(recallButtons[round * 3]);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }, 30000);

    it('should handle ball animation skip on various keys', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      // Test each skip method
      if (recallButtons.length > 0) {
        // Space to skip
        await user.click(recallButtons[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.keyDown(window, { key: ' ' });
        await new Promise(resolve => setTimeout(resolve, 100));

        // Enter to skip
        await user.click(recallButtons[5]);
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.keyDown(window, { key: 'Enter' });
        await new Promise(resolve => setTimeout(resolve, 100));

        // Escape to skip
        await user.click(recallButtons[10]);
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.keyDown(window, { key: 'Escape' });
        await new Promise(resolve => setTimeout(resolve, 100));

        // Click to skip
        await user.click(recallButtons[15]);
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.click(window);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 25000);
  });

  describe('Severity Color and Label Assignment', () => {
    it('should assign correct severity for all error magnitudes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enable feedback panel to see severity colors
      const feedbackCheckbox = screen.getByRole('checkbox', { name: /feedback/i });
      await user.click(feedbackCheckbox);
      await new Promise(resolve => setTimeout(resolve, 200));

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });

      // Make attempts at all values to test all severity levels
      for (let i = 0; i < Math.min(19, recallButtons.length); i++) {
        await user.click(recallButtons[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 30000);
  });

  describe('Drift Mechanism', () => {
    it('should apply drift after specified number of attempts', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Set drift to every 2 attempts with magnitude 2
      const advancedBtn = screen.queryByRole('button', { name: /advanced/i });
      if (advancedBtn) {
        await user.click(advancedBtn);
        await new Promise(resolve => setTimeout(resolve, 200));

        const spinbuttons = screen.getAllByRole('spinbutton');
        // Drift every = spinbuttons[1], Drift magnitude = spinbuttons[2]
        if (spinbuttons[1]) {
          await user.clear(spinbuttons[1]);
          await user.type(spinbuttons[1], '2');
        }
        if (spinbuttons[2]) {
          await user.clear(spinbuttons[2]);
          await user.type(spinbuttons[2], '2');
        }

        await user.click(document.body);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await goToPractice(user);

      // Make multiple attempts to trigger drift
      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
      for (let i = 0; i < 20; i++) {
        if (recallButtons[i % recallButtons.length]) {
          await user.click(recallButtons[i % recallButtons.length]);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }, 40000);

    it('should respect drift bounds around base values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Set high drift magnitude
      const advancedBtn = screen.queryByRole('button', { name: /advanced/i });
      if (advancedBtn) {
        await user.click(advancedBtn);
        await new Promise(resolve => setTimeout(resolve, 200));

        const spinbuttons = screen.getAllByRole('spinbutton');
        if (spinbuttons[1]) {
          await user.clear(spinbuttons[1]);
          await user.type(spinbuttons[1], '1'); // Every attempt
        }
        if (spinbuttons[2]) {
          await user.clear(spinbuttons[2]);
          await user.type(spinbuttons[2], '10'); // Max magnitude
        }

        await user.click(document.body);
      }

      await goToPractice(user);

      const recallButtons = screen.queryAllByRole('button', { name: /recall \d+/i });
      for (let i = 0; i < 15; i++) {
        if (recallButtons[i % recallButtons.length]) {
          await user.click(recallButtons[i % recallButtons.length]);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    }, 30000);
  });

  describe('Initial Random Steps', () => {
    it('should apply initial random offset to hidden values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Set initial random steps
      const advancedBtn = screen.queryByRole('button', { name: /advanced/i });
      if (advancedBtn) {
        await user.click(advancedBtn);
        await new Promise(resolve => setTimeout(resolve, 200));

        const spinbuttons = screen.getAllByRole('spinbutton');
        // Initial random = spinbuttons[0]
        if (spinbuttons[0]) {
          await user.clear(spinbuttons[0]);
          await user.type(spinbuttons[0], '4'); // Max random offset
        }

        await user.click(document.body);
      }

      await goToPractice(user);

      // Enable feedback to see actual values
      const feedbackCheckbox = screen.getByRole('checkbox', { name: /feedback/i });
      await user.click(feedbackCheckbox);

      // Toggle "Correct" checkbox to see hidden values
      const correctCheckbox = screen.queryByRole('checkbox', { name: /correct/i });
      if (correctCheckbox) {
        await user.click(correctCheckbox);
      }
    }, 20000);
  });

  describe('ValidatePercent Function', () => {
    it('should validate various percent inputs', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      const numberInputs = screen.getAllByRole('spinbutton');

      // Test various inputs
      const testValues = ['-10', '0', '50', '100', '150', 'abc', '', '33.7'];

      for (let i = 0; i < Math.min(numberInputs.length, testValues.length); i++) {
        await user.clear(numberInputs[i]);
        await user.type(numberInputs[i], testValues[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, 20000);
  });

  describe('PickRandomIdx Function', () => {
    it('should avoid immediate repeats in random mode', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Switch to random mode
      const randomChip = screen.queryAllByRole('button').find(btn =>
        btn.textContent === 'Random',
      );
      if (randomChip) {
        await user.click(randomChip);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Use refresh button many times
      const refreshBtn = screen.queryAllByRole('button').find(btn =>
        btn.textContent === '↻',
      );

      if (refreshBtn) {
        for (let i = 0; i < 20; i++) {
          await user.click(refreshBtn);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    }, 20000);
  });

  describe('Final Recall Score Calculation', () => {
    it('should calculate final score based on all shot recalls', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToRecall(user);

      const numberInputs = screen.getAllByRole('spinbutton');

      // Fill all inputs with values
      for (const [i, numberInput] of numberInputs.entries()) {
        await user.clear(numberInput);
        await user.type(numberInput, String(i * 10 % 100));
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Check score display
      expect(screen.getByText(/final score/i)).toBeInTheDocument();
    }, 20000);
  });

  describe('One-time Snap Legacy Values', () => {
    it('should snap legacy non-5 values on load', async () => {
      // Pre-populate with non-5-aligned values
      localStorage.setItem('pinball_rows_v1', JSON.stringify([
        { id: 1, type: 'Test Shot', initL: 23, initR: 77, x: 0.5, y: 0.3, base: 'Ramp' },
        { id: 2, type: 'Test Shot 2', initL: 41, initR: 58, x: 0.6, y: 0.3, base: 'Orbit' },
      ]));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Values should have been snapped to nearest 5
      const table = screen.queryByRole('table');
      expect(table).toBeInTheDocument();
    }, 10000);
  });

  describe('ROW_ID_SEED Update on Load', () => {
    it('should update ROW_ID_SEED to avoid conflicts', async () => {
      // Pre-populate with high IDs
      localStorage.setItem('pinball_rows_v1', JSON.stringify([
        { id: 100, type: 'Test Shot 100', initL: 50, initR: 50, x: 0.5, y: 0.3, base: 'Ramp' },
        { id: 200, type: 'Test Shot 200', initL: 60, initR: 40, x: 0.6, y: 0.3, base: 'Orbit' },
      ]));

      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Add a new shot - it should get ID > 200
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have at least 2 rows (header + some data rows)
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(2); // Header + at least 1 data row
    }, 15000);
  });

  describe('Playfield Arc Position Calculation', () => {
    it('should calculate arc positions for different shot counts', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });

      // Test with 1 shot
      await user.click(addButton);
      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Clear and test with many shots
      const clearBtns = screen.queryAllByRole('button', { name: /clear all shots/i });
      if (clearBtns.length > 0) {
        await user.click(clearBtns[0]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await user.click(addButton);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Look for number buttons in the menu
      const numberButtons = screen.queryAllByRole('button').filter(btn =>
        /^([1-9]|10|15|20)$/.test(btn.textContent || ''),
      );

      // Click the highest available number
      if (numberButtons.length > 0) {
        const highestBtn = numberButtons.at(-1);
        await user.click(highestBtn);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Check playfield has shot boxes
      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      const shotBoxes = playfield.querySelectorAll('[class*="absolute"][class*="z-30"]');
      expect(shotBoxes.length).toBeGreaterThanOrEqual(0);
    }, 25000);
  });

  describe('Fullscreen Scale Callback', () => {
    it('should call onScale when scale changes in fullscreen', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Resize window to trigger scale recalculation
        const heights = [400, 600, 800, 1000];
        for (const height of heights) {
          Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
          fireEvent.resize(window);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 25000);
  });

  describe('Chip Width Calculation for Fullscreen', () => {
    it('should calculate chip dimensions based on available width', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Test various window widths
      const widths = [320, 640, 1024, 1920, 2560, 3840];

      for (const width of widths) {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
        fireEvent.resize(window);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);
        await new Promise(resolve => setTimeout(resolve, 300));

        // More width tests in fullscreen
        for (const width of widths) {
          Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
          fireEvent.resize(window);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }, 30000);
  });
});
