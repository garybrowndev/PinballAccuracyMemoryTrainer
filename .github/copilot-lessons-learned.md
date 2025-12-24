# Copilot Lessons Learned

This file documents mistakes made by AI assistants during development to prevent recurring errors across chat sessions.

**Instructions for AI Assistants**:

- Read this file before starting significant work
- Append new entries when you make preventable mistakes
- Keep entries concise (2-4 lines)
- Use the format shown below
- Mark obsolete entries as [DEPRECATED]

---

## Build Scripts

### PowerShell Script Syntax - Missing Quotes

**Date**: 2025-12-16
**Mistake**: Created PowerShell scripts without proper quoting of string values, causing syntax errors
**Correct Approach**: Always quote string values in PowerShell, especially in conditions and assignments
**Prevention**: Review PowerShell syntax rules before generating scripts; test syntax mentally before committing

---

## Testing

### Test Execution Order

**Date**: 2025-12-16
**Mistake**: Assumed tests could run before dependencies were installed
**Correct Approach**: Check for task dependencies; ensure `Install Dependencies` runs first
**Prevention**: Review task definitions in workspace info; respect `dependsOn` chains

---

## File Operations

### Path Format Consistency

**Date**: 2025-12-16
**Mistake**: Mixed forward slashes and backslashes in Windows file paths
**Correct Approach**: Use forward slashes consistently in code/config; let Windows handle conversion
**Prevention**: Stick to forward slashes in all generated paths unless explicitly using Windows-specific APIs

---

## Dependencies

### Missing Import Statements

**Date**: 2025-12-16
**Mistake**: Used functions or modules without importing them in the file
**Correct Approach**: Always check existing imports and add required ones at the top of files
**Prevention**: Before using any utility function, verify it's imported or available in scope

---

_Add new entries below as they occur. Keep this file as a living document._

---

## GitHub Code Scanning

### "Configuration Not Found" - Root Cause and Permanent Fix

**Date**: 2025-12-23
**Root Cause**: The Branch-Protection check in OSSF Scorecard requires admin PAT token to run fully. Without the token (commented out in workflow), Scorecard still generates a `supply-chain/branch-protection` category when running on master, but does NOT generate it on PR branches. This causes GitHub Code Scanning to show "1 configuration not found" error on PRs because the baseline (master) has a category that the PR doesn't have.
**Temporary Fix (NOT RECOMMENDED)**: Deleting stale analyses via `gh api repos/{owner}/{repo}/code-scanning/analyses/{id}?confirm_delete=true --method DELETE` fixes the error temporarily, but the category is regenerated next time Scorecard runs on master.
**Permanent Fix**: Modify `.github/workflows/security-ossf-scorecard.yml` to only upload SARIF results on `pull_request` events, not on `push` to master. Add `if: github.event_name == 'pull_request'` to the 'Upload to code-scanning' step. This ensures master and PR branches have matching categories.
**Alternative Fix**: Enable `repo_token` with admin PAT so Branch-Protection runs on both master and PRs (requires creating SCORECARD_TOKEN secret), or migrate from Branch Protection to Repository Rules (accessible with default GITHUB_TOKEN).
**Prevention**: When configuring Scorecard workflow, ensure SARIF uploads only happen for events where the checks generate consistent categories. If a check requires admin access and you can't provide it, exclude that check or only upload on PRs.
