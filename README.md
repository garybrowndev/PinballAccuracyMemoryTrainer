# Pinball Accuracy Memory Trainer

[![Release](https://img.shields.io/github/v/release/garybrowndev/PinballAccuracyMemoryTrainer?style=flat-square)](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/releases)
[![License](https://img.shields.io/github/license/garybrowndev/PinballAccuracyMemoryTrainer?style=flat-square)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/garybrowndev/PinballAccuracyMemoryTrainer/auto-version-and-release.yml?branch=master&style=flat-square)](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/actions)
[![codecov](https://codecov.io/gh/garybrowndev/PinballAccuracyMemoryTrainer/branch/master/graph/badge.svg)](https://codecov.io/gh/garybrowndev/PinballAccuracyMemoryTrainer)
[![Last Commit](https://img.shields.io/github/last-commit/garybrowndev/PinballAccuracyMemoryTrainer?style=flat-square)](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/commits/master)
[![Issues](https://img.shields.io/github/issues/garybrowndev/PinballAccuracyMemoryTrainer?style=flat-square)](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/issues)
[![Code Size](https://img.shields.io/github/languages/code-size/garybrowndev/PinballAccuracyMemoryTrainer?style=flat-square)](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer)

## 🚀 Live Demo

<div align="center">
  
### [**🎯 Launch App**](https://garybrowndev.github.io/PinballAccuracyMemoryTrainer/)

[![App Screenshot](https://garybrowndev.github.io/PinballAccuracyMemoryTrainer/app-screenshot.jpg)](https://garybrowndev.github.io/PinballAccuracyMemoryTrainer/)

*Click the image above or the button to launch the app instantly in your browser*

</div>

**✨ Features at a Glance:**
- 🎮 Works completely offline with 39 preset pinball tables
- 🎯 Progressive training with dynamic drift mechanics
- 📊 Real-time performance tracking and feedback
- 💾 No download or installation required
- 🔒 All data stored locally in your browser

## A Note from the Author

Hi, I'm a competitive pinball player. Like many players, I've worked hard to improve my accuracy and aiming consistency. There are many ways to aim in pinball—some players use visual references, others use feel or timing. I personally aim by position on the flipper.

As games progress, players need to remember dozens of different shots and their optimal flipper positions. This project is my attempt to create a training tool to help develop that muscle memory and recall ability. It's designed to internalize shot accuracy recall so deeply that thinking becomes unnecessary—performance becomes instinctive under pressure during competitive play.

This is also an experiment in 100% pure AI "vibe coding"—every line of code in this project, along with the build scripts, GitHub workflows, Copilot instructions, and even this README file, has been written by AI. I just provide the prompts, review the output, and guide the direction.

I hope this tool helps improve your game. If you'd like to discuss pinball—strategy, techniques, theory, or have feedback—I'd be happy to connect.

— Gary Brown

---

## Overview

A specialized memory training tool for pinball players to practice and improve flipper shot accuracy recall. This progressive web application helps players develop muscle memory for shot percentages for different flipper angles, with dynamic difficulty through drift mechanics and detailed performance feedback.

## What It Does

The trainer helps pinball players develop muscle memory for shot accuracy by:

1. **Defining shot configurations** - Set up shots with specific base elements (Ramp, Orbit, Scoop, etc.) and locations (Left, Right, Center, etc.)
2. **Guessing flipper percentages** - Each shot has accuracy percentages for both left and right flippers (0-100% in 5% increments)
3. **Testing recall** - After memorizing the percentages, the app hides the true values and you must recall them from memory
4. **Dynamic difficulty** - True values gradually "drift" within bounds as you practice, preventing rote memorization
5. **Performance tracking** - Detailed feedback on accuracy, adjustment quality, and overall performance

## Key Features

### Shot Configuration
- **Visual playfield editor** - Arrange shots spatially on an arc-based layout with visual flipper representations
- **39 pinball preset tables** - Pre-configured shot layouts from classic and modern pinball machines (Addams Family, Medieval Madness, Attack from Mars, etc.)
- **Custom shot creation** - Setup shots using 19 base elements (Ramp, Orbit, Drops, Spinner, etc.) combined with 8 location modifiers (Left, Right, Center, Side, Top, Upper, Bottom, Lower)
- **Image-based tiles** - Optional visual shot element thumbnails with 80×80px tiles (extensible with JPG images in `/public/images/elements/`)
- **Export/import** - Save your custom shot configurations as JSON files

### Training Mechanics
- **Ordering constraints** - Left flipper shots must be strictly increasing (harder shots = higher %), right flipper strictly decreasing
- **0 = "Not Possible"** - Special semantic value for impossible shots from a specific flipper
- **Drift system** - Hidden truth values shift periodically within ±20% bounds to keep you on your toes
- **Two practice modes**:
  - **Manual** - Pick any shot/flipper combination to practice
  - **Random** - App randomly selects shots to reduce bias

### Feedback & Scoring
- **Four severity levels**:
  - **Perfect** (0% error) - Bright green
  - **Slight** (5% error) - Dark green  
  - **Fairly** (10% error) - Yellow
  - **Very** (≥15% error) - Red
- **Adjustment tracking** - Points awarded for correct directional adjustments on repeated attempts
- **Visual feedback** - Color-coded feedback pills show shot direction (early/late) with severity
- **Performance metrics** - Total points, average absolute error, attempt history
- **Final recall test** - Complete memory test of all shots at session end

### UI/UX
- **Fullscreen playfield mode** - Practice with an uncluttered, immersive view
- **Responsive design** - Works on desktop and tablet devices
- **Visual shot lines** - See percentage markers on flippers during practice
- **Drag-and-drop reordering** - Reorganize shot sequences in setup (with visual insertion indicators)
- **Mental model tracking** - Optional display of your evolving accuracy guesses
- **Persistent state** - All data saved to localStorage (no backend required)

## Technical Architecture

### Stack
- **React 19.1.1** - Single-page application with functional components and hooks
- **Vite 7.1.6** - Lightning-fast build tool with Hot Module Replacement (HMR)
- **Tailwind CSS 4.1.13** - Utility-first styling with Vite plugin integration
- **No backend** - 100% client-side, offline-capable with localStorage persistence

### Code Structure
- **Single-file app** - `src/app.jsx` (~3800 lines) containing all logic
- **Functional helpers** - Pure functions for percentage snapping, ordering, drift calculations
- **Custom hooks** - `useLocalStorage` for automatic state persistence
- **Isotonic regression** - Mathematical constraint solver for maintaining shot order during randomization/drift
- **Portal-based modals** - Using React's `createPortal` for modal dialogs

### Key Algorithms

#### Percentage Snapping
All values snap to 5% increments (0, 5, 10, ..., 100) to maintain consistency and prevent floating-point issues.

#### Ordering Constraints
- **Left flipper**: Values must be strictly increasing top-to-bottom (index 0 < index 1 < ...)
- **Right flipper**: Values must be strictly decreasing top-to-bottom (index 0 > index 1 > ...)
- **Constraint enforcement**: Uses bounded isotonic regression when randomizing/drifting values

#### Drift Mechanics
- **Frequency**: Configurable (e.g., every 4 attempts)
- **Magnitude**: Configurable steps (e.g., 2 steps = ±10%)
- **Bounds**: Each shot can drift ±20% from its base value (4 steps max)
- **Order preservation**: Drift maintains left-ascending/right-descending order constraints

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd PinballAccuracyMemoryTrainer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
# Standard Vite build (outputs to dist/)
npm run build
npm run preview

# Standalone single-file build with embedded assets
npm run build:standalone
```

The `build:standalone` script creates a self-contained HTML file (`pinball-trainer-standalone.html`) with:
- All CSS and JavaScript inlined
- All shot element images embedded as base64 data URIs
- All 39 preset configurations embedded
- No external dependencies - works completely offline
- Automatic lint check before build

## Usage Guide

### 1. Setup Phase
1. **Add shots** - Click "+ Add Shot(s)" to create empty rows, or load a preset table
2. **Configure shots** - Click shot type chips to select base element and location
3. **Set percentages** - Enter left/right flipper accuracy values (must maintain ordering)
4. **Visual layout** - Shots auto-arrange on the playfield arc
5. **Adjust parameters**:
   - **Initial random steps** (0-4): How far hidden values start from your guesses
   - **Drift every N attempts**: Frequency of hidden value shifts
   - **Drift magnitude** (0-10): Maximum distance values can drift
   - **Mode**: Manual (you pick) or Random (app picks)

### 2. Practice Phase
1. Click "Start Session" (or press Enter)
2. See the selected shot highlighted on the playfield
3. Enter your percentage guess (0-100, where 0 = Not Possible)
4. Receive instant feedback with color-coded accuracy
5. View visual feedback line showing early/late direction
6. Continue practicing as hidden values drift
7. Toggle "Show Mental Model" to see your evolving guesses
8. Toggle "Show Attempt History" to review past attempts

### 3. Final Recall
1. Click "End Session & Final Recall"
2. Enter all shot percentages from memory
3. Click "Grade Final Recall" to see your score
4. Toggle "Show Truth" to compare against actual values

## Presets

The app includes 39 preset pinball tables (including `index.json`) with pre-configured shot layouts:
- Classic tables: Addams Family, Medieval Madness, Twilight Zone, Funhouse
- Modern Stern: Deadpool, Godzilla, Jurassic Park, JAWS
- Williams/Bally classics: Attack from Mars, Monster Bash, White Water
- And many more!

Load presets from the "+ Add Shot(s)" popup in the setup screen.

## Customization

### Adding Shot Element Images
Place JPG files in `/public/images/elements/` with kebab-case filenames matching element names:
- `ramp.jpg` for "Ramp"
- `left-orbit.jpg` for "Left Orbit"
- `center-scoop.jpg` for "Center Scoop"

Images display as 80×80px tiles with automatic fallback to text labels. The standalone build automatically embeds all images as base64 data URIs.

### Creating Custom Presets
1. Export your shot configuration via the export button (⬆ icon) in the setup table
2. Place the JSON file in `/public/presets/`
3. Add an entry to `/public/presets/index.json` with the table name and filename
4. Preset will appear in the "+ Add Shot(s)" popup

### Element and Location Options
**Base Elements (19):**
Ramp, Standups, Orbit, Drops, Spinner, Scoop, Lane, Toy, Captive Ball, Saucer, Loop, Lock, VUK, Bumper, Deadend, Gate, Magnet, Rollover, Vari Target, Roto Target

**Location Modifiers (8):**
Left, Right, Center, Side, Top, Upper, Bottom, Lower

Locations can be omitted for base-element-only shots.

## Data Persistence

All state persists automatically to browser localStorage:
- Shot configurations (`pinball_rows_v1`)
- Practice parameters (`pinball_driftEvery_v1`, `pinball_driftMag_v1`, etc.)
- Practice state (hidden values, mental model, attempts)
- UI preferences (fullscreen, panel visibility)

Clear browser data to reset the app completely.

## Performance Considerations

- **Attempt history capped at 200** entries to prevent unbounded growth
- **Efficient re-renders** via `useMemo` for expensive calculations (drift, ordering, visual layout)
- **Single-file architecture** - Optimized for this scale (~3800 LOC), no component splitting overhead
- **Minimal dependencies** - Only React 19, React-DOM, and Tailwind CSS
- **Source maps enabled** - Full debugging support in development
- **Strict linting** - 80+ ESLint rules enforced with zero warnings policy

## Browser Support

- Modern browsers with ES6+ support (Chrome, Firefox, Edge, Safari)
- LocalStorage required for state persistence
- Recommended: Desktop or tablet (optimal screen size for playfield visualization)
- Tested with Brave browser in development

## Development

### Available Scripts

- **`npm install`** - Install all dependencies
- **`npm run dev`** - Start Vite development server (port 5173)
- **`npm run build`** - Build for production (outputs to `dist/`)
- **`npm run build:standalone`** - Build self-contained single HTML file with embedded assets (includes lint and test checks)
- **`npm run lint`** - Run ESLint with strict error checking (max warnings: 0)
- **`npm run test`** - Run Vitest unit tests in watch mode
- **`npm run test:run`** - Run Vitest unit tests once
- **`npm run test:ui`** - Run Vitest with interactive UI
- **`npm run test:e2e`** - Run Playwright E2E tests
- **`npm run test:e2e:ui`** - Run Playwright tests with interactive UI
- **`npm run test:e2e:headed`** - Run Playwright tests in headed mode (visible browser)
- **`npm run test:e2e:debug`** - Run Playwright tests in debug mode
- **`npm run preview`** - Preview production build locally

### VS Code Tasks

The project includes predefined VS Code tasks (`.vscode/tasks.json`):

1. **Install Dependencies** - Runs `npm install`
2. **Lint** - Runs ESLint with problem matcher integration
3. **Run Unit Tests** - Runs Vitest unit tests (depends on Lint)
4. **Run E2E Tests** - Runs Playwright E2E tests (depends on Unit Tests)
5. **Run All Tests** - Runs both unit and E2E tests sequentially
6. **npm: dev** - Starts Vite dev server (depends on all tests passing)
7. **npm: build:standalone** - Builds standalone HTML (script includes lint and test checks)
8. **Stop npm dev server** - PowerShell script to terminate Node.js processes for Vite

### Testing

The project includes two types of tests:

#### Unit Tests (Vitest)
- Fast, focused tests for individual functions and components
- Located in `src/` with `.test.jsx` extension
- Run with `npm run test` (watch mode) or `npm run test:run` (once)
- Interactive UI available with `npm run test:ui`

#### E2E Tests (Playwright)
- End-to-end tests simulating user interactions
- Located in `tests/e2e/`
- Run with `npm run test:e2e`
- Interactive UI available with `npm run test:e2e:ui`
- Debug mode available with `npm run test:e2e:debug`

#### Test Integration
Tests are automatically run in these scenarios:
- **Before standalone builds** - `npm run build:standalone` runs lint → unit tests → E2E tests → build
- **Before starting dev server** - VS Code task runs all tests before starting Vite
- **In CI/CD pipeline** - GitHub Actions runs lint → unit tests → E2E tests → build → deploy
- **Before commits** - Using the `commit-and-push` prompt runs lint → tests → build → commit → push

All test failures block the build process to ensure code quality.

### Project Structure
```
├── public/
│   ├── images/elements/    # Shot element image tiles (JPG format)
│   └── presets/            # 39 pre-configured table JSON files
├── src/
│   ├── app.jsx             # Main application (~3800 lines)
│   ├── app.css             # Component-specific styles
│   ├── main.jsx            # React entry point
│   └── index.css           # Global styles and Tailwind imports
├── .vscode/
│   ├── launch.json         # Debugger configuration (Brave browser)
│   └── tasks.json          # VS Code task definitions
├── .github/
│   └── copilot-instructions.md  # AI assistant development guidelines
├── build-standalone-complete.js # Standalone build script
├── eslint.config.js        # ESLint 9+ flat config with strict rules
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies and scripts
└── index.html              # HTML entry point
```

### Key Files
- **`src/app.jsx`** - Core application logic, state management, all components
- **`build-standalone-complete.js`** - Custom build script that embeds all assets into a single HTML file
- **`.github/copilot-instructions.md`** - Comprehensive development guidelines for AI assistants
- **`vite.config.js`** - Vite config with React plugin, Tailwind integration, and source maps
- **`eslint.config.js`** - Strict ESLint configuration with 80+ rules for code quality

### Debugging
Use the "Brave: Vite React (Single Tab)" launch configuration in VS Code:
1. Start the dev server (`npm run dev`) or press F5 (task runs automatically)
2. Debugger launches Brave browser in app mode
3. Set breakpoints in `src/app.jsx`
4. Dev server automatically stops when debugging ends

The launch config uses:
- Brave browser in app mode (`--app=http://localhost:5173`)
- Ephemeral user data directory (fresh profile per session)
- Disabled extensions and session restore
- Source map support enabled

## 💬 Community

Join the discussion and connect with other pinball players:
- **[Ask Questions](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/discussions/categories/q-a)** - Get help with setup, configuration, or usage
- **[Share Ideas](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/discussions/categories/ideas)** - Suggest new features or preset tables
- **[Show Your Results](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/discussions/categories/show-and-tell)** - Share your training progress and accuracy improvements
- **[General Discussion](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/discussions)** - Talk strategy, tournament prep, and pinball theory

## Contributing

See `.github/copilot-instructions.md` for detailed development guidelines, including:
- Architectural principles (single-file design, state management)
- State model documentation (localStorage keys, data structures)
- Ordering constraint rules (left ascending, right descending)
- Performance guidelines (memoization, render optimization)
- Coding conventions (ESLint rules, formatting standards)
- Build processes (standard and standalone builds)

## License

This project is licensed under the **MIT License** - one of the most permissive open source licenses available.

You are free to:
- ✅ Use this software for any purpose (personal, commercial, educational)
- ✅ Modify and adapt the code to your needs
- ✅ Distribute copies of the software
- ✅ Sublicense and incorporate it into your own projects

The only requirement is that you include the original copyright notice and license text in any copies or substantial portions of the software.

See the [LICENSE](LICENSE) file for the full license text.

## Acknowledgments

Built for the pinball community to help players improve their shot accuracy recall and develop better muscle memory for competitive play.

This project is free and open source - contributions, forks, and adaptations are welcome!

---

