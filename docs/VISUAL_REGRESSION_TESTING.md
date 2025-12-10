# Visual Regression Testing Guide

This document explains how visual regression tests work in this project and how to maintain baseline snapshots across different platforms.

## Overview

Visual regression tests use Playwright's screenshot comparison feature to detect unintended visual changes. These tests capture screenshots of the application and compare them against baseline images.

## Platform-Specific Snapshots

Playwright generates platform-specific snapshots because rendering differs slightly between operating systems:

- **Windows**: `*-win32.png`
- **Linux**: `*-linux.png`
- **macOS**: `*-darwin.png`

Our CI/CD pipeline runs on **Linux (ubuntu-latest)**, so we need Linux-specific baseline snapshots in the repository.

## Running Visual Regression Tests

### Locally

Run visual regression tests on your platform:

```bash
npm run test:e2e:visual
```

Update local baselines after intentional visual changes:

```bash
npm run test:e2e:visual:update
```

### In CI

The visual regression tests run automatically:

1. **PR Validation** (`ci-pr-validation.yml`): Excludes visual regression tests to avoid platform mismatches
2. **Visual Regression Workflow** (`ci-visual-regression-tests.yml`): Runs dedicated visual regression tests

## Generating Linux Baselines Locally

If you need to generate Linux baselines on Windows/macOS, use Docker:

### Option 1: Using Docker

```bash
# Pull Playwright Docker image
docker pull mcr.microsoft.com/playwright:v1.42.0-focal

# Run tests in Docker container to generate Linux snapshots
docker run --rm --network host -v ${PWD}:/work -w /work mcr.microsoft.com/playwright:v1.42.0-focal /bin/bash -c "npm ci && npm run test:e2e:visual:update"
```

### Option 2: Let CI Generate Baselines

The `ci-visual-regression-tests.yml` workflow automatically:

1. Checks if Linux snapshots exist
2. If not, generates them with `--update-snapshots`
3. Commits them back to the PR branch

## Handling Visual Changes

### Intentional Changes

If you intentionally modified the UI:

1. **Update local snapshots**: `npm run test:e2e:visual:update`
2. **Commit the updated snapshots** (platform-specific files in `tests/e2e/visual-regression.spec.js-snapshots/`)
3. **Generate Linux baselines** using Docker or wait for CI to generate them
4. Push all snapshot updates to your branch

### Unintentional Changes

If visual regression tests fail unexpectedly:

1. Download the `visual-regression-results` artifact from GitHub Actions
2. Review the diff images in `test-results/`
3. Fix the CSS/layout issues causing the differences
4. Re-run tests to verify the fix

## Snapshot Configuration

Visual regression tests use these settings in `playwright.config.js`:

- **maxDiffPixelRatio**: Allows minor rendering differences (2%)
- **animations: 'disabled'**: Prevents animation timing issues
- **fullPage**: Captures entire scrollable page
- **Seeded mode**: Uses deterministic random seed for consistent shot selection

## Test Coverage

Current visual regression tests cover:

- ✅ Homepage (light and dark mode)
- ✅ Setup screen
- ✅ Practice mode (with seeded random shots)
- ✅ Recall mode (with seeded random shots)
- ✅ Responsive viewports (mobile, tablet, desktop)

## Troubleshooting

### Tests fail only in CI

**Cause**: Missing Linux-specific baselines or platform rendering differences.

**Solution**:

1. Check if Linux snapshots exist in `tests/e2e/visual-regression.spec.js-snapshots/`
2. Generate them using Docker or let the CI workflow create them
3. Commit the generated Linux snapshots

### Tests fail intermittently

**Cause**: Non-deterministic UI elements (animations, random data).

**Solution**:

1. Disable animations in test setup
2. Use seeded random mode for practice/recall tests
3. Wait for network idle and UI stability before screenshots

### Snapshots differ between developers

**Cause**: Different operating systems generating different baselines.

**Solution**:

1. Only commit Linux snapshots to the repository
2. Use `.gitignore` to exclude platform-specific snapshots if needed
3. Use Docker to generate consistent Linux baselines locally

## Best Practices

1. **Run tests before committing**: Catch visual regressions early
2. **Use semantic commits**: Clearly indicate visual changes in commit messages
3. **Review diff images**: Always inspect visual differences in failed tests
4. **Update intentionally**: Only update baselines for legitimate UI changes
5. **Test on target platform**: Generate Linux baselines for CI compatibility

## Related Documentation

- [Playwright Screenshots Documentation](https://playwright.dev/docs/screenshots)
- [Playwright Docker Images](https://playwright.dev/docs/docker)
- [CI/CD Guide](./CI_CD_GUIDE.md)
