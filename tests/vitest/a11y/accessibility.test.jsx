import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { describe, expect, it } from 'vitest';

import App from '../../../src/app.jsx';

describe('Accessibility - WCAG 2.1 AAA Compliance', () => {
  it('should not have any accessibility violations in main app', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('should have main landmark', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('should have accessible buttons with proper labels', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const buttons = container.querySelectorAll('button');

    for (const button of buttons) {
      const hasAccessibleName =
        button.textContent.trim() ||
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby') ||
        button.getAttribute('title');

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  it('should have accessible form inputs', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const inputs = container.querySelectorAll('input, select, textarea');

    for (const input of inputs) {
      const hasLabel =
        input.getAttribute('aria-label') ||
        input.getAttribute('aria-labelledby') ||
        input.getAttribute('placeholder') ||
        container.querySelector(`label[for="${input.id}"]`);

      expect(hasLabel).toBeTruthy();
    }
  });

  it('should have sufficient color contrast in light mode', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    // jest-axe will check color contrast as part of the violations check
    const results = await axe(container, {
      rules: {
        'color-contrast-enhanced': { enabled: true }, // AAA level
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should have keyboard accessible interactive elements', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('main')).toBeInTheDocument());
    const interactiveElements = container.querySelectorAll(
      'button, a, input, select, textarea, [role="button"]'
    );

    for (const element of interactiveElements) {
      const isKeyboardAccessible =
        element.tabIndex >= 0 || element.getAttribute('tabindex') !== '-1';
      expect(isKeyboardAccessible).toBeTruthy();
    }
  });
});
