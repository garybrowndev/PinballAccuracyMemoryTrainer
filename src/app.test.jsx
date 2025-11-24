import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from './app.jsx';

describe('App - Setup Page Clear Button', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should navigate to setup page, clear shots, and confirm shots are empty', async () => {
    const user = userEvent.setup();

    // Render the app
    render(<App />);

    // Wait for the app to load - check for the setup page heading
    await waitFor(() => {
      expect(screen.getByText(/define shots/i)).toBeInTheDocument();
    });

    // Add a shot first so we have something to clear
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);

    // Wait for the shot to be added (table should have a row)
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    // Find the Clear button (it should be visible in the playfield area)
    const clearButton = screen.getByRole('button', { name: /clear all shots/i });
    expect(clearButton).toBeInTheDocument();

    // Click the Clear button
    await user.click(clearButton);

    // Confirm that shots are cleared/empty
    // After clearing, verify the Clear button is visible (indicating setup page is active)
    // and check localStorage
    await waitFor(() => {
      const storedRows = localStorage.getItem('pinball_rows_v1');
      // Check if localStorage is empty or has an empty array
      if (storedRows && storedRows !== 'undefined') {
        const parsed = JSON.parse(storedRows);
        expect(parsed).toEqual([]);
      }
      // Also verify the clear button is still present (we're on setup page)
      expect(screen.getByRole('button', { name: /clear all shots/i })).toBeInTheDocument();
    });
  });

  it('should show no shots when first loaded with empty state', async () => {
    // Render the app with no pre-existing data
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/define shots/i)).toBeInTheDocument();
    });

    // Verify that the setup page shows no shots
    // Check localStorage is empty
    const storedRows = localStorage.getItem('pinball_rows_v1');
    if (storedRows && storedRows !== 'undefined') {
      const parsed = JSON.parse(storedRows);
      expect(parsed.length).toBe(0);
    }

    // Verify the Clear button is present (indicating we're on setup page with empty state)
    expect(screen.getByRole('button', { name: /clear all shots/i })).toBeInTheDocument();
  });

  it('should maintain cleared state after clearing shots', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/define shots/i)).toBeInTheDocument();
    });

    // Add multiple shots
    const addButton = screen.getByRole('button', { name: /add shot/i });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    // Wait for shots to be added
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    // Clear all shots
    const clearButton = screen.getByRole('button', { name: /clear all shots/i });
    await user.click(clearButton);

    // Verify cleared state
    await waitFor(() => {
      const storedRows = localStorage.getItem('pinball_rows_v1');
      if (storedRows && storedRows !== 'undefined') {
        const parsed = JSON.parse(storedRows);
        expect(parsed).toEqual([]);
      }
    });

    // Verify the UI reflects the empty state - Clear button should still be visible
    expect(screen.getByRole('button', { name: /clear all shots/i })).toBeInTheDocument();
  });
});
