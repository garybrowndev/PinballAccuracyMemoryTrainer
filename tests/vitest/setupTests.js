import '@testing-library/jest-dom';
import { configureAxe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers with jest-axe
expect.extend(toHaveNoViolations);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Configure axe for WCAG 2.1 AAA compliance
export const axe = configureAxe({
  rules: {
    // Enable all WCAG 2.1 AAA rules
    'color-contrast-enhanced': { enabled: true },
    'link-in-text-block': { enabled: true },
    'meta-refresh': { enabled: true },
    'meta-viewport-large': { enabled: true },
    'meta-viewport': { enabled: true },
    'page-has-heading-one': { enabled: true },
    region: { enabled: true },
    'skip-link': { enabled: true },
  },
});
