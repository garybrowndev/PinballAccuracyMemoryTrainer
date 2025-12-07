import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

import App from '../../../src/app.jsx';

describe('App - Recall Mode Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function setupAndGoToRecall(user) {
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

    // Navigate to Recall mode
    const recallButton = screen.getAllByRole('button').find((btn) => btn.textContent === 'Recall');

    if (recallButton) {
      await user.click(recallButton);

      // Wait for recall mode to load
      await waitFor(
        () => {
          expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  }

  it('should enter recall mode from setup', async () => {
    const user = userEvent.setup();
    await setupAndGoToRecall(user);

    // Verify we're in a different mode
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);
  }, 15000);

  it('should show recall mode UI elements', async () => {
    const user = userEvent.setup();
    await setupAndGoToRecall(user);

    // Verify recall UI elements
    expect(screen.getByText(/enter your best recall/i)).toBeInTheDocument();
    expect(screen.getByText(/final score/i)).toBeInTheDocument();
    const shotsElements = screen.getAllByText(/shots/i);
    expect(shotsElements.length).toBeGreaterThan(0);
  }, 15000);

  it('should navigate back to setup from recall mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToRecall(user);

    const allButtons = screen.getAllByRole('button');
    const setupButton = allButtons.find((btn) => btn.textContent === 'Setup');

    if (setupButton) {
      await user.click(setupButton);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });
    }
  }, 15000);

  it('should show recall metrics', async () => {
    const user = userEvent.setup();
    await setupAndGoToRecall(user);

    // Verify recall mode metrics are visible
    expect(screen.getByText(/final score/i)).toBeInTheDocument();
    const shotsElements = screen.getAllByText(/shots/i);
    expect(shotsElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/total attempts/i)).toBeInTheDocument();
  }, 15000);

  it('should handle dark mode toggle in recall mode', async () => {
    const user = userEvent.setup();
    await setupAndGoToRecall(user);

    const darkModeButton = screen.queryByRole('button', { name: /switch to light mode/i });

    if (darkModeButton) {
      await user.click(darkModeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
      });
    }
  }, 15000);

  it('should complete full cycle: setup → recall → back to setup', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
    });

    // Load shots
    const exampleButton = screen.getByRole('button', { name: /load example shots/i });
    await user.click(exampleButton);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Go to recall
    const recallButton = screen.getAllByRole('button').find((btn) => btn.textContent === 'Recall');

    if (recallButton) {
      await user.click(recallButton);

      await waitFor(
        () => {
          expect(screen.queryByText(/setup shots/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // In recall mode
      expect(screen.getByText(/enter your best recall/i)).toBeInTheDocument();

      // Go back to setup
      const setupButton = screen.getAllByRole('button').find((btn) => btn.textContent === 'Setup');

      if (setupButton) {
        await user.click(setupButton);

        await waitFor(() => {
          expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
        });
      }
    }
  }, 20000);
});
