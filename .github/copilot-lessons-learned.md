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
**Root Cause**: The Branch-Protection check in OSSF Scorecard requires admin PAT token to run fully. Without the token, Scorecard generates a `supply-chain/branch-protection` category on master but not on PRs. This mismatch causes "1 configuration not found" error on PRs.
**Rejected Fix**: Only uploading SARIF on PRs hides security status of the Master branch.
**Correct Fix**: Explicitly exclude the `Branch-Protection` check using the `checks_to_run` list in the workflow. This ensures the set of checks (and thus categories) is identical on both Master and PRs, without needing an Admin PAT.
**Prevention**: When configuring Scorecard without an Admin PAT, explicitly disable `Branch-Protection` to avoid category mismatches.

---

## CI/CD Workflows

### External Service Dependencies - Non-Blocking Checks

**Date**: 2025-12-17
**Mistake**: Workflow validation steps for external services (surge.sh) caused PR failures during service outages
**Correct Approach**: Add service availability check before validation; use `continue-on-error: true` to prevent blocking; provide clear messaging about service status
**Prevention**: Always design workflows with external dependencies to be non-blocking; follow GitHub Actions best practices for resilience
**Implementation Pattern**:

``yaml

- name: Check service availability
  id: service-check
  continue-on-error: true
  run: |
  if timeout 10 curl -sf https://service.com > /dev/null 2>&1; then
  echo "available=true" >> $GITHUB_OUTPUT
  else
  echo "available=false" >> $GITHUB_OUTPUT
  exit 1
  fi

- name: Validate deployment
  if: steps.service-check.outputs.available == 'true'
  run: # validation logic

- name: Report unavailability
  if: steps.service-check.outcome == 'failure'
  run: |
  echo "::notice title=Service Unavailable::Validation skipped due to service outage"
  ``
