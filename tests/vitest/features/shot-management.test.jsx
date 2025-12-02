import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from '../../../src/app.jsx';

describe('App - Additional Features', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Example Shots', () => {
    it('should load example shots', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const exampleButton = screen.getByRole('button', { name: /load example shots/i });
      await user.click(exampleButton);

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Shot Addition', () => {
    it('should open count selector when adding shots', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/how many shots/i)).toBeInTheDocument();
      });
    });

    it('should add multiple shots when selecting count', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/how many shots/i)).toBeInTheDocument();
      });

      const threeButton = screen.getByRole('button', { name: '3' });
      await user.click(threeButton);

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Navigation State', () => {
    it('should show setup button as active on setup page', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const setupButton = screen.getByRole('button', { name: /setup/i });
      expect(setupButton).toBeDisabled(); // Active page button is disabled
    });

    it('should disable practice and recall buttons without shots', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole('button', { name: /^practice$/i });
      const recallButton = screen.getByRole('button', { name: /recall/i });

      expect(practiceButton).toBeDisabled();
      expect(recallButton).toBeDisabled();
    });
  });

  describe('Advanced Options', () => {
    it('should open advanced options dialog', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const advancedButton = screen.getByRole('button', { name: /advanced practice options/i });
      expect(advancedButton).toBeInTheDocument();

      await user.click(advancedButton);

      // Dialog should open (checked by aria-expanded or presence of dialog content)
      await waitFor(() => {
        expect(advancedButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Playfield Interaction', () => {
    it('should show playfield layout region', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const playfield = screen.getByRole('region', { name: /playfield layout/i });
      expect(playfield).toBeInTheDocument();
    });

    it('should show clear all shots button', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear all shots/i });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Shot Type Selection', () => {
    it('should show shot type selection buttons', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Load examples to have shots in the table
      const exampleButton = screen.getByRole('button', { name: /load example shots/i });
      await user.click(exampleButton);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Check for shot type buttons
      const shotTypeButton = screen.getByRole('button', { name: /shot type/i });
      expect(shotTypeButton).toBeInTheDocument();
    });
  });
});
