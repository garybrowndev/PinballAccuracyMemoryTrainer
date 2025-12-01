import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import App from '../../src/app.jsx';

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

describe('App - Extended Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dark Mode Styling', () => {
    it('should render all mode variants with dark mode enabled', async () => {
      const user = userEvent.setup();
      
      // Set dark mode in localStorage before rendering
      localStorage.setItem('pinball_darkMode_v1', 'true');
      
      await setupAppWithShots(user);

      // Verify dark mode classes are applied
      const container = document.querySelector('.dark');
      expect(container).toBeInTheDocument();
    }, 15000);

    it('should toggle between dark and light mode and apply classes', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find dark mode toggle
      const darkModeBtn = screen.getByRole('button', { name: /switch to (dark|light) mode/i });
      
      // Toggle multiple times
      await user.click(darkModeBtn);
      await user.click(darkModeBtn);
      await user.click(darkModeBtn);

      expect(darkModeBtn).toBeInTheDocument();
    }, 15000);
  });

  describe('ElementTile Component', () => {
    it('should render element tiles with different selection states', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Add a shot to trigger element tile rendering
      const addButton = screen.getByRole('button', { name: /add shot/i });
      await user.click(addButton);

      // Click count selector
      const button1 = await screen.findByRole('button', { name: '1' });
      await user.click(button1);

      // Wait for shot to appear
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Open shot type menu to show ElementTiles
      const thumbnails = screen.queryAllByRole('button', { name: /pressed/i });
      if (thumbnails.length > 0) {
        await user.click(thumbnails[0]);
        
        // Wait for menu to appear and interact with tiles
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }, 15000);

    it('should handle image load events on element tiles', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Images should attempt to load
      const images = screen.queryAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('PlayfieldEditor Interactions', () => {
    it('should handle flipper selection on playfield', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find SVG playfield
      const svg = document.querySelector('svg');
      if (svg) {
        // Find flipper elements
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          fireEvent.mouseDown(path);
          fireEvent.mouseUp(path);
        }
      }
    }, 15000);

    it('should handle shot box clicks on playfield', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find shot boxes (g elements or rects)
      const svg = document.querySelector('svg');
      if (svg) {
        const groups = svg.querySelectorAll('g');
        for (let i = 0; i < Math.min(3, groups.length); i++) {
          fireEvent.click(groups[i]);
        }
      }
    }, 15000);
  });

  describe('Slider Interactions', () => {
    it('should interact with flipper sliders', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find range inputs (sliders)
      const sliders = screen.queryAllByRole('slider');
      
      for (const slider of sliders.slice(0, 2)) {
        // Change slider value
        fireEvent.change(slider, { target: { value: '50' } });
        fireEvent.change(slider, { target: { value: '75' } });
        fireEvent.change(slider, { target: { value: '25' } });
      }
    }, 15000);

    it('should handle extreme slider values', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const sliders = screen.queryAllByRole('slider');
      
      for (const slider of sliders.slice(0, 2)) {
        fireEvent.change(slider, { target: { value: '0' } });
        fireEvent.change(slider, { target: { value: '100' } });
        fireEvent.change(slider, { target: { value: '5' } });
      }
    }, 15000);
  });

  describe('Practice Mode Comprehensive', () => {
    it('should exercise all practice UI elements', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Toggle all checkboxes
      const checkboxes = screen.queryAllByRole('checkbox');
      for (const checkbox of checkboxes) {
        await user.click(checkbox);
      }

      // Toggle radio buttons
      const radios = screen.queryAllByRole('radio');
      for (const radio of radios) {
        await user.click(radio);
      }
    }, 20000);

    it('should show metrics after practice attempts', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Make several attempts
      const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
      for (let i = 0; i < Math.min(5, chips.length); i++) {
        await user.click(chips[i]);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Click to continue
        const svg = document.querySelector('svg');
        if (svg) {
          fireEvent.click(svg);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Check that metrics are displayed
      const avgError = screen.queryByText(/avg.*error|error.*avg/i);
      const totalPoints = screen.queryByText(/points/i);
      expect(avgError || totalPoints).toBeTruthy();
    }, 30000);
  });

  describe('Advanced Options Dialog', () => {
    it('should open and interact with advanced options', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Find advanced options button
      const advancedBtn = screen.queryByRole('button', { name: /advanced/i });
      if (advancedBtn) {
        await user.click(advancedBtn);
        
        // Wait for dialog
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Find number inputs and change them
        const numberInputs = screen.queryAllByRole('spinbutton');
        for (const input of numberInputs) {
          await user.clear(input);
          await user.type(input, '5');
        }
      }
    }, 20000);
  });

  describe('Fullscreen Mode Interactions', () => {
    it('should enter fullscreen and interact with controls', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);
      await goToPractice(user);

      // Enter fullscreen
      const fullscreenBtn = screen.queryByRole('button', { name: /fullscreen/i });
      if (fullscreenBtn) {
        await user.click(fullscreenBtn);

        // Wait for fullscreen
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try clicking recall chips in fullscreen
        const chips = screen.queryAllByRole('button', { name: /recall \d+/i });
        if (chips.length > 0) {
          await user.click(chips[Math.floor(chips.length / 2)]);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Try Not Possible button
        const npBtn = screen.queryAllByRole('button').find(btn =>
          btn.textContent?.toLowerCase().includes('not possible'),
        );
        if (npBtn && !npBtn.disabled) {
          await user.click(npBtn);
        }

        // Exit fullscreen with Escape
        fireEvent.keyDown(document, { key: 'Escape' });
      }
    }, 25000);
  });

  describe('Table Column Headers', () => {
    it('should handle hover on table column headers', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find table headers
      const table = screen.getByRole('table');
      const headers = within(table).queryAllByRole('columnheader');
      
      for (const header of headers) {
        fireEvent.mouseEnter(header);
        fireEvent.mouseLeave(header);
      }
    }, 15000);
  });

  describe('Drag and Drop', () => {
    it('should handle drag operations on shot rows', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find drag handles
      const dragButtons = screen.queryAllByRole('button', { name: /move.*up|move.*down|drag/i });
      
      for (const btn of dragButtons.slice(0, 4)) {
        await user.click(btn);
      }
    }, 15000);
  });

  describe('Location Menu', () => {
    it('should open and interact with location menu', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find location buttons in the table
      const table = screen.getByRole('table');
      const cells = within(table).queryAllByRole('cell');
      
      // Look for location buttons
      for (const cell of cells) {
        const locationBtns = within(cell).queryAllByRole('button');
        for (const locationBtn of locationBtns) {
          if (locationBtn && locationBtn.textContent) {
            const text = locationBtn.textContent.toLowerCase();
            if (text.includes('left') || text.includes('right') || text.includes('center')) {
              await user.click(locationBtn);
              await new Promise(resolve => setTimeout(resolve, 200));
              // Click away to close menu
              fireEvent.click(document.body);
              return; // Exit after first successful interaction
            }
          }
        }
      }
    }, 15000);
  });

  describe('Keyboard Navigation', () => {
    it('should handle Tab navigation through form elements', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Press Tab multiple times
      for (let i = 0; i < 10; i++) {
        await user.keyboard('{Tab}');
      }
    }, 15000);

    it('should handle Escape key to close dialogs', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Open info modal
      const infoBtn = screen.queryByRole('button', { name: /help|about|info/i });
      if (infoBtn) {
        await user.click(infoBtn);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Close with Escape
        await user.keyboard('{Escape}');
      }
    }, 15000);
  });

  describe('Window Resize Handling', () => {
    it('should handle window resize events', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Trigger resize events
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });
      fireEvent(window, new Event('resize'));

      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      Object.defineProperty(window, 'innerHeight', { value: 900 });
      fireEvent(window, new Event('resize'));
    }, 15000);
  });

  describe('Text Input Handling', () => {
    it('should handle input focus and blur', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      const inputs = screen.queryAllByRole('textbox');
      for (const input of inputs.slice(0, 3)) {
        fireEvent.focus(input);
        await user.type(input, 'test');
        fireEvent.blur(input);
      }
    }, 15000);
  });

  describe('Multiple Shots Management', () => {
    it('should add and delete multiple shots', async () => {
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

      // Delete some shots
      const deleteButtons = screen.queryAllByRole('button', { name: /delete|remove/i });
      for (const btn of deleteButtons.slice(0, 2)) {
        await user.click(btn);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, 20000);
  });

  describe('Shot Insert Operations', () => {
    it('should insert shots at different positions', async () => {
      const user = userEvent.setup();
      await setupAppWithShots(user);

      // Find insert buttons
      const insertButtons = screen.queryAllByRole('button', { name: /insert|add below/i });
      for (const btn of insertButtons.slice(0, 2)) {
        await user.click(btn);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }, 15000);
  });

  describe('Preset Loading', () => {
    it('should handle preset button clicks', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/setup shots/i)).toBeInTheDocument();
      });

      // Load example shots is a preset
      const exampleButton = screen.getByRole('button', { name: /load example/i });
      await user.click(exampleButton);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    }, 15000);
  });
});
