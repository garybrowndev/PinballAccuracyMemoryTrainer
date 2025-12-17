# Copilot / AI Assistant Instructions

These guidelines help AI coding assistants work effectively within this project’s current architecture (a single-file advanced React app in `src/app.jsx`). Keep responses concise, respect existing patterns, and avoid unrequested large refactors.

---

## 1. Purpose & Audience

This repository hosts a Pinball Accuracy Memory Trainer. It’s an offline, client‑only, data-in-localStorage practice tool. Instructions target AI assistants (Copilot / Chat) and human contributors performing incremental enhancements.

## 2. Project Overview

- Stack: React + Vite, single dominant file: `src/app.jsx` (~2500+ lines).
- Styling: Tailwind utility classes (implicit via PostCSS/Vite setup).
- State Persistence: `useLocalStorage` wrapper for most session and config values.
- Data Model: Array of "rows" (shots) with per-flipper percent values plus multiple derived state arrays representing hidden truth, mental model, ordering, attempts, and final recall.
- No backend; all randomness/logic computed client-side.

## 3. Architectural Principles

- Single render surface; avoid prop drilling explosion—derived values via `useMemo` not global state libs.
- Deterministic snapping & ordering for flipper percentages (5% granularity) enforced at input & mutation sites.
- Separation of concerns by semantic grouping inside `app.jsx` (helpers → components → main state logic → UI sections).
- Overlay (fullscreen) implemented as in‑DOM portal, not true browser Fullscreen API.
- Minimal side effects: all listeners cleaned up in `useEffect` returns.

## 4. Key Helpers & Conventions

- `snap5(v)`: Always round percentage values to nearest 5; do not re‑introduce arbitrary granularity.
- `clamp(v, lo, hi)`: Boundary enforcement before persisting.
- `buildType(base, location)`: Combines shot base + location; keep logic centralized.
- Ordering helpers (`computeAllowedRange`, `isotonicWithBounds`, `strictlyIncrease`) must remain pure; avoid embedding UI conditionals inside them.
- Do not duplicate helper logic inline—import or reuse existing functions in the file.

## 5. State Model Map (Group by Concern)

Shot Definition:

- `rows` (persisted) — user-defined shots; each row: `{ id, base, location, type, initL, initR, x, y }`.

Session Initialization / Truth:

- `initialized`, `hiddenL`, `hiddenR`, `baseL`, `baseR`, `orderAscL`, `orderAscR`.

Mental & Final Recall:

- `mentalL`, `mentalR`, `finalRecallL`, `finalRecallR`, `finalPhase`.

Attempts / Feedback:

- `attempts` (prepend new), `attemptCount`, derived metrics: `totalPoints`, `avgAbsErr`.

UI / Presentation:

- `mode`, `selectedIdx`, `selectedSide`, `showMentalModel`, `showAttemptHistory`, `showFeedbackPanel`, `showTruth`, `playfieldFullscreen`, `fullscreenScale`.

Param Controls:

- `driftEvery`, `driftMag`, `initRandSteps`.

Ephemeral UI Anchors / Menus:

- `openShotMenuId`, `openLocMenuId`, `shotMenuAnchor`, `locMenuAnchor`, `addCountAnchor`, etc.

## 6. Percent & Ordering Logic Rules

- Percent values are discrete {0,5,10,…,100}.
- 0 means "Not Possible" – semantically different from 5 (lowest ordered positive value).
- Left flipper: strictly increasing (excluding 0’s which act as placeholders until first positive).
- Right flipper: strictly decreasing.
- Insert/pre-fill logic must preserve monotonicity; use existing normalization code as template.
- Drift operates in integer 5% steps limited by base ± (usableSteps \* 5) with isotonic enforcement.

## 7. Fullscreen & Overlay Behavior

- Controlled by `playfieldFullscreen` (custom overlay). Esc closes (listener in `useEffect`).
- **Browser Fullscreen API**: When `playfieldFullscreen` is true, the app also requests browser fullscreen via `requestBrowserFullscreen()` helper, hiding URL bar and navigation on mobile. On exit, `exitBrowserFullscreen()` is called.
- **Fullscreen change listener**: App listens for `fullscreenchange` events to sync React state when user exits fullscreen via browser controls (swipe down, hardware button).
- Scaling cap ~2.6 to prevent oversized boxes; scale computed relative to baseline width/height numbers.
- Avoid adding document-level listeners outside dedicated effects with cleanup.
- **PWA mode**: The app includes a web manifest (`public/manifest.json`) with `"display": "fullscreen"` for true fullscreen when installed to home screen.

## 8. Performance Guidelines

- Refrain from splitting into many small components unless a contained performance problem is measured (profiling first). Extra abstraction may hurt due to prop churn.
- Heavy calculations (ordering, drift) already isolated. If adding new derived collections, wrap in `useMemo` keyed by minimal dependencies.
- Avoid causing re-renders of the entire tree for small UI toggles—co-locate minor UI state where used if not persisted.
- Keep attempt list slicing shallow (currently capped at 200). If extending, consider virtualization only after measuring.

## 9. Accessibility & UX

- Buttons and interactive chips require discernible text; continue using text labels (or `aria-label`) for icon-only.
- Maintain sufficient color contrast (current palette acceptable; verify on new additions).
- Escape should dismiss newly added overlays or modals; follow existing pattern used for fullscreen.
- Ensure focus management if adding modal dialogs (return focus to trigger on close).

## 10. Refactoring Strategy

Incremental only. Acceptable small refactors:

- Extract self-contained presentational subtrees (e.g., metrics panel) if >150 lines and static props.
- Consolidate repetitive percentage display formatting into tiny shared helpers instead of inline duplication.
  Avoid until justified:
- Global state libraries.
- Over-eager splitting of `app.jsx` purely for size (risk of breaking tight coupling of helpers/state).

## 11. LocalStorage Versioning & Migration

- Keys are suffixed with `_v1`. If schema changes (e.g., new field in `rows`), implement a lightweight migration pass on load: detect missing field & fill default.
- Increment suffix only when incompatible (destructive) change; provide optional best-effort migration reading prior version keys first.

## 12. Adding Features Checklist

1. Define state shape & persistence need (localStorage or ephemeral?).
2. Reuse snap/clamp utilities for any numeric percent fields.
3. Guard new effects with dependency arrays; always clean up listeners/observers.
4. Update ordering & drift logic only if semantics change; avoid incidental coupling.
5. Provide UI affordances consistent with chips, tables, or existing panel paradigms.
6. Add discoverability hint if introducing a non-obvious control.
7. When editing via AI Agentic mode, provide a single unified patch / WorkspaceEdit (do not use "Streaming" method)

## 13. Coding Style & Linting

- Prefer small pure helper functions above component body.
- Single quotes not enforced; current file uses double quotes—stay consistent.
- Keep trailing commas minimal (match existing style).
- Snap & clamp before persisting or comparing thresholds.
- Derive rather than store values where possible (e.g., computed metrics).

## 14. Recommended Dev / Agent Tools

Use these during AI-driven changes to validate safety:

- Static analysis / lint: rely on `eslint.config.js` (invoke ESLint if integrated in workspace).
- Type/logic sanity: Run a quick search for helper usage before altering (`computeAllowedRange`, drift helpers) to avoid regression.
- Testing: Run `npm run test:run` for unit tests and `npm run test:e2e` for E2E tests before finalizing changes.
- DOM performance: Use browser Performance Profiler only if you observe jank with >100 attempts.
- Visual regression: Manual screenshot before/after for layout-affecting changes (overlay, scaling, chip grid).
- Memory sanity: Check detached listeners (DevTools > Performance > JS Heap snapshots) after toggling fullscreen repeatedly.

## 15. Testing Strategy

Current: Vitest unit tests and Playwright E2E tests.

### Test Types

- **Unit Tests (Vitest)**: Pure helper tests (snap5, ordering enforcement), component rendering smoke tests
- **E2E Tests (Playwright)**: Full user workflow tests including setup, practice, and recall phases

### Test Locations

- Unit tests: `src/*.test.jsx` (co-located with source files)
- E2E tests: `tests/e2e/*.spec.js`

### Running Tests

- Unit tests: `npm run test` (watch) or `npm run test:run` (once)
- E2E tests: `npm run test:e2e`
- All tests run automatically before:
  - Standalone builds (`npm run build:standalone`)
  - Dev server start (VS Code task)
  - CI/CD deployment (GitHub Actions)
  - Commits (via `commit-and-push` prompt)

### Test Guidelines

- Write unit tests for pure helpers and critical state logic
- Write E2E tests for user workflows and integration scenarios
- Tests must pass before builds/deploys (enforced in CI/CD)
- Keep unit tests fast (<100ms each)
- E2E tests should be deterministic (avoid flaky tests)

When adding new features:

1. Add unit tests for new helper functions
2. Add E2E tests for new user workflows
3. Run tests locally before committing
4. AI assistants should suggest tests when adding significant logic

## 16. Security & Data Boundaries

- All data local; no network I/O expected. Do not introduce remote calls without approval.
- Avoid embedding user-provided HTML; all labels come from controlled value sets.
- Randomness is non-cryptographic; acceptable for this training context.

## 17. Prompting Tips for AI Agents

When requesting code changes:

- Reference exact helper/function names.
- Specify whether change concerns: (a) percent logic, (b) UI layout, (c) drift/ordering, or (d) overlay behavior.
- If altering ordering/drift, restate invariant: left ascending / right descending with 5% steps.
- Ask for minimal diff & avoid formatting unrelated lines.

## 18. Learning from Mistakes: Persistent Error Log

**Purpose**: Maintain institutional knowledge across chat sessions to prevent repeated mistakes.

### The Problem

AI assistants often make the same mistakes across different chat sessions (or even within the same session), especially trivial errors like:

- Script syntax errors
- Missing dependencies
- Incorrect file paths
- Wrong parameter types
- Forgetting project-specific conventions

### The Solution

Maintain a persistent lessons-learned file at `.github/copilot-lessons-learned.md` that documents common mistakes and their solutions.

### When to Update the Lessons File

Update `.github/copilot-lessons-learned.md` whenever:

1. You encounter an error that was caused by your own mistake (not user error or external issues)
2. The mistake is something that could be prevented with better instructions
3. The error took more than one attempt to fix (iterative debugging)
4. You realize the mistake was trivial or could have been caught earlier
5. The mistake relates to project-specific conventions or patterns

### How to Update

1. **Before starting any significant work**: Read `.github/copilot-lessons-learned.md` to review previous mistakes
2. **When you make a mistake**: Append a new entry with:
   - Date
   - Brief description of the mistake
   - What you should have done instead
   - How to prevent it in the future
3. **Keep entries concise**: 2-4 lines per mistake
4. **Group related mistakes**: Use categories like "Build Scripts", "Testing", "File Paths", etc.

### Example Entry Format

```markdown
### [Category] - [Brief Title]

**Date**: YYYY-MM-DD
**Mistake**: [What went wrong]
**Correct Approach**: [What should have been done]
**Prevention**: [How to avoid this in future]
```

### Integration with Workflow

- The lessons file is automatically loaded as context for AI assistants via this instruction file
- Review it at the start of each session, especially for complex tasks
- Treat it as living documentation that evolves with the project
- If a lesson becomes obsolete (due to architecture changes), mark it as [DEPRECATED]

## 19. Anti‑Patterns to Avoid

- Introducing floating-point percent states (keep multiples of 5 enforced early).
- Duplicating localStorage keys or writing directly without the `useLocalStorage` hook pattern.
- Large unscoped refactors splitting file purely for aesthetics.
- Adding third-party state libraries for ephemeral UI toggles.
- Blocking main thread with large loops without measuring (row counts are small by design).

## 20. Glossary

- Shot Row: A single shot configuration entry (with flipper percentages).
- Hidden Truth: Randomized, drift-constrained true percentages user is recalling.
- Mental Model: User’s evolving guess matrix updated after each attempt.
- Drift: Periodic stochastic adjustment within bounded band, preserving ordering.
- Attempt: One recall submission (guess) containing delta, severity, adjustment metadata.

---

### Maintenance Notes

- Keep this file updated if semantic changes occur (drift algorithm, ordering constraints, fullscreen mechanism, or persistence schema).
- If file size of `app.jsx` grows > ~3500 lines, revisit controlled extraction plan.

### Quick Health Checklist Before Merging PRs

- Percent logic still enforces 5% increments.
- Escape exits fullscreen.
- Adding/removing shots keeps monotonic order constraints.
- No unbounded growth in `attempts` (capped logic intact if modified).
- All unit tests pass (`npm run test:run`).
- All E2E tests pass (`npm run test:e2e`).

End of instructions.
