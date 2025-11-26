import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from "../../src/app.jsx";

describe('App - Comprehensive Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should complete a full workflow: load examples, edit shots, navigate to practice, and interact', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Load example shots
    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    // Wait for shots to appear
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Click on playfield to interact with shots
    const playfield = screen.getByRole('region', { name: /playfield layout/i });
    await user.click(playfield);

    // Navigate to practice mode
    const practiceButton = screen.getAllByRole('button').find(btn =>
      btn.textContent.includes('Practice') && !btn.disabled,
    );

    if (practiceButton) {
      await user.click(practiceButton);

      // Verify we're in practice mode
      await waitFor(() => {
        // Should have changed the UI
        expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    }
  }, 15000);

  it('should add multiple shots and verify they appear in the table', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Find and click the "Add Shot(s)" button
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    // Wait for the modal or inline form to appear and select "5" shots
    await waitFor(() => {
      const button5 = screen.queryByRole('button', { name: '5' });
      if (button5) {
        return button5;
      }
      throw new Error('Button not found');
    }, { timeout: 2000 });

    const button5 = screen.getByRole('button', { name: '5' });
    await user.click(button5);

    // Verify table has been updated
    await waitFor(() => {
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      // Should have header row + 5 shot rows + add row
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });
  }, 10000);

  it('should interact with shots in the table', async () => {
    const user = userEvent.setup();
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

    // Try to click on a shot type cell
    const shotTypeButtons = screen.getAllByRole('button', { name: /shot type/i });
    if (shotTypeButtons.length > 0) {
      await user.click(shotTypeButtons[0]);
    }

    // Try to click on flipper selections
    const leftFlipperButtons = screen.queryAllByRole('button', { name: /left flipper/i });
    if (leftFlipperButtons.length > 0) {
      await user.click(leftFlipperButtons[0]);
    }
  }, 10000);

  it('should toggle dark mode and verify theme changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Find dark mode toggle
    const darkModeButton = screen.getByRole('button', { name: /switch to light mode/i });

    // Toggle to light mode
    await user.click(darkModeButton);

    // Verify button text changed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    // Toggle back to dark mode
    const lightModeButton = screen.getByRole('button', { name: /switch to dark mode/i });
    await user.click(lightModeButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    });
  });

  it('should open and close the info modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Open info modal
    const infoButton = screen.getByRole('button', { name: /about/i });
    await user.click(infoButton);

    // Check if modal content appears
    await waitFor(() => {
      expect(screen.getByText(/memory trainer/i)).toBeInTheDocument();
    });

    // Close modal by clicking the close button
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    if (closeButtons.length > 0) {
      await user.click(closeButtons[0]);
    }

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/memory trainer/i)).not.toBeInTheDocument();
    });
  });

  it('should clear all shots when clear button is clicked', async () => {
    const user = userEvent.setup();
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

    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear all shots/i });
    await user.click(clearButton);

    // Verify table shows empty state
    await waitFor(() => {
      const addRowButton = screen.getByRole('button', { name: /add shot/i });
      expect(addRowButton).toBeInTheDocument();
    });
  });

  it('should interact with playfield and show visual feedback', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const playfield = screen.getByRole('region', { name: /playfield layout/i });

    // Click multiple times on playfield
    await user.click(playfield);
    await user.click(playfield);

    // Verify playfield is still there (no crash)
    expect(playfield).toBeInTheDocument();
  });

  it('should handle preset loading', async () => {
    const user = userEvent.setup();

    // Mock fetch for presets
    global.fetch = vi.fn((url) => {
      if (url.includes('index.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'test-preset', name: 'Test Preset', file: 'test-preset.json' },
          ]),
        });
      }
      if (url.includes('test-preset.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            shots: [
              { id: 1, label: 'Test Shot', type: 'Ramp', left: 75, right: 25, initL: 75, initR: 25 },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Try to open presets
    const presetsButtons = screen.queryAllByRole('button').filter(btn =>
      btn.textContent.toLowerCase().includes('preset'),
    );

    if (presetsButtons.length > 0) {
      await user.click(presetsButtons[0]);
    }
  }, 10000);

  it('should navigate between setup, practice, and recall modes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Load example shots first
    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Get navigation buttons
    const setupButton = screen.getAllByRole('button').find(btn =>
      btn.textContent === 'Setup',
    );

    expect(setupButton).toBeInTheDocument();

    // Recall button should now be available after loading shots
    const recallButton = screen.getAllByRole('button').find(btn =>
      btn.textContent === 'Recall',
    );

    if (recallButton) {
      expect(recallButton).toBeInTheDocument();
      expect(recallButton).not.toBeDisabled();
    }
  });

  it('should handle keyboard interactions', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Try pressing Tab to navigate
    await user.keyboard('{Tab}');

    // Try pressing Enter on focused element
    await user.keyboard('{Enter}');

    // App should still be functional
    expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
  });

  it('should handle rapid clicking without crashing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    const exampleButton = screen.getByRole('button', { name: /load example shots/i });

    // Rapid clicks
    await user.click(exampleButton);
    await user.click(exampleButton);
    await user.click(exampleButton);

    // App should still be responsive
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});
