# Visual Regression Review

This file tracks visual regression test changes that require review.

**Last Updated:** 2026-02-27T02:51:35.890Z

## Purpose

This file enables the "Resolve conversation" workflow for visual regression approvals:

1. When visual changes are detected, CI updates this file with a new timestamp
2. A review comment is added to this file with the list of changed snapshots
3. Review the changes and click "Resolve conversation" to approve
4. Once resolved, the PR can be merged

## Current Status

Visual changes detected in the following snapshots:

- `mobile-view-chromium-linux.png`
- `mobile-view-firefox-linux.png`
- `mobile-view-webkit-linux.png`
