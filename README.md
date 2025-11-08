# Pinball Accuracy Memory Trainer

A specialized memory training tool for pinball players to practice and improve flipper shot accuracy recall. This progressive web application helps players internalize shot percentages for different flipper angles, with dynamic difficulty through drift mechanics and detailed performance feedback.

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
- **38+ pinball preset tables** - Pre-configured shot layouts from classic and modern pinball machines (Addams Family, Medieval Madness, Attack from Mars, etc.)
- **Custom shot creation** - Define shots using 19 base elements (Ramp, Orbit, Drops, Spinner, etc.) combined with 8 location modifiers
- **Image-based tiles** - Optional visual shot element thumbnails (extensible with JPG images in `/public/images/elements/`)
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
- **React 19** - Single-page application architecture
- **Vite** - Fast build tool with HMR
- **Tailwind CSS 4** - Utility-first styling
- **No backend** - 100% client-side, offline-capable

### Code Structure
- **Single-file app** - `src/App.jsx` (~3000 lines) containing all logic
- **Functional helpers** - Pure functions for percentage snapping, ordering, drift calculations
- **Custom hooks** - `useLocalStorage` for automatic state persistence
- **Isotonic regression** - Mathematical constraint solver for maintaining shot order during randomization/drift

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
npm run build
npm run preview
```

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

The app includes 38 preset pinball tables with pre-configured shot layouts:
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

Images display as 80×80px tiles with automatic fallback to text labels.

### Creating Custom Presets
Export your shot configuration via the export button (⬆ icon) in the setup table, then place the JSON file in `/public/presets/` and add an entry to `/public/presets/index.json`.

## Data Persistence

All state persists automatically to browser localStorage:
- Shot configurations (`pinball_rows_v1`)
- Session parameters (`pinball_driftEvery_v1`, `pinball_driftMag_v1`, etc.)
- Practice state (hidden values, mental model, attempts)
- UI preferences (fullscreen, panel visibility)

Clear browser data to reset the app completely.

## Performance Considerations

- **Attempt history capped at 200** entries to prevent unbounded growth
- **Efficient re-renders** via `useMemo` for expensive calculations
- **No component splitting** - Single-file architecture optimized for this scale (~3000 LOC)
- **Minimal dependencies** - Only React, React-DOM, and Tailwind

## Browser Support

- Modern browsers with ES6+ support (Chrome, Firefox, Edge, Safari)
- LocalStorage required
- Recommended: Desktop or tablet (optimal screen size)

## Development

### Project Structure
```
├── public/
│   ├── images/elements/    # Shot element image tiles (optional)
│   └── presets/            # Pre-configured table JSON files
├── src/
│   ├── App.jsx             # Main application (all logic)
│   ├── main.jsx            # React entry point
│   └── index.css           # Minimal global styles
├── .github/
│   └── copilot-instructions.md  # AI assistant guidelines
└── .vscode/
    └── launch.json         # Debugger configuration (Brave)
```

### Key Files
- **`src/App.jsx`** - Core application logic, helpers, components, state management
- **`.github/copilot-instructions.md`** - Comprehensive development guidelines for AI assistants
- **`vite.config.js`** - Build configuration with source maps enabled

### Debugging
Use the "Brave: Vite React" launch configuration in VS Code:
1. Start the dev server (`npm run dev`)
2. Press F5 to launch debugger
3. Set breakpoints in `src/App.jsx`

## Contributing

See `.github/copilot-instructions.md` for detailed development guidelines, including:
- Architectural principles
- State model documentation
- Ordering constraint rules
- Performance guidelines
- Coding conventions

## License

Private repository - all rights reserved.

## Acknowledgments

Built for the pinball community to help players improve their shot accuracy recall and develop better muscle memory for competitive play.

