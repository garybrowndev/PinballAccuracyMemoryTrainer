# Test Organization

This directory contains all unit and integration tests for the Pinball Accuracy Memory Trainer application.

## Structure

```
tests/vitest/
├── features/              # Feature-specific unit tests
│   ├── practice-mode.test.jsx      # Practice mode functionality
│   ├── recall-mode.test.jsx        # Recall mode functionality
│   ├── setup.test.jsx              # Setup page and shot management
│   ├── shot-management.test.jsx    # Shot CRUD operations
│   ├── ui-controls.test.jsx        # UI components (dark mode, modals)
│   └── utils.test.jsx              # Utility function tests
├── integration/           # End-to-end workflow and coverage tests
│   ├── advanced-features.test.jsx     # Complex feature interactions
│   ├── app-workflow.test.jsx          # Full user workflow tests
│   ├── comprehensive-coverage.test.jsx # Maximum coverage scenarios
│   ├── deep-coverage.test.jsx         # Deep coverage of edge cases
│   ├── edge-cases.test.jsx            # Edge case handling
│   ├── full-coverage.test.jsx         # Full feature coverage
│   └── targeted-coverage.test.jsx     # Targeted line coverage
└── setupTests.js          # Test environment configuration
```

## Test Categories

### Features (`features/`)
Focused tests for individual features and components:
- **practice-mode.test.jsx** (14 tests) - Practice mode UI, manual/random modes, statistics
- **recall-mode.test.jsx** (6 tests) - Recall mode UI, navigation, metrics
- **setup.test.jsx** (3 tests) - Setup page, clearing shots, state management
- **shot-management.test.jsx** (9 tests) - Adding, editing, deleting shots
- **ui-controls.test.jsx** (4 tests) - Dark mode, info modal, GitHub link
- **utils.test.jsx** (17 tests) - Utility functions (distance, coordinates, RNG)

### Integration (`integration/`)
Comprehensive workflow tests covering multiple features:
- **advanced-features.test.jsx** (18 tests) - Complex interactions, edge cases
- **app-workflow.test.jsx** (11 tests) - End-to-end user workflows
- **comprehensive-coverage.test.jsx** (31 tests) - Maximum coverage scenarios
- **deep-coverage.test.jsx** (19 tests) - Deep coverage of edge cases
- **edge-cases.test.jsx** (34 tests) - Edge case handling and error states
- **full-coverage.test.jsx** (17 tests) - Full feature coverage
- **targeted-coverage.test.jsx** (23 tests) - Targeted line coverage

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

## Test Statistics

- **Total Tests**: 217
- **Test Files**: 13
- **Coverage**: ~65% (Statements: 64.35%, Branches: 60.27%, Functions: 75.77%, Lines: 65.67%)

## Writing Tests

### Feature Tests
Place in `features/` directory. Name pattern: `{feature}.test.jsx`

Example:
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../../src/app.jsx';

describe('Feature Name', () => {
  it('should do something', () => {
    render(<App />);
    // assertions
  });
});
```

### Integration Tests
Place in `integration/` directory. Test multiple features working together.

## Test Utilities

- **setupTests.js** - Configures jsdom and testing-library matchers
- Import paths use `../../../src/` to reference source files
