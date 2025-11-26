import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from '../../src/app.jsx';

describe('App - Component Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Dark Mode', () => {
    it('should toggle dark mode', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Find the dark mode toggle button by its title/label
      const darkModeToggle = screen.getByRole('button', { name: /switch to light mode/i });
      expect(darkModeToggle).toBeInTheDocument();

      // Click to switch to light mode
      await user.click(darkModeToggle);

      // After toggle, button label should change
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
      });
    });
  });

  describe('Info Modal', () => {
    it('should open and close info modal', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Find the info button using "About" label
      const infoButton = screen.getByRole('button', { name: /about/i });
      await user.click(infoButton);

      // Check modal appeared
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/about this app/i)).toBeInTheDocument();
      });

      // Close modal with the X close button (not the backdrop)
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      const closeButton = closeButtons.find(btn => btn.getAttribute('aria-label') === 'Close');
      await user.click(closeButton);

      // Modal should be gone
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should show GitHub link in info modal', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const infoButton = screen.getByRole('button', { name: /about/i });
      await user.click(infoButton);

      await waitFor(() => {
        const githubLink = screen.getByRole('link', { name: /view on github/i });
        expect(githubLink).toBeInTheDocument();
        expect(githubLink).toHaveAttribute('href', expect.stringContaining('github.com'));
      });
    });
  });

  describe('Shot Management', () => {
    it('should add a shot with + Add shot button', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      // Check that a shot was added (table should appear)
      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
    });
  });
});
