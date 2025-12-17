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
