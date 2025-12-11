# Visual Regression Review Required

**Generated:** 2025-12-11T15:30:36.230Z

## Changed Snapshots

The following Linux snapshots have been updated and require review:

- `desktop-view-chromium-linux.png`
- `desktop-view-firefox-linux.png`
- `desktop-view-webkit-linux.png`
- `homepage-chromium-linux.png`
- `homepage-dark-chromium-linux.png`
- `homepage-dark-firefox-linux.png`
- `homepage-dark-webkit-linux.png`
- `homepage-firefox-linux.png`
- `homepage-webkit-linux.png`
- `mobile-view-chromium-linux.png`
- `mobile-view-firefox-linux.png`
- `mobile-view-webkit-linux.png`
- `setup-screen-chromium-linux.png`
- `setup-screen-firefox-linux.png`
- `setup-screen-webkit-linux.png`
- `tablet-view-chromium-linux.png`
- `tablet-view-firefox-linux.png`
- `tablet-view-webkit-linux.png`

## Instructions

1. Review the changed snapshots in the Files tab
2. If changes are intentional, click **"Resolve conversation"** on the review comment below
3. Once resolved, delete this file and push:
   ```bash
   git rm tests/e2e/visual-regression.spec.js-snapshots/VISUAL_REGRESSION_REVIEW.md
   git commit -m "chore: approve visual regression changes"
   git push
   ```
4. All CI checks will re-run automatically

## Note

This file exists solely to enable the "Resolve conversation" workflow.
Once resolved and deleted, the PR can be merged.
