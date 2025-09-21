# AI Coding Agent Instructions

Purpose: Enable immediate productivity when modifying the Pinball Accuracy Memory Trainer (React + Vite + Tailwind) single–page app.

## Big Picture
- Single file feature logic lives in `src/App.jsx`; bootstrap in `src/main.jsx` with Vite + React 19 + Tailwind (v4 via `@tailwindcss/vite`).
- No backend: all persistence uses `localStorage` through a custom `useLocalStorage` hook that mirrors state on every change.
- Core concept: an array of shot "rows" (state key `pinball_rows_v1`) each with `{ id, type, side, init }`.
- A hidden drifting truth matrix (`hidden`) vs player mental model (`mental`) drive practice, scoring, and final recall.
- Drift preserves original relative ordering using isotonic regression (Pool Adjacent Violators) so difficulty comes from value movement, not reordering.

## Data & State Keys
Defined in `App.jsx` via `useLocalStorage` (all keys prefixed `pinball_`):
- `rows_v1`: shots array (structure may be upgraded by `upgradeLegacyRows`).
- `randRange_v1`, `tol_v1`, `driftEvery_v1`, `driftMag_v1`, `driftBias_v1`: session parameters.
- `initialized_v1`: session active flag.
- `hidden_v1`: hidden percentages aligned by row index.
- `mental_v1`: mutable player mental model values.
- `mode_v1`: 'manual' | 'random'.
- `sel_v1`: selected shot index.
- `guess_v1`: current numeric guess input.
- `attempts_v1`, `attemptCount_v1`: list + count (attempt objects trimmed to 200 entries).
- `showTruth_v1`: dev/debug toggle.
- `finalPhase_v1`, `finalRecall_v1`: final recall stage & values.
- `showMentalModel_v1`: visibility toggle for mental model panel.

(See the exact keys in `grep useLocalStorage("pinball_` before adding new ones; keep naming consistent: `pinball_<camelCase>_v1`).

## Rows / Shots Model
- New schema uses `type` (one of `SHOT_TYPES`) and `side` (`'L'|'R'`) instead of free-text names.
- Helper `rowDisplay(row)` yields UI label: `L • Left Ramp`.
- Legacy rows with `name` are upgraded on the fly by `upgradeLegacyRows`; add any future schema migrations similarly (pure functions, id stable).
- Always preserve `id` for reconciliation & input focus. Use `ROW_ID_SEED++` for new rows.

## Key Algorithms
- `isotonicNonDecreasing(values)`: ensures hidden values maintain initial ordering after drift. If modifying, preserve O(n) amortized merging structure.
- Drift application occurs in a `useEffect` gated by `attemptCount % driftEvery === 0`.
- Scoring: points = `max(0, 100 - |delta|)`; severity buckets and label derive from `perfectTol`.

## UI / Components
- All structural UI is inside `App.jsx`; minimal presentational helpers: `Section`, `NumberInput`, `Chip`.
- Tailwind utility classes only. Keep new styling consistent (rounded-2xl containers, text-sm for tables, chips use small rounded-full with active dark style).
- When adding new panels: follow pattern `<Section title="..." right={...}>...</Section>` and put state toggles in `right`.
- Expand layout grid by adjusting `lg:grid-cols-*` counts depending on optional middle column visibility.

## Patterns & Conventions
- State updates: use functional `setState(prev => ...)` when derived from previous array (`rows`, `mental`, `attempts`).
- Keep arrays immutable (spread + replace index) to retain React reconciliation.
- Attempt history capped at 200 entries: if adding new data to attempts, remain mindful of slicing logic.
- Random shot selection avoids immediate repeat (up to 5 retries) via `pickRandomIdx()`.
- Numeric inputs: `validatePercent` clamps to 0–100; gracefully ignore invalid parse (`null`).
- Persisted schema changes: introduce an upgrade function similar to `upgradeLegacyRows`.

## Adding Features Safely
1. Identify required new state; prefer reusing existing shape if derivative.
2. Add new localStorage key with `_v1` suffix (increment version only on breaking schema changes).
3. If altering `rows` shape, write an idempotent upgrade function and call it when reading/mapping.
4. Keep scoring & drift logic unchanged unless intentionally refactoring; update documentation comments if modified.
5. Use `rowDisplay` everywhere you present a shot; do not duplicate formatting logic.

## Build & Run
- Dev server: `npm run dev` (Vite, fixed port 5173 per `vite.config.js`).
- Production build: `npm run build`; preview with `npm run preview`.
- Lint: `npm run lint` (ESLint flat config `eslint.config.js`). Add rules there rather than inline disables when possible.

## When Modifying
- Before removing fields from attempts or rows, search usages (`grep` for property) to avoid stale references.
- After large edits to `rows` or attempt structure, manually test: start session, make several attempts, enable drift, enter final recall.
- Avoid introducing additional top-level files unless splitting becomes necessary; if splitting, move helpers (algorithms, upgrade functions) to `src/lib/` and update import paths consistently.

## Examples
- Adding a shot: `setRows(r => [...ensureRowIds(r), newRow({ type: 'Spinner', side: 'R', init: 55 })]);`
- Adjust attempt cap: modify slice length in `setAttempts` call (`.slice(0, 200)`).
- Add new parameter (e.g., decayRate): define `const [decayRate, setDecayRate] = useLocalStorage("pinball_decayRate_v1", 0);` then include in drift effect dependency list.

Keep instructions concise—extend only with patterns proven in code. Ask maintainer if a change feels architectural.
