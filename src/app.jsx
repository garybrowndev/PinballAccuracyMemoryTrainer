import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Pinball Accuracy Memory Trainer — single-file React app
// Local, no backend. All data in memory + localStorage.
// Styling: Tailwind utility classes. No external UI libs.

// ---------- constants ----------
// Color constants for dark/light mode theming
/* eslint-disable sonarjs/no-duplicate-string */
const COLORS = {
  dark: {
    text: {
      primary: 'text-slate-100',
      secondary: 'text-slate-400',
      tertiary: 'text-slate-300',
      quaternary: 'text-slate-200',
      muted: 'text-slate-500',
    },
    bg: {
      primary: 'bg-slate-700',
      secondary: 'bg-slate-800/95',
      tertiary: 'bg-slate-800/80',
      hover: 'hover:bg-slate-700',
      hoverAlt: 'hover:bg-slate-600',
      button: 'bg-slate-700/90 hover:bg-slate-700',
    },
    border: {
      primary: 'border-slate-600',
      secondary: 'border-slate-700',
    },
  },
  light: {
    text: {
      primary: 'text-slate-900',
      secondary: 'text-slate-600',
      tertiary: 'text-slate-700',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-slate-50',
      tertiary: 'bg-white/80',
      hover: 'hover:bg-slate-50',
      hoverAlt: 'hover:bg-slate-100',
      button: 'bg-white/90 hover:bg-white',
    },
    border: {
      primary: 'border-slate-300',
    },
  },
};
/* eslint-enable sonarjs/no-duplicate-string */

// Button style constants
const BTN_SUCCESS = 'bg-emerald-600 hover:bg-emerald-700';
const BTN_ICON = 'px-4 py-2 rounded-2xl text-white flex items-center gap-2';
const BTN_BASE = 'px-4 py-2 rounded-2xl text-white';
/* eslint-disable sonarjs/no-duplicate-string */
const ICON_BTN_DARK = 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100';
const ICON_BTN_LIGHT = 'bg-white border-slate-300 text-slate-600 hover:text-slate-900';
const DARK_MODE_SWITCH_LIGHT = 'Switch to light mode';
const DARK_MODE_SWITCH_DARK = 'Switch to dark mode';
/* eslint-enable sonarjs/no-duplicate-string */

// Helper functions to get themed classes
const GetTextClass = (darkMode, variant = 'primary') => (darkMode ? COLORS.dark.text[variant] : COLORS.light.text[variant]);
const GetBgClass = (darkMode, variant = 'primary') => (darkMode ? COLORS.dark.bg[variant] : COLORS.light.bg[variant]);
const GetBorderClass = (darkMode) => (darkMode ? COLORS.dark.border.primary : COLORS.light.border.primary);
const GetButtonClass = (darkMode) => (darkMode ? COLORS.dark.bg.button : COLORS.light.bg.button);
const GetHoverClass = (darkMode) => (darkMode ? COLORS.dark.bg.hover : COLORS.light.bg.hover);
const GetHoverAltClass = (darkMode) => (darkMode ? COLORS.dark.bg.hoverAlt : COLORS.light.bg.hoverAlt);
const GetIconButtonClass = (darkMode) => `w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? `${COLORS.dark.bg.primary} ${COLORS.dark.border.primary} ${COLORS.dark.text.tertiary} hover:text-slate-100` : `${COLORS.light.bg.primary} ${COLORS.light.border.primary} text-slate-600 hover:text-slate-900`}`;
const GetSmallButtonClass = (darkMode) => `text-[11px] px-2 py-0.5 rounded-md ${GetButtonClass(darkMode)} text-slate-200 border ${GetBorderClass(darkMode)}`;
const GetCheckboxClass = (darkMode) => `w-4 h-4 rounded ${darkMode ? `${COLORS.dark.bg.primary} ${COLORS.dark.border.primary} checked:bg-blue-600 checked:border-blue-600 accent-blue-600 [color-scheme:dark]` : `${COLORS.light.bg.primary} ${COLORS.light.border.primary} accent-blue-600`}`;
const GetMetricBoxClass = (darkMode) => darkMode ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-300';

// ---------- helpers ----------
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function snap5(v) {
  return Math.min(100, Math.max(0, Math.round(v / 5) * 5));
}

// Seeded random number generator (Mulberry32)
const FIXED_SEED = 42; // Fixed seed value for reproducible randomness
let rngState = null;
function setSeed(enabled) {
  rngState = enabled ? (FIXED_SEED >>> 0) : null; // Convert to 32-bit unsigned integer if enabled
}
function seededRandom() {
  if (rngState === null) {
    return Math.random();
  }
  let t = rngState += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  rngState = t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

const rndInt = (a, b) => Math.floor(seededRandom() * (b - a + 1)) + a; // inclusive
// Format percentage values with at least two digits (00, 05, 10, ...) retaining % where appropriate.
const format2 = (n) => {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return String(v).padStart(2, '0');
};
const formatPct = (n) => `${format2(n)}%`;
// Helper to format initL/initR values (0 -> 'NP', null/undefined -> '—', otherwise format)
const formatInitValue = (val) => {
  if (val === 0) {
    return 'NP';
  }
  if (val === null || val === undefined) {
    return '—';
  }
  return format2(val);
};
// Severity color mapping (Perfect, Slight, Fairly, Very)
// Updated per request: perfect bright green, slight darker green, fairly yellow, very bright red
// Chosen accessible hues (WCAG contrast vs white/black text considered). Adjust if future theme changes.
const SEVERITY_COLORS = {
  perfect: '#4ade80', // lighter/brighter green (emerald-400)
  slight: '#15803d', // darker green (emerald-700)
  fairly: '#f59e0b', // yellow (amber-500)
  very: '#dc2626', // bright red (red-600)
};

// --- Image infrastructure for shot base element tiles ---
// In future you will host WebP images at a backend/static path. For now we attempt to load them optimistically.
// Convention: filename derived from element slug (lowercase, spaces -> dashes): e.g. "Left Ramp" -> "left-ramp.webp".
// If an image 404s the browser will show the fallback text layer (we keep text absolutely positioned).
// You can later move IMAGE_BASE_URL to an environment variable if desired.
const IMAGE_BASE_URL = '/images/elements'; // adjust when backend path known
function elementSlug(name) {
  return name.toLowerCase().replaceAll(/[^\da-z]+/g, '-').replaceAll(/^-+|-+$/g, '');
}
// Helper to get image src - checks for embedded images first (standalone mode), falls back to path
function getImageSrc(name) {
  const slug = elementSlug(name);
  // Check if EMBEDDED_IMAGES exists (set by standalone build)
  if (typeof window !== 'undefined' && window.EMBEDDED_IMAGES && window.EMBEDDED_IMAGES[slug]) {
    return window.EMBEDDED_IMAGES[slug];
  }
  return `${IMAGE_BASE_URL}/${slug}.webp`;
}

// Stable id generator for rows to prevent input remount/focus loss
let ROW_ID_SEED = 1;
// Square selectable tile for base element selection (replaces textual chips in popup)
const ElementTile = ({ name, selected, onSelect, hasSelection = true, darkMode = false }) => {
  const imgSrc = getImageSrc(name);
  const [imgVisible, setImgVisible] = React.useState(false); // show only after successful load
  const size = 80; // consistent square image size
  return (
    <button
      type="button"
      onClick={onSelect}
      className={(() => {
        const bgOffset = darkMode ? 'bg-slate-800 ring-offset-slate-800' : 'bg-white ring-offset-white';
        let ringClass;
        if (selected) {
          ringClass = 'ring-2 ring-slate-900';
        } else if (darkMode) {
          ringClass = 'ring-1 ring-slate-600 hover:ring-slate-500';
        } else {
          ringClass = 'ring-1 ring-slate-300 hover:ring-slate-500';
        }
        return `relative rounded-md shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-900 overflow-visible ${bgOffset} ring-offset-1 ${ringClass}`;
      })()}
      style={{
        width: size,
        height: size + 18,
        opacity: hasSelection && !selected ? 0.45 : 1,
      }}
      aria-pressed={selected}
    >
      <div className="absolute top-0 left-0" style={{ width: size, height: size }}>
        {!imgVisible && (
          <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium p-1 text-center leading-tight select-none ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {name}
          </div>
        )}
        <img
          src={imgSrc}
          alt={name}
          onLoad={() => setImgVisible(true)}
          onError={() => setImgVisible(false)}
          className={`${imgVisible ? 'opacity-100' : 'opacity-0'} absolute inset-0 w-full h-full object-cover transition-opacity duration-150 rounded-md`}
          draggable={false}
        />
      </div>
      <div className="absolute left-0" style={{ top: size, width: size }}>
        <div className="bg-black/55 backdrop-blur-[1px] text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center rounded-b-md select-none truncate">{name}</div>
      </div>
      {/* No black rectangle for selected */}
    </button>
  );
};

ElementTile.propTypes = {
  name: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  hasSelection: PropTypes.bool,
  darkMode: PropTypes.bool,
};

// Inline thumbnail used inside table cell (smaller API: no selection ring offset, but clickable area opens menu / toggles)
const InlineElementThumb = ({ name, selected, onClick, darkMode = false }) => {
  const imgSrc = name ? getImageSrc(name) : null;
  const [imgVisible, setImgVisible] = React.useState(false);
  const size = 80; // square image area
  if (!name) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-shot-chip-thumb
      className={(() => {
        let ringClass;
        if (selected) {
          ringClass = 'ring-2 ring-slate-900';
        } else if (darkMode) {
          ringClass = 'ring-1 ring-slate-600 hover:ring-slate-500';
        } else {
          ringClass = 'ring-1 ring-slate-300 hover:ring-slate-500';
        }
        const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
        return `${ringClass} relative shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-900 rounded-md overflow-visible ${bgClass}`;
      })()}
      style={{ width: size, height: size + 18 }} // extra space for hanging label
      aria-pressed={selected}
    >
      <div className="absolute top-0 left-0" style={{ width: size, height: size }}>
        {!imgVisible && (
          <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium p-1 text-center leading-tight select-none ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {name}
          </div>
        )}
        {Boolean(imgSrc) && (
          <img
            src={imgSrc}
            alt={name}
            onLoad={() => setImgVisible(true)}
            onError={() => setImgVisible(false)}
            className={`${imgVisible ? 'opacity-100' : 'opacity-0'} absolute inset-0 w-full h-full object-cover transition-opacity duration-150 rounded-md`}
            draggable={false}
          />
        )}
      </div>
      {/* Hanging label below the square image (no longer overlapping). Use same style but positioned outside. */}
      <div className="absolute left-0" style={{ top: size, width: size }}>
        <div className="bg-black/55 backdrop-blur-[1px] text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center rounded-b-md select-none truncate">{name}</div>
      </div>
    </button>
  );
};

InlineElementThumb.propTypes = {
  name: PropTypes.string,
  selected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
};

// New taxonomy: separate base element from location. All bases share the same location set.
// Location 'Base' (or null) means unsuffixed (e.g. "Ramp").
// BASE_ELEMENTS ordered (most common -> least common) as of 2025‑09‑26.
// Methodology (lightweight composite prevalence score):
//  1. Core reference: Typical modern (DMD / LCD) layouts from top manufacturers (Stern, Williams/Bally WPC, Jersey Jack) sampled mentally (~40 well-known titles).
//  2. Relative frequency buckets (Very Common, Common, Regular, Occasional, Rare, Novelty) scored 6..1 then sorted.
//  3. Cross-checked against feature descriptions & prevalence implied in Wikipedia "Components" section (Bumpers, Targets, Ramps, Spinners, Holes/Saucers, etc.).
//  4. Combined multi-target groupings: 'Standups' (spot targets) and 'Drops' treated separately due to distinct strategic behavior.
const BASE_ELEMENTS = [
  // Very Common / Core geometry & ubiquitous scoring surfaces
  'Ramp', 'Standups', 'Orbit', 'Drops', 'Spinner', 'Scoop', 'Lane',
  // Common but slightly more situational or not on every single game
  'Toy', 'Captive Ball', 'Saucer', 'Loop',
  // Regular specialty / feature mechs & control elements
  'Lock', 'VUK', 'Bumper', 'Deadend', 'Gate', 'Magnet',
  // Occasional (era or design style dependent)
  'Rollover', 'Vari Target', 'Roto Target',
];
// Added extended location variants to support richer spatial descriptors in practice:
// Previous: Left, Center, Right. New additions: Bottom, Top, Upper, Lower, Side.
// These simply expand selectable suffixes; no logic elsewhere depends on specific set/order.
const LOCATIONS = ['Left', 'Right', 'Center', 'Side', 'Top', 'Upper', 'Bottom', 'Lower'];

function buildType(base, location) {
  if (!base) {
    return '';
  }
  // If no location specified, return base unsuffixed
  if (!location) {
    return base;
  }
  // 'Base' sentinel or empty string both mean unsuffixed
  if (location === 'Base') {
    return base;
  }
  return `${location} ${base}`;
}
const FLIPPERS = ['L', 'R']; // left/right flippers

// Current row schema only
// Create a new shot row; if caller doesn't supply x/y we auto-distribute them to avoid overlap.
const newRow = (over = {}, indexHint = 0) => {
  const base = over.base || '';
  const location = over.location || '';
  const type = buildType(base, location);
  return {
    id: ROW_ID_SEED++,
    base,
    location,
    type,
    initL: over.initL ?? 50,
    initR: over.initR ?? 50,
    // Provide a basic fan-out pattern: stagger horizontally & vertically based on index.
    x: 0.2 + ((indexHint % 6) * 0.12), // wraps every 6
    y: 0.15 + Math.floor(indexHint / 6) * 0.18,
    ...over,
  };
};

function rowDisplay(r) {
  return r ? (r.type || buildType(r.base, r.location)) : '';
}
function rowDisplayWithSide(r, side) {
  return r ? `${side === 'L' ? 'Left Flipper' : 'Right Flipper'} → ${rowDisplay(r)}` : '';
}


// Compute inclusive min/max positive (>=5) range for slider given ordering constraints (0 neutral/not part of ordering)
// Left flipper: strictly INCREASING top->bottom (low -> high)
// Right flipper: strictly DECREASING top->bottom (high -> low)
function computeAllowedRange(rows, side, index) {
  const vals = side === 'L' ? rows.map(r => r.initL) : rows.map(r => r.initR);
  const earlierPos = vals.slice(0, index).filter(v => v !== null && v !== undefined && v > 0);
  const laterPos = vals.slice(index + 1).filter(v => v !== null && v !== undefined && v > 0);
  if (side === 'L') {
    let minAllowed = earlierPos.length > 0 ? Math.max(...earlierPos) + 5 : 5; // greater than largest earlier
    let maxAllowed = laterPos.length > 0 ? Math.min(...laterPos) - 5 : 100; // less than smallest later
    minAllowed = Math.max(5, minAllowed);
    maxAllowed = Math.min(100, maxAllowed);
    if (minAllowed > maxAllowed) {
      return null;
    }
    return [minAllowed, maxAllowed];
  } else { // Right: descending
    // For descending: value[i] < all earlier positives AND value[i] > all later positives.
    let maxAllowed = earlierPos.length > 0 ? Math.min(...earlierPos) - 5 : 100; // smaller than smallest earlier
    let minAllowed = laterPos.length > 0 ? Math.max(...laterPos) + 5 : 5; // greater than largest later
    maxAllowed = Math.min(100, maxAllowed);
    minAllowed = Math.max(5, minAllowed);
    if (minAllowed > maxAllowed) {
      return null;
    }
    return [minAllowed, maxAllowed];
  }
}


// Bounded isotonic regression preserving initial ordering defined by orderAsc.
// Each point i constrained within base[i] ± 20 and 0..100; values snapped to 5.
// Special handling: 0 ("Not Possible") values are never modified and don't participate in ordering.
function isotonicWithBounds(current, base, orderAsc) {
  if (current.length === 0) {
    return current;
  }
  const lower = base.map(v => Math.max(0, v - 20));
  const upper = base.map(v => Math.min(100, v + 20));
  const inOrderIdx = orderAsc;
  const values = inOrderIdx.map(i => current[i]);
  const lowers = inOrderIdx.map(i => lower[i]);
  const uppers = inOrderIdx.map(i => upper[i]);
  const blocks = [];
  for (const [i, sum] of values.entries()) {
    // Skip "Not Possible" (0) values - they never change
    if (sum === 0 || base[inOrderIdx[i]] === 0) {
      blocks.push({ sum: 0, count: 1, lb: 0, ub: 0, value: 0, isNotPossible: true });
      continue;
    }
    const count = 1;
    const lb = lowers[i];
    const ub = uppers[i];
    let mean = sum / count; if (mean < lb) {
      mean = lb;
    } else if (mean > ub) {
      mean = ub;
    }
    const val = snap5(mean);
    blocks.push({ sum, count, lb, ub, value: val, isNotPossible: false });
    while (blocks.length >= 2 && !blocks.at(-2).isNotPossible && !blocks.at(-1).isNotPossible && blocks.at(-2).value > blocks.at(-1).value) {
      const b = blocks.pop();
      const a = blocks.pop();
      const merged = { sum: a.sum + b.sum, count: a.count + b.count, lb: Math.max(a.lb, b.lb), ub: Math.min(a.ub, b.ub), value: 0, isNotPossible: false };
      let m = merged.sum / merged.count; if (m < merged.lb) {
        m = merged.lb;
      } else if (m > merged.ub) {
        m = merged.ub;
      }
      merged.value = snap5(m);
      blocks.push(merged);
    }
  }
  const adjusted = Array.from({ length: values.length });
  let k = 0; for (const bl of blocks) {
    for (let j = 0;j < bl.count;j++) {
      adjusted[k++] = bl.isNotPossible ? 0 : snap5(Math.min(bl.ub, Math.max(bl.lb, bl.value)));
    }
  }
  const next = [...current];
  for (const [i, element] of inOrderIdx.entries()) {
    next[element] = adjusted[i];
  }
  return next;
}

// Ensure strict increasing / decreasing ordering (depending on provided index order) within ±20 bounds and snapping to 5.
// Special handling: 0 ("Not Possible") values are never modified and don't participate in ordering constraints.
// eslint-disable-next-line sonarjs/cognitive-complexity
function strictlyIncrease(values, base, orderAsc) {
  if (values.length === 0) {
    return values;
  }
  const idxs = orderAsc;
  const arr = idxs.map(i => values[i]);
  const bases = idxs.map(i => base[i]);
  for (let i = 1;i < arr.length;i++) {
    // Skip if current or previous value is "Not Possible" (0)
    if (arr[i] === 0 || bases[i] === 0 || arr[i - 1] === 0 || bases[i - 1] === 0) {
      continue;
    }
    if (arr[i] <= arr[i - 1]) {
      const b = bases[i];
      const hi = Math.min(100, b + 20);
      let candidate = snap5(arr[i - 1] + 5);
      if (candidate > hi) {
        let j = i - 1;
        while (j >= 0 && candidate > hi) {
          const bj = bases[j];
          const loPrev = Math.max(0, bj - 20);
          const lowered = snap5(arr[j] - 5);
          if (lowered >= loPrev && (j === 0 || lowered > arr[j - 1])) {
            arr[j] = lowered;
          } else {
            break;
          }
          candidate = snap5(arr[i - 1] + 5);
          j--;
        }
        candidate = Math.min(hi, candidate);
      }
      if (candidate <= arr[i - 1]) {
        candidate = arr[i - 1] + 5;
      }
      arr[i] = candidate;
    }
  }
  const out = [...values];
  for (const [k, idx] of idxs.entries()) {
    out[idx] = arr[k];
  }
  for (let k = 0;k < idxs.length;k++) {
    const i = idxs[k];
    const b = base[i];
    // Never modify "Not Possible" (0) values
    if (out[i] === 0 || b === 0) {
      continue;
    }
    const lo = Math.max(0, b - 20), hi = Math.min(100, b + 20);
    out[i] = snap5(Math.min(hi, Math.max(lo, out[i])));
    if (k > 0) {
      const prevIdx = idxs[k - 1];
      // Only enforce ordering if neither current nor previous is "Not Possible" (0)
      if (out[prevIdx] !== 0 && base[prevIdx] !== 0 && out[i] <= out[prevIdx]) {
        let nv = snap5(out[prevIdx] + 5);
        if (nv > hi) {
          nv = hi;
        }
        out[i] = nv;
      }
    }
  }
  return out;
}


function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch { /* noop persist failure */ }
  }, [key, state]);
  return [state, setState];
}

// Reusable presentational components hoisted out of App to keep stable identity
const Section = ({ title, children, right, darkMode = false }) => {
  const bgClass = darkMode ? COLORS.dark.bg.tertiary : COLORS.light.bg.tertiary;
  const textClass = GetTextClass(darkMode, 'primary');
  return (
    <div className={`rounded-2xl shadow p-4 md:p-6 mb-6 ${bgClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-lg md:text-xl font-semibold ${textClass}`}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
};

Section.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  right: PropTypes.node,
  darkMode: PropTypes.bool,
};

const NumberInput = React.forwardRef(({ value, onChange, min = 0, max = 100, step = 1, className = '', onKeyDown, darkMode = false }, ref) => {
  const inputClasses = darkMode
    ? `${COLORS.dark.bg.primary} ${COLORS.dark.border.primary} ${COLORS.dark.text.primary} focus:ring-slate-500`
    : `${COLORS.light.bg.primary} ${COLORS.light.border.primary} ${COLORS.light.text.primary} focus:ring-slate-400`;
  return (
    <input
      ref={ref}
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-12 px-2 py-1 border rounded-xl text-sm focus:outline-none focus:ring ${inputClasses} ${className || ''}`}
    />
  );
});
NumberInput.displayName = 'NumberInput';

NumberInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  className: PropTypes.string,
  onKeyDown: PropTypes.func,
  darkMode: PropTypes.bool,
};

// Simple chip button (auto multi-line for 3+ word shot type labels)
const Chip = ({ active, children, onClick, className = '', disabled = false, darkMode = false }) => {
  let content = children;
  if (typeof children === 'string') {
    const words = children.split(' ').filter(Boolean);
    if (words.length >= 3) {
      content = (
        <span className="flex flex-col leading-tight items-center">
          <span>{words[0]}</span>
          <span>{words.slice(1).join(' ')}</span>
        </span>
      );
    }
  }
  const getChipClasses = () => {
    if (active) {
      return darkMode
        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
        : 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold';
    }
    return darkMode
      ? `${COLORS.dark.bg.tertiary} ${COLORS.dark.bg.hover} ${COLORS.dark.text.secondary} ${COLORS.dark.border.secondary} hover:border-slate-600`
      : `${COLORS.light.bg.primary} ${COLORS.light.bg.hoverAlt} ${COLORS.light.text.tertiary} ${COLORS.light.border.primary}`;
  };

  const disabledClass = disabled ? ' opacity-60 cursor-not-allowed' : '';
  const customClass = className ? ` ${className}` : '';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all select-none text-center inline-flex items-center justify-center ${getChipClasses()}${disabledClass}${customClass}`}
    >
      {content}
    </button>
  );
};

Chip.propTypes = {
  active: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  darkMode: PropTypes.bool,
};

// Simple playfield editor for arranging shots spatially & adjusting flipper percentages
const PlayfieldEditor = ({ rows, setRows, selectedId, setSelectedId, misorderedIds, onClear, onExample, advancedOptions, darkMode = false }) => {
  const canvasRef = React.useRef(null);
  // Track advanced options popover visibility
  const [showAdvancedPopover, setShowAdvancedPopover] = useState(false);
  // Track which shot images have successfully loaded (id -> true). Avoid per-item hooks inside map.
  const [imageLoadedMap, setImageLoadedMap] = useState({});
  // Track computed scale for rendering
  const [boxScale, setBoxScale] = useState(1);
  // Track actual canvas dimensions for responsive scaling
  const [canvasWidth, setCanvasWidth] = useState(800); // default assumption

  // ResizeObserver to track actual canvas width for responsive box scaling
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      // eslint-disable-next-line unicorn/no-useless-undefined
      return undefined;
    }

    // Initial measurement
    const initialRect = el.getBoundingClientRect();
    if (initialRect.width) {
      setCanvasWidth(initialRect.width);
    }

    let rafId = null;
    const ro = new ResizeObserver(entries => {
      // Cancel any pending update
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      // Schedule update for next animation frame for smooth real-time resizing
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            setCanvasWidth(w);
          }
        }
        rafId = null;
      });
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Auto-arrange rows along arc; effect recomputes when rows array changes length or order.
  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    // Arc geometry in virtual 1000-unit coordinate system
    // Adjust apex based on box size to prevent clipping at top
    const endpointY = 550;
    const baseApexY = 100;
    const n = rows.length;

    // Box sizing constraints (in pixels at actual canvas size)
    const MIN_BOX_SIZE = 50; // minimum box size in pixels
    const MAX_BOX_SIZE = 120; // maximum box size in pixels
    const MIN_GAP = 8; // minimum gap between boxes in pixels
    const MIN_EDGE_MARGIN = 10; // minimum margin from canvas edges to box edges in pixels

    // The edge margin needs to account for the fact that boxes are positioned by their CENTER
    // So we need: edgeMargin + halfBoxSize for the center position of edge boxes
    // Available width for box CENTERS = canvasWidth - 2*(MIN_EDGE_MARGIN + halfBoxSize)
    // But we don't know box size yet, so we solve iteratively:
    // Let's first calculate assuming max box size to get initial estimate
    const halfMaxBox = MAX_BOX_SIZE / 2;
    const availableForCenters = canvasWidth - 2 * (MIN_EDGE_MARGIN + halfMaxBox);

    // Calculate ideal box size to fill available space
    // n box centers spaced across availableForCenters, with MIN_GAP between box edges
    // Gap between centers = boxSize + MIN_GAP
    // Total span of centers = (n-1) * (boxSize + MIN_GAP)
    // So: (n-1) * (boxSize + MIN_GAP) <= availableForCenters
    // Solving: boxSize <= (availableForCenters / (n-1)) - MIN_GAP  [for n > 1]
    // For single box, use max size; for multiple, calculate size that fills the space
    const idealBoxSize = n === 1
      ? MAX_BOX_SIZE
      : (availableForCenters / (n - 1)) - MIN_GAP;

    // Clamp box size to min/max constraints
    const actualBoxSize = Math.max(MIN_BOX_SIZE, Math.min(MAX_BOX_SIZE, idealBoxSize));

    // Calculate the scale factor (base size is 80px)
    const baseBoxWidth = 80;
    const finalScale = actualBoxSize / baseBoxWidth;

    // Now calculate the actual margin for box centers (half box from edge + edge margin)
    const halfBox = actualBoxSize / 2;
    const centerMargin = MIN_EDGE_MARGIN + halfBox; // This is where the CENTER of edge boxes should be

    // Convert to virtual 1000-unit coordinate system for positioning
    const virtualCenterMargin = (centerMargin / canvasWidth) * 1000;
    const virtualUsableWidth = 1000 - (2 * virtualCenterMargin);

    // Adjust apex Y position to prevent top clipping
    // Half of the box in virtual units needs to fit above the apex
    // Canvas height is 384px (h-96), so 1000 virtual units = 384px
    const canvasHeight = 384; // h-96 = 24rem = 384px
    const halfBoxVirtual = (actualBoxSize / 2) / canvasHeight * 1000;
    const topPadding = 20; // extra padding in virtual units
    const apexY = Math.max(baseApexY, halfBoxVirtual + topPadding);

    const chord = 1000;
    const sagitta = endpointY - apexY;
    const R = (sagitta * sagitta + (chord / 2) * (chord / 2)) / (2 * sagitta);
    const centerY = apexY + R;
    const centerX = 500;

    const fracs = n === 1 ? [0.5] : Array.from({ length: n }, (_, i) => i / (n - 1));
    const newPositions = fracs.map(f => {
      // Compute x-coordinate: box centers evenly spaced with proper edge margins
      const xPos = virtualCenterMargin + f * virtualUsableWidth;
      // Project x onto the arc to find corresponding y: solve circle equation for y given x
      // Circle: (x - centerX)^2 + (y - centerY)^2 = R^2
      // Solve for y (taking the upper part of circle - negative sqrt since arc curves upward)
      const dx = xPos - centerX;
      const discriminant = R * R - dx * dx;
      // Arc is on upper part of circle (y < centerY), so take negative sqrt
      const yPos = discriminant >= 0 ? centerY - Math.sqrt(discriminant) : apexY;
      return { x: xPos / 1000, y: yPos / 1000 };
    });
    // Check if positions or scale changed
    let anyDiff = false;
    for (const [i, r] of rows.entries()) {
      const np = newPositions[i];
      if (r.x !== np.x || r.y !== np.y) {
        anyDiff = true; break;
      }
    }
    // Update scale if changed (compare with small epsilon for float precision)
    if (Math.abs(finalScale - boxScale) > 0.001) {
      setBoxScale(finalScale);
    }
    // Update positions if changed
    if (anyDiff) {
      setRows(prev => prev.map((r, i) => ({ ...r, x: newPositions[i].x, y: newPositions[i].y })));
    }
  }, [rows, setRows, boxScale, canvasWidth]);

  // Drag removed; no clamping helper needed.

  const handleMouseDown = (e, id) => {
    e.stopPropagation(); setSelectedId(id);
  };

  // Drag logic removed.

  // Violation highlighting removed earlier; now no ordering enforcement (free horizontal movement).

  return (
    <div className="mt-6">
      <h3 className={`font-medium mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Playfield Layout</h3>
      <div className={`text-xs mb-2 ${GetTextClass(darkMode, 'secondary')}`}>Shot positions auto-arranged along arc (updates on add/remove/reorder).</div>
      <div
        ref={canvasRef}
        className={`relative border rounded-xl bg-gradient-to-b h-96 overflow-hidden ${darkMode ? 'from-slate-800 to-slate-900 border-slate-700' : 'from-slate-50 to-slate-100 border-slate-300'}`}
        role="region"
        aria-label="Playfield layout"
      >
        {/* Clear all shots button placed inside playfield (bottom-left) when provided */}
        {Boolean(onClear) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); onClear();
            }}
            className={`absolute left-3 bottom-3 z-40 border shadow px-2 py-1 rounded-md text-xs flex items-center gap-2 ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border-slate-300'}`}
            title="Clear all shots"
            aria-label="Clear all shots"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
            </svg>
            <span className="hidden md:inline">Clear</span>
          </button>
        )}
        {/* Example button placed inside playfield (bottom-right) when provided */}
        {Boolean(onExample) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); onExample();
            }}
            className={`absolute right-3 bottom-3 z-40 border shadow px-2 py-1 rounded-md text-xs flex items-center gap-2 ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border-slate-300'}`}
            title="Load example shots"
            aria-label="Load example shots"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="hidden md:inline">Example</span>
          </button>
        )}
        {/* Advanced options button with popover in top-right */}
        {Boolean(advancedOptions) && (
          <div className="absolute right-3 top-3 z-40">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAdvancedPopover(prev => !prev);
              }}
              className={(() => {
                const base = 'border shadow px-2 py-1 rounded-md text-xs flex items-center gap-2';
                if (showAdvancedPopover) {
                  return darkMode
                    ? `${base} bg-slate-600 border-slate-500 text-slate-100`
                    : `${base} bg-slate-200 border-slate-400 text-slate-900`;
                }
                return darkMode
                  ? `${base} bg-slate-700/90 hover:bg-slate-700 text-slate-200 border-slate-600`
                  : `${base} bg-white/90 hover:bg-white text-slate-700 border-slate-300`;
              })()}
              title="Advanced practice options"
              aria-label="Advanced practice options"
              aria-expanded={showAdvancedPopover}
              aria-haspopup="dialog"
            >
              {/* Sliders/adjustments icon - indicates advanced options */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span className="hidden md:inline">Advanced</span>
            </button>
            {Boolean(showAdvancedPopover) && (
              <>
                {/* Backdrop to close popup when clicking away */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAdvancedPopover(false)}
                  aria-hidden="true"
                />
                <div
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  // eslint-disable-next-line sonarjs/no-duplicate-string -- text-slate-200 used consistently for dark mode styling
                  className={`absolute right-0 top-full mt-2 rounded-xl shadow-xl border p-3 w-56 z-50 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  <div className="mb-2">
                    <h3 className={`text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Practice Options</h3>
                  </div>
                  {advancedOptions}
                </div>
              </>
            )}
          </div>
        )}
        {/* Underlay playfield primitives (slings, inlanes, outlanes, flippers). Coordinates are proportional to canvas size. */}
        <PlayfieldScenery darkMode={darkMode} />
        {/* Precise clickable flipper paths (no visible outline when selected) */
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {(() => {
              function flipperPath(base, tip, rBase, tipWidth, roundnessCtrl = 0.6) {
                const dx = tip.x - base.x, dy = tip.y - base.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len, uy = dy / len;
                const px = -uy, py = ux;
                const halfTip = tipWidth / 2;
                const tL = { x: tip.x + px * halfTip, y: tip.y + py * halfTip };
                const tR = { x: tip.x - px * halfTip, y: tip.y - py * halfTip };
                const bL = { x: base.x + px * rBase, y: base.y + py * rBase };
                const bR = { x: base.x - px * rBase, y: base.y - py * rBase };
                const ctrlTip = { x: tip.x + ux * (roundnessCtrl * halfTip), y: tip.y + uy * (roundnessCtrl * halfTip) };
                return [
                  `M ${bL.x} ${bL.y}`,
                  `A ${rBase} ${rBase} 0 1 1 ${bR.x} ${bR.y}`,
                  `L ${tR.x} ${tR.y}`,
                  `Q ${ctrlTip.x} ${ctrlTip.y} ${tL.x} ${tL.y}`,
                  'Z',
                ].join(' ');
              }
              const L_BASE = { x: 285, y: 785 }; const L_TIP = { x: 415, y: 920 };
              const R_BASE = { x: 715, y: 785 }; const R_TIP = { x: 585, y: 920 };
              const rBase = 27.5; const tipWidth = 22;
              const leftD = flipperPath(L_BASE, L_TIP, rBase, tipWidth);
              const rightD = flipperPath(R_BASE, R_TIP, rBase, tipWidth);
              return (
                <g className="cursor-pointer select-none">
                  <path
                    d={leftD}
                    fill="transparent"
                    onMouseDown={(e) => {
                      e.stopPropagation(); if (selectedId !== 'FLIPPER_L') {
                        setSelectedId('FLIPPER_L');
                      }
                    }}
                    title="Select Left flipper shot lines"
                  />
                  <path
                    d={rightD}
                    fill="transparent"
                    onMouseDown={(e) => {
                      e.stopPropagation(); if (selectedId !== 'FLIPPER_R') {
                        setSelectedId('FLIPPER_R');
                      }
                    }}
                    title="Select Right flipper shot lines"
                  />
                </g>
              );
            })()}
          </svg>
        }
        {rows.map(r => {
          const sel = r.id === selectedId;
          const misordered = misorderedIds?.has(r.id);
          const basePart = r.base || '';
          const imgSrc = basePart ? getImageSrc(basePart) : null;
          const imgVisible = Boolean(imgSrc && imageLoadedMap[r.id]);
          // Decide if we try to show image (only when base present)
          const showImageAttempt = Boolean(imgSrc);
          const baseSize = 80; // base tile size
          const renderedSize = baseSize * boxScale;
          // Scale font sizes proportionally with box size
          const baseFontSize = 11;
          const scaledFontSize = Math.max(9, Math.min(16, baseFontSize * boxScale));
          const typeFontSize = Math.max(8, Math.min(14, 10 * boxScale));
          return (
            <div
              key={r.id}
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, transform: 'translate(-50%, -50%)', width: renderedSize, height: renderedSize }}
              onMouseDown={(e) => handleMouseDown(e, r.id)}
              className={(() => {
                const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
                const base = `absolute z-30 select-none rounded-md shadow border overflow-visible ${bgClass}`;
                const selRing = sel ? 'ring-2 ring-blue-500' : '';
                let borderClass;
                if (misordered) {
                  borderClass = 'ring-2 ring-red-500 border-red-500';
                } else if (darkMode) {
                  borderClass = 'border-slate-700';
                } else {
                  borderClass = 'border-slate-300';
                }
                return `${base} ${selRing} ${borderClass}`;
              })()}
              role="button"
              tabIndex={0}
              aria-label={`Shot ${r.type || 'element'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMouseDown(e, r.id);
                }
              }}
            >
              {/* Background image layer */}
              {showImageAttempt ? (
                <img
                  src={imgSrc}
                  alt={r.type}
                  onLoad={() => setImageLoadedMap(m => (m[r.id] ? m : { ...m, [r.id]: true }))}
                  onError={() => setImageLoadedMap(m => {
                    if (!m[r.id]) {
                      return m;
                    } const copy = { ...m }; delete copy[r.id]; return copy;
                  })}
                  className={`${imgVisible ? 'opacity-100' : 'opacity-0'} absolute inset-0 w-full h-full object-cover transition-opacity duration-150 rounded-md`}
                  draggable={false}
                />
              ) : null}
              {/* Top overlay with type text when image present */}
              {imgVisible ? (
                <div
                  className="absolute top-0 left-0 right-0 bg-black/55 text-white font-semibold px-1 py-[2px] leading-tight text-center truncate"
                  style={{ fontSize: `${typeFontSize}px` }}
                  title={r.type}
                >
                  {r.type}
                </div>
              ) : null}
              {/* L/R values overlay moved to bottom */}
              {imgVisible ? (() => {
                const leftValue = formatInitValue(r.initL);
                const rightValue = formatInitValue(r.initR);
                return (
                  <div
                    className="absolute left-0 right-0 flex justify-between font-medium text-white drop-shadow pointer-events-none bg-black/35 backdrop-blur-[1px] px-1 py-[1px]"
                    style={{ bottom: '1px', fontSize: `${scaledFontSize}px` }}
                  >
                    <span>L {leftValue}</span>
                    <span>R {rightValue}</span>
                  </div>
                );
              })() : null}
              {/* Fallback original content if no image (or no type) */}
              {!imgVisible && (() => {
                const leftValue = formatInitValue(r.initL);
                const rightValue = formatInitValue(r.initR);
                return (
                  <div className="absolute inset-0 flex flex-col p-1" style={{ fontSize: `${scaledFontSize}px` }}>
                    <div
                      className="font-medium truncate text-center mt-4 flex-1 flex items-start justify-center"
                      style={{ maxWidth: `${renderedSize - 10}px` }}
                      title={r.type || 'Select type'}
                    >
                      {r.type || '— Type —'}
                    </div>
                    <div className="mt-auto flex justify-between">
                      <span className="px-1 rounded bg-slate-100">L {leftValue}</span>
                      <span className="px-1 rounded bg-slate-100">R {rightValue}</span>
                    </div>
                  </div>
                );
              })()}
              {/* X button moved to bottom center of shot box - filled red circle with gray X to match row remove icon style */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); setRows(prev => prev.filter(x => x.id !== r.id));
                }}
                className="absolute bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 p-0.5 rounded-md text-slate-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 cursor-pointer"
                style={{ zIndex: 60 }}
                title="Delete shot"
                aria-label="Delete shot"
              >
                {/* Circle filled red, outline and X use black per request */}
                <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  {/* Filled red circle with no outline */}
                  <circle cx="12" cy="12" r="9" fill="#dc2626" stroke="none" />
                  <path d="M9 9l6 6" stroke="#000" />
                  <path d="M15 9l-6 6" stroke="#000" />
                </svg>
              </button>
            </div>
          );
        })}
        {/* Lines visualization: either single-shot selection or flipper-wide selection */}
        {selectedId ? (() => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) {
            return null;
          }
          const w = rect.width; const h = rect.height;
          const L_TIP = { x: 415, y: 920 }, L_BASE = { x: 285, y: 785 };
          const R_TIP = { x: 585, y: 920 }, R_BASE = { x: 715, y: 785 };
          // Reuse geometry: compute top edge anchor for percentage along flipper length.
          function flipperTopEdge(base, tip, rBase, tipWidth, percent) {
            const t = Math.min(1, Math.max(0, (percent || 0) / 100));
            const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len; // along center line
            const px = -uy, py = ux; // perpendicular
            const cx = base.x + dx * t; const cy = base.y + dy * t; // center line point (1000-space)
            const wBase = rBase * 2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width / 2;
            const cand1 = { x: cx + px * half, y: cy + py * half };
            const cand2 = { x: cx - px * half, y: cy - py * half };
            // choose visually higher (smaller y)
            return cand1.y < cand2.y ? cand1 : cand2;
          }
          const rBaseConst = 27.5; const tipWidthConst = 22;
          const Lp = (p) => {
            const e = flipperTopEdge(L_BASE, L_TIP, rBaseConst, tipWidthConst, p); return { x: e.x / 1000 * w, y: e.y / 1000 * h };
          };
          const Rp = (p) => {
            const e = flipperTopEdge(R_BASE, R_TIP, rBaseConst, tipWidthConst, p); return { x: e.x / 1000 * w, y: e.y / 1000 * h };
          };
          if (selectedId === 'FLIPPER_L' || selectedId === 'FLIPPER_R' || selectedId === 'FLIPPER_BOTH') {
            const showLeft = selectedId === 'FLIPPER_L' || selectedId === 'FLIPPER_BOTH';
            const showRight = selectedId === 'FLIPPER_R' || selectedId === 'FLIPPER_BOTH';
            const BOX_HALF = 15;
            return (
              <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
                {showLeft ? rows.map(r => {
                  const val = r.initL;
                  if (val === null || val <= 0) {
                    return null;
                  }
                  const anchor = Lp(val);
                  const bx = r.x * w; const by = r.y * h + BOX_HALF;
                  const color = '#0ea5e9';
                  const incomplete = !r.type; // no shot type chosen
                  const opacity = incomplete ? 0.3 : 1;
                  const label = format2(val);
                  const fs = 11; const padX = 5, padY = 2; const wTxt = label.length * fs * 0.6; const rectW = wTxt + padX * 2; const rectH = fs + padY * 2; const cx = anchor.x; const cy = anchor.y; // position directly at flipper edge
                  return (
                    <g key={`L-${r.id}`}>
                      <line x1={anchor.x} y1={anchor.y} x2={bx} y2={by} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                      <rect x={cx - rectW / 2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill={darkMode ? '#334155' : '#ffffff'} stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                      <text x={cx} y={cy - rectH / 2 + fs / 2 - 2} fontSize={fs} textAnchor="middle" fill={darkMode ? '#e2e8f0' : '#000'} fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                    </g>
                  );
                }) : null}
                {showRight ? rows.map(r => {
                  const val = r.initR;
                  if (val === null || val <= 0) {
                    return null;
                  }
                  const anchor = Rp(val);
                  const bx = r.x * w; const by = r.y * h + BOX_HALF;
                  const color = '#dc2626';
                  const incomplete = !r.type; // no shot type chosen
                  const opacity = incomplete ? 0.3 : 1;
                  const label = format2(val);
                  const fs = 11; const padX = 5, padY = 2; const wTxt = label.length * fs * 0.6; const rectW = wTxt + padX * 2; const rectH = fs + padY * 2; const cx = anchor.x; const cy = anchor.y; // position directly at flipper edge
                  return (
                    <g key={`R-${r.id}`}>
                      <line x1={anchor.x} y1={anchor.y} x2={bx} y2={by} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                      <rect x={cx - rectW / 2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill={darkMode ? '#334155' : '#ffffff'} stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                      <text x={cx} y={cy - rectH / 2 + fs / 2 - 2} fontSize={fs} textAnchor="middle" fill={darkMode ? '#e2e8f0' : '#000'} fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                    </g>
                  );
                }) : null}
              </svg>
            );
          }
          // Otherwise a single shot is selected
          const r = rows.find(x => x.id === selectedId); if (!r) {
            return null;
          }
          const BOX_HALF = 15;
          const bx = r.x * w; const by = r.y * h + BOX_HALF; // bottom center of box
          const leftAnchor = Lp(r.initL ?? 50);
          const rightAnchor = Rp(r.initR ?? 50);
          return (
            <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
              {(r.initL ?? 0) > 0 && (() => {
                const label = `${format2(r.initL)}`; const fs = 11; const padX = 5, padY = 2; const wTxt = label.length * fs * 0.6; const rectW = wTxt + padX * 2; const rectH = fs + padY * 2; const cx = leftAnchor.x; const cy = leftAnchor.y; const incomplete = !r.type; const opacity = incomplete ? 0.3 : 1; // direct edge
                return (
                  <g>
                    <line x1={leftAnchor.x} y1={leftAnchor.y} x2={bx} y2={by} stroke="#0ea5e9" strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                    <rect x={cx - rectW / 2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill={darkMode ? '#334155' : '#ffffff'} stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                    <text x={cx} y={cy - rectH / 2 + fs / 2} fontSize={fs} textAnchor="middle" fill={darkMode ? '#e2e8f0' : '#000'} fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                  </g>
                );
              })()}
              {(r.initR ?? 0) > 0 && (() => {
                const label = `${format2(r.initR)}`; const fs = 11; const padX = 5, padY = 2; const wTxt = label.length * fs * 0.6; const rectW = wTxt + padX * 2; const rectH = fs + padY * 2; const cx = rightAnchor.x; const cy = rightAnchor.y; const incomplete = !r.type; const opacity = incomplete ? 0.3 : 1; // direct edge
                return (
                  <g>
                    <line x1={rightAnchor.x} y1={rightAnchor.y} x2={bx} y2={by} stroke="#dc2626" strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                    <rect x={cx - rectW / 2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill={darkMode ? '#334155' : '#ffffff'} stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                    <text x={cx} y={cy - rectH / 2 + fs / 2} fontSize={fs} textAnchor="middle" fill={darkMode ? '#e2e8f0' : '#000'} fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                  </g>
                );
              })()}
            </svg>
          );
        })() : null}
      </div>
      {/* Footer controls removed: editing now solely via table; additions via + Add shot button above. */}
    </div>
  );
};

PlayfieldEditor.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    type: PropTypes.string,
    initL: PropTypes.number,
    initR: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  })).isRequired,
  setRows: PropTypes.func.isRequired,
  selectedId: PropTypes.number,
  setSelectedId: PropTypes.func.isRequired,
  misorderedIds: PropTypes.instanceOf(Set),
  onClear: PropTypes.func,
  onExample: PropTypes.func,
  advancedOptions: PropTypes.node,
  darkMode: PropTypes.bool,
};

const PlayfieldScenery = ({ darkMode = false }) => {
  /* Simplified bottom: two basic elongated flippers only.
     Coordinate system: 1000x1000 viewBox.
     Desired physical proportions (approx): length ~3in, narrow base ~1cm, wide tip ~2.5cm.
     We'll treat: base width = 22 units, tip width = 55 units, length projected along 45deg ~ 300 units.
     Left flipper: narrow base near center bottom (x=500-40, y=970) offset left ~40; gap between bases ~ 80.
     Right flipper: mirror.
     Mapping for percentage anchors (used elsewhere):
       Left: 0% = wide tip (outer/rail side), 100% = narrow base near center.
       Right: 0% = wide tip (outer/rail side), 100% = narrow base near center.
  */
  // z-index note: keep scenery beneath interactive shot boxes (boxes use z-30 in editor)
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 1000">
        {/* Arc moved up ~10%: endpoints (0,550)->(1000,550); apex now at y=100 (still 450 sagitta, same radius ≈502.78). */}
        <path d="M 0 550 A 502.78 502.78 0 0 1 1000 550" fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" strokeDasharray="8 10" />
        {/**
          * Flippers: single capsule/tapered objects with rounded circular ends.
          * We approximate each flipper by a constant-width capsule along the base->tip vector.
          * Earlier logic (anchors in PlayfieldEditor) still uses BASE/TIP points below.
          */}
        {(() => {
          // Reversed flipper orientation per request:
          //   Circle (wide end) now at the HIGH / outer side ("base" argument) and
          //   the narrow tapered point aims DOWN toward the center drain ("tip").
          // Signature kept the same; rTip now represents the radius at BASE (circle),
          // baseWidth is the width of the NARROW tip (pivot) at the lower/inner end.
          // eslint-disable-next-line sonarjs/no-identical-functions
          function flipperPath(base, tip, rBase, tipWidth, roundnessCtrl = 0.6) {
            const dx = tip.x - base.x, dy = tip.y - base.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len; // unit along length (base -> tip)
            const px = -uy, py = ux; // perpendicular (left-hand)
            const halfTip = tipWidth / 2;

            // Narrow tip points
            const tL = { x: tip.x + px * halfTip, y: tip.y + py * halfTip };
            const tR = { x: tip.x - px * halfTip, y: tip.y - py * halfTip };
            // Circle perimeter extreme points along perpendicular axis
            const bL = { x: base.x + px * rBase, y: base.y + py * rBase };
            const bR = { x: base.x - px * rBase, y: base.y - py * rBase };
            // Control point for convex rounding at tip (extend slightly beyond tip in direction of ux,uy)
            const ctrlTip = { x: tip.x + ux * (roundnessCtrl * halfTip), y: tip.y + uy * (roundnessCtrl * halfTip) };

            // Single unified outline path:
            // Start at left circle tangent, sweep large arc around outer side to right tangent, down right edge to tip, rounded tip to left tip edge, back to start.
            // Using large-arc-flag=1 ensures >180° arc giving a smooth outer circular cap without an interior seam.
            return [
              `M ${bL.x} ${bL.y}`,
              `A ${rBase} ${rBase} 0 1 1 ${bR.x} ${bR.y}`,
              `L ${tR.x} ${tR.y}`,
              `Q ${ctrlTip.x} ${ctrlTip.y} ${tL.x} ${tL.y}`,
              'Z',
            ].join(' ');
          }
          const L_BASE = { x: 285, y: 785 }; const L_TIP = { x: 415, y: 920 };
          const R_BASE = { x: 715, y: 785 }; const R_TIP = { x: 585, y: 920 };
          const rBase = 27.5; // full circle radius now at outer/high base side
          const tipWidth = 22; // narrow tip (pivot) width toward center drain
          const leftD = flipperPath(L_BASE, L_TIP, rBase, tipWidth, 0.6);
          const rightD = flipperPath(R_BASE, R_TIP, rBase, tipWidth, 0.6);

          // Add "9" and "0" labels for each flipper
          // "9" at the tip (inner end toward center) and "0" at the base (outer end)
          const labels = [];
          const canvasBottom = 1000;
          const gapToBottom = canvasBottom - L_TIP.y; // Distance from tip to bottom edge
          const labelOffset = gapToBottom / 2.1;

          // Calculate the position for "0" labels at the outer end of each flipper
          // The base is a circle with center at L_BASE/R_BASE and radius rBase
          // For horizontal position: use the point furthest from tip (opposite direction)
          // For vertical position: add the same labelOffset as the "9" labels use
          const leftDx = L_TIP.x - L_BASE.x;
          const leftDy = L_TIP.y - L_BASE.y;
          const leftLen = Math.hypot(leftDx, leftDy);
          const leftUx = leftDx / leftLen; // unit x component along flipper

          const rightDx = R_TIP.x - R_BASE.x;
          const rightDy = R_TIP.y - R_BASE.y;
          const rightLen = Math.hypot(rightDx, rightDy);
          const rightUx = rightDx / rightLen; // unit x component along flipper

          // Horizontal position: point on circle perimeter opposite to flipper direction
          // Vertical position: the bottom of the circle at that x position + same offset as "9"
          const leftBaseOuterX = L_BASE.x - leftUx * rBase;
          const rightBaseOuterX = R_BASE.x - rightUx * rBase;

          // For vertical: the circle extends from center.y - rBase to center.y + rBase
          // The bottom of the circle (largest y) is at center.y + rBase
          const leftBaseBottom = {
            x: leftBaseOuterX,
            y: L_BASE.y + rBase,
          };
          const rightBaseBottom = {
            x: rightBaseOuterX,
            y: R_BASE.y + rBase,
          };

          // Position for "9" labels (at tip)
          const leftTipPos = { x: L_TIP.x, y: L_TIP.y + labelOffset };
          const rightTipPos = { x: R_TIP.x, y: R_TIP.y + labelOffset };

          // Position for "0" labels (at base outer edge)
          const leftBasePos = { x: leftBaseBottom.x, y: leftBaseBottom.y + labelOffset };
          const rightBasePos = { x: rightBaseBottom.x, y: rightBaseBottom.y + labelOffset };

          // Offset for diagonal shift: left flipper goes up-left, right flipper goes up-right
          const horizontalShift = 10; // pixels to move left/right
          const verticalShift = -10; // pixels to move up (negative y)

          // Gradient vertical adjustment: numbers closer to 0 get pushed up more than numbers closer to 9
          const verticalGradientMax = 20; // Maximum additional upward shift for "0" (tweakable)

          // Generate all numbers 0-9 evenly spaced along the line from "0" to "9" for each flipper
          for (let i = 0; i <= 9; i++) {
            const t = i / 9; // interpolation factor (0 for "0", 1 for "9")

            // Calculate gradient adjustment: linearly decreases from verticalGradientMax (at i=0) to 0 (at i=9)
            const gradientAdjustment = verticalGradientMax * (1 - i / 9);

            // Left flipper number - shifted up and to the left
            const leftBaseX = leftBasePos.x + (leftTipPos.x - leftBasePos.x) * t;
            const leftBaseY = leftBasePos.y + (leftTipPos.y - leftBasePos.y) * t;
            const leftX = leftBaseX - horizontalShift; // move left (negative x)
            const leftY = leftBaseY + verticalShift - gradientAdjustment; // move up with gradient adjustment
            labels.push(
              <text
                key={`L${i}`}
                x={leftX}
                y={leftY}
                fontSize="28"
                fill="#0ea5e9"
                fontFamily="ui-sans-serif"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="hanging"
                opacity="0.9"
              >
                {i}
              </text>,
            );

            // Right flipper number - shifted up and to the right
            const rightBaseX = rightBasePos.x + (rightTipPos.x - rightBasePos.x) * t;
            const rightBaseY = rightBasePos.y + (rightTipPos.y - rightBasePos.y) * t;
            const rightX = rightBaseX + horizontalShift; // move right (positive x)
            const rightY = rightBaseY + verticalShift - gradientAdjustment; // move up with gradient adjustment
            labels.push(
              <text
                key={`R${i}`}
                x={rightX}
                y={rightY}
                fontSize="28"
                fill="#dc2626"
                fontFamily="ui-sans-serif"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="hanging"
                opacity="0.9"
              >
                {i}
              </text>,
            );
          }

          return (
            <g fill={darkMode ? '#334155' : '#ffffff'} strokeLinecap="round" strokeLinejoin="round">
              <path d={leftD} stroke="#0ea5e9" strokeWidth={8} />
              <path d={rightD} stroke="#dc2626" strokeWidth={8} />
              {labels}
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

PlayfieldScenery.propTypes = {
  darkMode: PropTypes.bool,
};

const PracticePlayfield = ({ rows, selectedIdx, selectedSide, lastRecall, fullscreen = false, onScale, darkMode = false, animationEnabled = true }) => {
  const canvasRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  // Track canvas dimensions for responsive box sizing (both fullscreen and non-fullscreen)
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(384);
  // Track which images have loaded (reused across shot tiles) keyed by row.id
  const [imageLoadedMap, setImageLoadedMap] = useState({});

  // Ball animation state
  const [ballAnim, setBallAnim] = useState(null); // { progress: 0-1, startX, startY, endX, endY, duration, startTime, recallId }
  const [showFeedback, setShowFeedback] = useState(true); // Whether to show the feedback line/box
  const lastRecallIdRef = useRef(null); // Track which recall we've animated

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger ball animation when a new recall comes in
  useEffect(() => {
    if (!lastRecall || !animationEnabled) {
      setShowFeedback(true);
      return;
    }

    // Check if this is a new recall (different timestamp)
    const recallId = lastRecall.t;
    if (recallId === lastRecallIdRef.current) {
      return; // Already animated this one
    }
    lastRecallIdRef.current = recallId;

    // Get canvas dimensions
    const el = canvasRef.current;
    if (!el) {
      setShowFeedback(true);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      setShowFeedback(true);
      return;
    }
    const w = rect.width;
    const h = rect.height;

    // Calculate start position (flipper anchor at guess position)
    const L_BASE = { x: 285, y: 785 };
    const L_TIP = { x: 415, y: 920 };
    const R_BASE = { x: 715, y: 785 };
    const R_TIP = { x: 585, y: 920 };

    function flipperTopEdge(base, tip, rBase, tipWidth, percent) {
      const t = Math.min(1, Math.max(0, percent / 100));
      const dx = tip.x - base.x;
      const dy = tip.y - base.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const cx = base.x + dx * t;
      const cy = base.y + dy * t;
      const wBase = rBase * 2;
      const wTip = tipWidth;
      const width = wBase + (wTip - wBase) * t;
      const half = width / 2;
      const cand1 = { x: cx + px * half, y: cy + py * half };
      const cand2 = { x: cx - px * half, y: cy - py * half };
      return cand1.y < cand2.y ? cand1 : cand2;
    }

    const rawEdge = lastRecall.side === 'L'
      ? flipperTopEdge(L_BASE, L_TIP, 27.5, 22, lastRecall.input)
      : flipperTopEdge(R_BASE, R_TIP, 27.5, 22, lastRecall.input);

    const startX = (rawEdge.x / 1000) * w;
    const startY = (rawEdge.y / 1000) * h;

    // Calculate end position - must match the feedback line endpoint
    const targetRow = rows[lastRecall.idx];
    if (!targetRow) {
      setShowFeedback(true);
      return;
    }

    // Get shot box dimensions (same logic as feedback line calculation)
    const boxCX = targetRow.x * w;
    const boxCY = targetRow.y * h;
    let boxW = 120; // default
    let boxH = 120; // default (boxes are square)
    const shotEl = canvasRef.current?.querySelector(`[data-shot-box="${targetRow.id}"]`);
    if (shotEl) {
      try {
        const br = shotEl.getBoundingClientRect();
        if (br?.width) {
          boxW = br.width;
        }
        if (br?.height) {
          boxH = br.height;
        }
      } catch { /* swallow measurement errors */ }
    }

    // Calculate direction and offset (same logic as feedback line)
    let dirLate = 0;
    if (lastRecall.delta > 0) {
      dirLate = 1;
    } else if (lastRecall.delta < 0) {
      dirLate = -1;
    }
    let shiftSign = 0;
    if (dirLate !== 0) {
      if (lastRecall.side === 'R') {
        shiftSign = dirLate === -1 ? 1 : -1;
      } else {
        shiftSign = dirLate === -1 ? -1 : 1;
      }
    }
    // Proportional factor based on severity
    let factor = 0;
    if (lastRecall.severity === 'slight') {
      factor = 0.5;
    } else if (lastRecall.severity === 'fairly') {
      factor = 1;
    } else if (lastRecall.severity === 'very') {
      factor = 1.65;
    }
    const endX = boxCX + shiftSign * (factor * (boxW / 2));
    const endY = boxCY + boxH / 2;

    // Animation durations
    const travelDuration = 1000; // 1 second to travel
    // Shake/pause duration based on error - more error = longer shake
    // Perfect shots get a brief pause so ball doesn't immediately disappear
    const absError = Math.abs(lastRecall.delta);
    // Perfect shot (0 error) = 300ms pause; otherwise 200ms base + up to 400ms more based on error
    const shakeDuration = absError === 0 ? 300 : 200 + Math.min(400, absError * 8);

    // Hide feedback and start animation
    setShowFeedback(false);
    setBallAnim({
      progress: 0,
      startX,
      startY,
      endX,
      endY,
      travelDuration,
      shakeDuration,
      totalDuration: travelDuration + shakeDuration,
      startTime: performance.now(),
      recallId,
      absError,
    });
  }, [lastRecall, animationEnabled, rows]);

  // Animation frame loop
  useEffect(() => {
    if (!ballAnim) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }

    let frameId;
    const animate = (now) => {
      const elapsed = now - ballAnim.startTime;

      if (elapsed >= ballAnim.totalDuration) {
        // Animation complete
        setBallAnim(null);
        setShowFeedback(true);
      } else {
        // Calculate travel progress (0-1 during travel phase)
        const travelProgress = Math.min(1, elapsed / ballAnim.travelDuration);
        // Calculate shake progress (0-1 during shake phase, only after travel)
        let shakeProgress = 0;
        if (elapsed > ballAnim.travelDuration && ballAnim.shakeDuration > 0) {
          shakeProgress = (elapsed - ballAnim.travelDuration) / ballAnim.shakeDuration;
        }
        setBallAnim(prev => (prev ? { ...prev, travelProgress, shakeProgress } : null));
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [ballAnim]);

  // Skip animation on click or keypress
  useEffect(() => {
    if (!ballAnim) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }

    const skip = () => {
      setBallAnim(null);
      setShowFeedback(true);
    };

    const handleClick = () => skip();
    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        skip();
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [ballAnim]);

  // ResizeObserver to track canvas dimensions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    // Initial measurement
    const first = el.getBoundingClientRect();
    if (first.width) {
      setCanvasWidth(first.width);
    }
    if (first.height) {
      setCanvasHeight(first.height);
    }

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) {
          setCanvasWidth(cr.width);
        }
        if (cr.height > 0) {
          setCanvasHeight(cr.height);
        }
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const selectedRow = rows[selectedIdx] || null;
  const n = rows.length;

  // Calculate adaptive box size based on actual box positions and canvas dimensions
  // This ensures boxes never overlap or get clipped regardless of canvas size
  const MIN_BOX_SIZE = 50;
  const MAX_BOX_SIZE = 120;
  const MIN_GAP = 8;
  const MIN_EDGE_MARGIN = 10;
  const baseBoxWidth = 80;

  // Calculate the maximum box size that won't cause overlap or clipping
  // Based on actual positions of the rows and current canvas dimensions
  let maxAllowedBoxSize = MAX_BOX_SIZE;

  if (n > 0 && canvasWidth > 0 && canvasHeight > 0) {
    // Get sorted x positions for horizontal constraints
    const xPositions = rows.map(r => r.x).sort((a, b) => a - b);

    // Check horizontal edge constraints (leftmost and rightmost boxes)
    const leftmostX = xPositions[0];
    const rightmostX = xPositions.at(-1);

    // Max size based on left edge: box center is at leftmostX * canvasWidth
    // Half the box must fit between edge and center
    const maxFromLeftEdge = (leftmostX * canvasWidth - MIN_EDGE_MARGIN) * 2;

    // Max size based on right edge
    const maxFromRightEdge = ((1 - rightmostX) * canvasWidth - MIN_EDGE_MARGIN) * 2;

    maxAllowedBoxSize = Math.min(maxAllowedBoxSize, maxFromLeftEdge, maxFromRightEdge);

    // Check horizontal spacing between adjacent boxes
    if (n > 1) {
      for (let i = 1; i < xPositions.length; i++) {
        const gap = (xPositions[i] - xPositions[i - 1]) * canvasWidth;
        // Two half-boxes plus minimum gap must fit in this space
        // gap >= boxSize + MIN_GAP  =>  boxSize <= gap - MIN_GAP
        const maxFromGap = gap - MIN_GAP;
        maxAllowedBoxSize = Math.min(maxAllowedBoxSize, maxFromGap);
      }
    }

    // Check vertical edge constraints (top clipping prevention)
    // Find the topmost box (smallest y value)
    const topmostY = Math.min(...rows.map(r => r.y));
    // Max size based on top edge: box center is at topmostY * canvasHeight
    // Half the box must fit between edge and center
    const maxFromTopEdge = (topmostY * canvasHeight - MIN_EDGE_MARGIN) * 2;
    maxAllowedBoxSize = Math.min(maxAllowedBoxSize, maxFromTopEdge);
  }

  // Clamp to min/max constraints
  const adaptiveBoxSize = Math.max(MIN_BOX_SIZE, Math.min(MAX_BOX_SIZE, maxAllowedBoxSize));
  const scale = adaptiveBoxSize / baseBoxWidth;

  // Notify parent of scale so ancillary UI (chips) can track size.
  useEffect(() => {
    if (fullscreen && typeof onScale === 'function') {
      onScale(scale);
    }
  }, [scale, fullscreen, onScale]);
  return (
    <div className={fullscreen ? 'w-full h-full flex flex-col' : 'mt-8'}>
      {!fullscreen && <h3 className={`font-medium mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Playfield</h3>}
      <div
        ref={canvasRef}
        className={`relative border rounded-xl bg-gradient-to-b overflow-hidden ${darkMode ? 'from-slate-800 to-slate-900 border-slate-700' : 'from-slate-50 to-slate-100 border-slate-300'} ${fullscreen ? 'flex-1 min-h-0' : 'h-96'}`}
      >
        <PlayfieldScenery darkMode={darkMode} />
        {rows.map(r => {
          // Practice playfield: NO L/R values. Show image tile if available, else fallback text box.
          const styleBase = {
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          };
          const basePart = r.base || '';
          const imgSrc = basePart ? getImageSrc(basePart) : null;
          // Image visibility tracked in parent map (imageLoadedMap) to avoid per-iteration hook misuse.
          const imgVisible = Boolean(imgSrc && imageLoadedMap[r.id]);
          const showImageAttempt = Boolean(imgSrc);
          // Box size with adaptive scaling applied
          const boxSize = Math.max(32, baseBoxWidth * scale);
          // Font sizes scale with box
          const typeFontSize = Math.max(7, 10 * scale);
          const fallbackFontSize = Math.max(8, 11 * scale);
          if (showImageAttempt) {
            return (
              <div
                key={r.id}
                data-shot-box={r.id}
                style={{ ...styleBase, width: boxSize, height: boxSize }}
                className={`absolute z-20 select-none rounded-md shadow border overflow-hidden origin-center ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'} ${r === selectedRow ? 'ring-2 ring-blue-500' : ''}`}
                title={r.type}
              >
                <img
                  src={imgSrc}
                  alt={r.type}
                  onLoad={() => setImageLoadedMap(m => (m[r.id] ? m : { ...m, [r.id]: true }))}
                  onError={() => setImageLoadedMap(m => {
                    if (!m[r.id]) {
                      return m;
                    } const copy = { ...m }; delete copy[r.id]; return copy;
                  })}
                  className={`${imgVisible ? 'opacity-100' : 'opacity-0'} absolute inset-0 w-full h-full object-cover transition-opacity duration-150`}
                  draggable={false}
                />
                {imgVisible ? (
                  <div
                    className="absolute top-0 left-0 right-0 bg-black/55 text-white font-semibold px-1 py-[2px] leading-tight text-center truncate"
                    style={{ fontSize: typeFontSize }}
                    title={r.type}
                  >
                    {r.type || '—'}
                  </div>
                ) : null}
                {!imgVisible && (
                  <div
                    className="absolute inset-0 flex items-center justify-center font-medium px-1 text-center"
                    style={{ fontSize: fallbackFontSize }}
                    title={r.type || '—'}
                  >
                    {r.type || '—'}
                  </div>
                )}
              </div>
            );
          }
          // Fallback text box (no image) - also uses adaptive sizing
          return (
            <div
              key={r.id}
              data-shot-box={r.id}
              style={{ ...styleBase, width: boxSize, height: boxSize }}
              className={`absolute z-20 select-none rounded-lg shadow border origin-center overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'} ${r === selectedRow ? 'ring-2 ring-blue-500' : ''}`}
              title={r.type}
            >
              <div
                className="absolute inset-0 flex items-center justify-center px-1 text-center font-medium"
                style={{ fontSize: fallbackFontSize }}
                title={r.type || '—'}
              >
                {r.type || '—'}
              </div>
            </div>
          );
        })}
        {/* eslint-disable-next-line sonarjs/cognitive-complexity */}
        {mounted && selectedRow && selectedSide ? (() => {
          // Draw two guide lines from the shot box to the extremes (0 and 100) of the selected flipper.
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) {
            return null;
          }
          const w = rect.width; const h = rect.height;
          const BOX_HALF = 15 * scale; // approximate half-height scaled
          const _bx = selectedRow.x * w; const _by = selectedRow.y * h + BOX_HALF; // bottom center of shot box
          // Coordinate anchors (note mapping: 0=base,100=tip in editor, but we now need both extremes).
          const L_TIP = { x: 415, y: 920 }, L_BASE = { x: 285, y: 785 };
          const R_TIP = { x: 585, y: 920 }, R_BASE = { x: 715, y: 785 };
          const Lp = (p) => ({
            x: (L_BASE.x + (L_TIP.x - L_BASE.x) * (p / 100)) / 1000 * w,
            y: (L_BASE.y + (L_TIP.y - L_BASE.y) * (p / 100)) / 1000 * h,
          });
          const Rp = (p) => ({
            x: (R_BASE.x + (R_TIP.x - R_BASE.x) * (p / 100)) / 1000 * w,
            y: (R_BASE.y + (R_TIP.y - R_BASE.y) * (p / 100)) / 1000 * h,
          });
          // Unified green guide color for both flippers during practice
          const stroke = '#10b981'; // emerald-500
          // Determine anchor for showing last recall value (only one value shown at a time on the active flipper).
          let recallNode = null;
          if (lastRecall && Number.isFinite(lastRecall.input)) {
            // Placeholder for feedback line/group before recall value label box; restored after refactor
            let lineEl = null;
            const prevRow = rows[lastRecall.idx];
            if (prevRow) {
              // Precise flipper edge anchor at recall %
              function flipperTopEdge(base, tip, rBase, tipWidth, percent) {
                const t = Math.min(1, Math.max(0, percent / 100));
                const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len, uy = dy / len;
                const px = -uy, py = ux;
                const cxLine = base.x + dx * t; const cyLine = base.y + dy * t;
                const wBase = rBase * 2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width / 2;
                const cand1 = { x: cxLine + px * half, y: cyLine + py * half };
                const cand2 = { x: cxLine - px * half, y: cyLine - py * half };
                return cand1.y < cand2.y ? cand1 : cand2;
              }
              const rawEdge = lastRecall.side === 'L'
                ? flipperTopEdge({ x: 285, y: 785 }, { x: 415, y: 920 }, 27.5, 22, lastRecall.input)
                : flipperTopEdge({ x: 715, y: 785 }, { x: 585, y: 920 }, 27.5, 22, lastRecall.input);
              const anchor = { x: rawEdge.x / 1000 * w, y: rawEdge.y / 1000 * h };
              const label = `${format2(lastRecall.input)}`;
              const textScale = Number(scale);
              // Recall value label sizing (50% larger)
              const baseFs = 11 * 1.5; const rPadXBase = 5; const rPadYBase = 2;
              const fs = baseFs * textScale; const rPadX = rPadXBase * textScale; const rPadY = rPadYBase * textScale;
              const wTxt = label.length * fs * 0.6; const rectW = wTxt + rPadX * 2; const rectH = fs + rPadY * 2;
              const cx = anchor.x; const cy = anchor.y - 8;
              // Shot box center (percent coords already represent center due to translate(-50%, -50%))
              const boxCX = prevRow.x * w; const boxCY = prevRow.y * h;
              // Measure actual shot box width (after scaling) for proportional offsets
              let boxW = 120;
              const shotEl = canvasRef.current?.querySelector(`[data-shot-box="${prevRow.id}"]`);
              if (shotEl) {
                try {
                  const br = shotEl.getBoundingClientRect(); if (br?.width) {
                    boxW = br.width;
                  }
                } catch { /* swallow measurement errors (layout shifts) intentionally */ }
              }
              const boxH = 30; // heuristic height only for vertical anchor reference
              // Direction: Right flipper early-> +x, late-> -x; Left flipper mirrored
              let dirLate = 0;
              if (lastRecall.delta > 0) {
                dirLate = 1;
              } else if (lastRecall.delta < 0) {
                dirLate = -1;
              }
              let shiftSign = 0;
              if (dirLate !== 0) {
                if (lastRecall.side === 'R') {
                  shiftSign = dirLate === -1 ? 1 : -1;
                } else {
                  shiftSign = dirLate === -1 ? -1 : 1;
                }
              }
              // Proportional factor (of half shot box width): perfect 0, slight 0.50, fairly 1.00, very 1.65
              let factor = 0;
              if (lastRecall.severity === 'slight') {
                factor = 0.5;
              } else if (lastRecall.severity === 'fairly') {
                factor = 1;
              } else if (lastRecall.severity === 'very') {
                factor = 1.65;
              }
              const endX = boxCX + shiftSign * (factor * (boxW / 2));
              const endY = boxCY + boxH / 2;
              // Feedback text content
              let word1, word2 = null;
              if (lastRecall.severity === 'perfect') {
                word1 = 'Perfect';
              } else {
                const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
                word1 = cap(lastRecall.severity);
                word2 = cap(lastRecall.label);
              }
              // Feedback box sizing
              const tScale = Number(scale); const fontSize = 10 * 1.5 * tScale; const lineGap = 2 * tScale;
              const fbPadX = 6 * tScale; const fbPadY = 4 * tScale;
              const longest = word2 ? Math.max(word1.length, word2.length) : word1.length;
              const approxCharW = fontSize * 0.6;
              const textW = longest * approxCharW;
              const lineCount = word2 ? 2 : 1;
              const lineHeight = fontSize;
              const contentHeight = lineCount === 1 ? lineHeight : (lineHeight * 2 + lineGap);
              const boxHeight = contentHeight + fbPadY * 2;
              const boxWidth = textW + fbPadX * 2;
              const boxCenterX = endX; // center box at computed endX
              const boxX = boxCenterX - boxWidth / 2;
              const downwardOffset = 0.8 * boxHeight;
              const boxY = endY + downwardOffset - boxHeight;
              // Update: pill fill now matches severity color; border same color; text remains black for contrast
              lineEl = (
                <g>
                  <line x1={anchor.x} y1={anchor.y} x2={endX} y2={endY} stroke={SEVERITY_COLORS[lastRecall.severity] || '#eab308'} strokeWidth={8 * tScale} strokeLinecap="round" />
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={6 * tScale}
                    ry={6 * tScale}
                    fill={SEVERITY_COLORS[lastRecall.severity] || '#eab308'}
                    stroke={SEVERITY_COLORS[lastRecall.severity] || '#eab308'}
                    strokeWidth={Number(tScale)}
                  />
                  <text
                    x={boxCenterX}
                    y={boxY + fbPadY + fontSize * 0.78}
                    fontSize={fontSize}
                    fontFamily="ui-sans-serif"
                    fontWeight={600}
                    textAnchor="middle"
                    fill="#000"
                  >
                    <tspan x={boxCenterX}>{word1}</tspan>
                    {word2 ? <tspan x={boxCenterX} dy={lineGap + lineHeight}>{word2}</tspan> : null}
                  </text>
                </g>
              );
              // Arrow vertical offset constants (adjustable)
              const ARROW_INWARD_Y_OFFSET = 10; // Negative moves up (for arrows pointing toward center)
              const ARROW_OUTWARD_Y_OFFSET = -15; // Negative moves up (for arrows pointing toward edges)
              const ARROW_INWARD_X_OFFSET = 0.75; // Fraction to move inward arrow closer to number box

              // Get arrow color based on severity (same as feedback box)
              const arrowColor = SEVERITY_COLORS[lastRecall.severity] || '#eab308';

              // Determine arrow direction based on delta (only if not perfect)
              let arrowSymbol = null;
              let arrowOffset = 0;
              let arrowRotation = 0;
              let arrowYOffset = 0;
              if (lastRecall.delta !== 0) {
                // For left flipper: negative delta means guess too low (arrow right/up toward higher numbers)
                // For right flipper: negative delta means guess too low (arrow left/down toward higher numbers)
                // Arrow points in the direction where the correct answer is
                // Left flipper angle: approximately -45 degrees (base lower-left to tip upper-right)
                // Right flipper angle: approximately 45 degrees (base lower-right to tip upper-left)
                if (lastRecall.side === 'L') {
                  if (lastRecall.delta < 0) {
                    arrowSymbol = '→';
                    arrowOffset = (rectW / 2 + fs * 0.6) * ARROW_INWARD_X_OFFSET; // Right side
                    arrowRotation = 35; // 35 degrees clockwise
                    arrowYOffset = ARROW_INWARD_Y_OFFSET; // Inward arrow moves up
                  } else {
                    arrowSymbol = '←';
                    arrowOffset = -(rectW / 2 + fs * 0.6); // Left side, closer to box
                    arrowRotation = 35; // 35 degrees counter-clockwise
                    arrowYOffset = ARROW_OUTWARD_Y_OFFSET; // Outward arrow moves up
                  }
                } else if (lastRecall.delta < 0) {
                  arrowSymbol = '←';
                  arrowOffset = -(rectW / 2 + fs * 0.6) * ARROW_INWARD_X_OFFSET; // Left side, closer to box
                  arrowRotation = -35; // -35 degrees counter-clockwise
                  arrowYOffset = ARROW_INWARD_Y_OFFSET; // Inward arrow moves up
                } else {
                  arrowSymbol = '→';
                  arrowOffset = rectW / 2 + fs * 0.6; // Right side
                  arrowRotation = -35; // -35 degrees clockwise
                  arrowYOffset = ARROW_OUTWARD_Y_OFFSET; // Outward arrow moves up
                }
              }
              recallNode = (
                <g>
                  {lineEl}
                  <rect x={cx - rectW / 2} y={cy - rectH} width={rectW} height={rectH} rx={6 * Number(textScale)} ry={6 * Number(textScale)} fill={darkMode ? '#334155' : '#ffffff'} stroke="#cbd5e1" strokeWidth={Number(textScale)} />
                  {/* Display 'NP' (Not Possible) instead of '00' when the recalled value is 0 */}
                  <text x={cx} y={cy - rectH / 2 + fs / 2 - 2} fontSize={fs} textAnchor="middle" fill={darkMode ? '#e2e8f0' : '#000'} fontFamily="ui-sans-serif" fontWeight="400">{label === '00' ? 'NP' : label}</text>
                  {/* Arrow indicator showing direction of correct answer, rotated along flipper axis */}
                  {arrowSymbol ? (
                    <text
                      x={cx + arrowOffset}
                      y={cy - rectH / 2 + fs / 2 - Number(textScale) + arrowYOffset}
                      fontSize={fs}
                      textAnchor="middle"
                      fill={arrowColor}
                      fontFamily="ui-sans-serif"
                      fontWeight="700"
                      stroke={arrowColor}
                      strokeWidth={fs * 0.15}
                      paintOrder="stroke"
                      transform={`rotate(${arrowRotation}, ${cx + arrowOffset}, ${cy - rectH / 2 + fs / 2 - Number(textScale) + arrowYOffset})`}
                    >{arrowSymbol}</text>
                  ) : null}
                </g>
              );
            }
          }
          // Split rendering: green guide lines behind (z-0) already fine; yellow feedback & recall node should be ABOVE flippers/boxes.
          // We'll draw green lines first (existing layer), then overlay a second SVG (z-30) for yellow feedback + recall node.
          // Recompute p0/p100 using top-edge anchor logic so green lines terminate on visible flipper edge (not center line)
          function topEdgePoint(side, percent) {
            // Replicate flipperTopEdge from earlier (editor & yellow feedback) for consistency
            // eslint-disable-next-line unicorn/consistent-function-scoping
            function flipperTopEdge(base, tip, rBase, tipWidth, pct) {
              const t = Math.min(1, Math.max(0, pct / 100));
              const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len;
              const px = -uy, py = ux; // perpendicular
              const cx = base.x + dx * t; const cy = base.y + dy * t;
              const wBase = rBase * 2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width / 2;
              const cand1 = { x: cx + px * half, y: cy + py * half };
              const cand2 = { x: cx - px * half, y: cy - py * half };
              return cand1.y < cand2.y ? cand1 : cand2; // choose visually higher
            }
            const rBaseConst = 27.5; const tipWidthConst = 22;
            if (side === 'L') {
              const edge = flipperTopEdge({ x: 285, y: 785 }, { x: 415, y: 920 }, rBaseConst, tipWidthConst, percent);
              return { x: edge.x / 1000 * w, y: edge.y / 1000 * h };
            } else {
              const edge = flipperTopEdge({ x: 715, y: 785 }, { x: 585, y: 920 }, rBaseConst, tipWidthConst, percent);
              return { x: edge.x / 1000 * w, y: edge.y / 1000 * h };
            }
          }
          const p0Top = topEdgePoint(selectedSide, 0);
          const p100Top = topEdgePoint(selectedSide, 100);
          // Measure actual shot box dimensions to calculate accurate bottom corners
          let boxWidth = 96; // default w-24 (fallback text box)
          let boxHeight = 80; // default h-20
          const shotEl = canvasRef.current?.querySelector(`[data-shot-box="${selectedRow.id}"]`);
          if (shotEl) {
            try {
              const br = shotEl.getBoundingClientRect();
              if (br?.width && br?.height) {
                boxWidth = br.width;
                boxHeight = br.height;
              }
            } catch { /* swallow measurement errors */ }
          }
          // Calculate bottom corners of shot box
          // Shot box is centered at (selectedRow.x * w, selectedRow.y * h)
          const boxCenterX = selectedRow.x * w;
          const boxCenterY = selectedRow.y * h;
          const boxLeft = boxCenterX - boxWidth / 2;
          const boxRight = boxCenterX + boxWidth / 2;
          const boxBottom = boxCenterY + boxHeight / 2;
          // For proper polygon winding: Left flipper goes 0(left)->100(right), Right flipper goes 0(right)->100(left)
          // So left flipper connects: p0->p100->boxRight->boxLeft, right flipper connects: p0->p100->boxLeft->boxRight
          const polygonPoints = selectedSide === 'L'
            ? `${p0Top.x},${p0Top.y} ${p100Top.x},${p100Top.y} ${boxRight},${boxBottom} ${boxLeft},${boxBottom}`
            : `${p0Top.x},${p0Top.y} ${p100Top.x},${p100Top.y} ${boxLeft},${boxBottom} ${boxRight},${boxBottom}`;
          const line1End = selectedSide === 'L' ? boxLeft : boxRight;
          const line2End = selectedSide === 'L' ? boxRight : boxLeft;
          const greenLayer = (
            <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
              {/* Shaded wedge between anchors and shot box - now a quadrilateral connecting to bottom corners */}
              <polygon
                points={polygonPoints}
                fill={stroke}
                fillOpacity={0.18}
              />
              <line x1={p0Top.x} y1={p0Top.y} x2={line1End} y2={boxBottom} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
              <line x1={p100Top.x} y1={p100Top.y} x2={line2End} y2={boxBottom} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
            </svg>
          );
          const yellowLayer = showFeedback && recallNode && (
            <svg className="absolute inset-0 pointer-events-none z-30" viewBox={`0 0 ${w} ${h}`}>
              {recallNode}
            </svg>
          );
          // Ball animation layer
          let ballLayer = null;
          if (ballAnim) {
            const { travelProgress = 0, shakeProgress = 0, startX, startY, endX, endY, absError = 0 } = ballAnim;

            // Base position: linear interpolation along the straight line (capped at 1)
            const travelT = Math.min(1, travelProgress);
            let ballX = startX + (endX - startX) * travelT;
            let ballY = startY + (endY - startY) * travelT;

            // Add shake effect when travel is complete
            if (travelT >= 1 && shakeProgress > 0 && shakeProgress < 1 && absError > 0) {
              // Shake intensity based on error magnitude (0-50 range mapped to 0-15 pixels)
              const shakeIntensity = Math.min(15, absError * 0.3) * scale;
              // Shake frequency - faster shake
              const shakeFreq = 25;
              // Damping - shake reduces over time
              const damping = 1 - shakeProgress;
              // Random-ish shake using sin/cos at different frequencies
              const shakeOffsetX = Math.sin(shakeProgress * Math.PI * shakeFreq) * shakeIntensity * damping;
              const shakeOffsetY = Math.cos(shakeProgress * Math.PI * shakeFreq * 1.3) * shakeIntensity * 0.7 * damping;
              ballX += shakeOffsetX;
              ballY += shakeOffsetY;
            }

            // Ball size is 1/8 the flipper length
            // Flipper coordinates: base (285,785) to tip (415,920) in 1000-unit space
            // X delta: 130 units, Y delta: 135 units
            // Convert to actual pixels using canvas dimensions
            const flipperDeltaX = (130 / 1000) * w; // x component in pixels
            const flipperDeltaY = (135 / 1000) * h; // y component in pixels
            const flipperLengthPx = Math.hypot(flipperDeltaX, flipperDeltaY);
            const ballRadius = flipperLengthPx / 8;

            ballLayer = (
              <svg className="absolute inset-0 pointer-events-none z-40" viewBox={`0 0 ${w} ${h}`}>
                <defs>
                  {/* Metallic silver ball gradient */}
                  <radialGradient id="ballGradient" cx="30%" cy="30%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="40%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#64748b" />
                  </radialGradient>
                </defs>
                {/* Ball shadow */}
                <ellipse
                  cx={ballX + 2}
                  cy={ballY + ballRadius * 0.3}
                  rx={ballRadius * 0.8}
                  ry={ballRadius * 0.3}
                  fill="rgba(0,0,0,0.3)"
                />
                {/* Main ball */}
                <circle
                  cx={ballX}
                  cy={ballY}
                  r={ballRadius}
                  fill="url(#ballGradient)"
                  stroke="#475569"
                  strokeWidth={1}
                />
                {/* Highlight */}
                <circle
                  cx={ballX - ballRadius * 0.3}
                  cy={ballY - ballRadius * 0.3}
                  r={ballRadius * 0.25}
                  fill="rgba(255,255,255,0.7)"
                />
              </svg>
            );
          }
          return <>{greenLayer}{yellowLayer}{ballLayer}</>;
        })() : null}
      </div>
    </div>
  );
};

PracticePlayfield.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    type: PropTypes.string,
    initL: PropTypes.number,
    initR: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  })).isRequired,
  selectedIdx: PropTypes.number.isRequired,
  selectedSide: PropTypes.oneOf(['L', 'R']),
  lastRecall: PropTypes.shape({
    idx: PropTypes.number,
    side: PropTypes.string,
    input: PropTypes.string,
    delta: PropTypes.number,
    severity: PropTypes.string,
    label: PropTypes.string,
    t: PropTypes.number, // timestamp for animation tracking
  }),
  fullscreen: PropTypes.bool,
  onScale: PropTypes.func,
  darkMode: PropTypes.bool,
  animationEnabled: PropTypes.bool,
};

// ---------- main component ----------
// eslint-disable-next-line sonarjs/cognitive-complexity, complexity, max-lines-per-function
const App = () => {
  const [toasts, setToasts] = useState([]); // {id,msg}
  const toastTimersRef = useRef(new Set());
  const _pushToast = useCallback((msg) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    setToasts(t => [...t, { id, msg }]);
    const timerId = setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
      toastTimersRef.current.delete(timerId);
    }, 3200);
    toastTimersRef.current.add(timerId);
  }, []);

  // Cleanup all toast timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const timerId of timers) {
        clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  // Setup state
  // Start with no shots by default; user must explicitly add via + Add shot.
  const [rowsRaw, setRowsRaw] = useLocalStorage('pinball_rows_v1', []);
  const rows = rowsRaw; // direct
  const setRows = useCallback((updater) => {
    setRowsRaw(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, [setRowsRaw]);
  // Popup menus for new shot/location selector
  const [openShotMenuId, setOpenShotMenuId] = useState(null); // row id currently showing shot list
  const [openLocMenuId, setOpenLocMenuId] = useState(null); // row id currently showing location list
  const [shotMenuAnchor, setShotMenuAnchor] = useState(null); // {id,x,y}
  const [locMenuAnchor, setLocMenuAnchor] = useState(null); // {id,x,y}
  // Anchor for multi-add popup when list is empty
  const [addCountAnchor, setAddCountAnchor] = useState(null); // {x,y} or null
  // Available presets loaded from /presets/index.json - array of {name, filename} objects
  const [availablePresets, setAvailablePresets] = useState([]);
  // Compact preset popup state
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState(null);
  // Load available presets on mount
  useEffect(() => {
    // Check if we have embedded presets (standalone mode)
    if (typeof window !== 'undefined' && window.EMBEDDED_PRESET_INDEX) {
      // Use the embedded preset index
      setAvailablePresets(window.EMBEDDED_PRESET_INDEX);
    } else if (typeof window !== 'undefined' && window.EMBEDDED_PRESETS) {
      // Fallback: generate index from embedded preset filenames
      const presetList = Object.keys(window.EMBEDDED_PRESETS).map(filename => {
        // Generate display name from filename
        const name = filename
          .replace('.json', '')
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return { name, filename };
      });
      setAvailablePresets(presetList);
    } else {
      // Fetch the index.json file which lists all available presets
      (async () => {
        try {
          const response = await fetch('./presets/index.json');
          const presets = await response.json();
          setAvailablePresets(presets);
        } catch {
          setAvailablePresets([]);
        }
      })();
    }
  }, []);
  // Keep popup anchored to triggering chip while scrolling/resizing
  useEffect(() => {
    if (openShotMenuId === null && openLocMenuId === null && !addCountAnchor) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    let raf = null;
    const update = () => {
      if (raf) {
        return;
      }
      raf = requestAnimationFrame(() => {
        raf = null;
        if (openShotMenuId !== null) {
          const el = document.querySelector(`[data-shot-chip="${openShotMenuId}"]`);
          if (el) {
            const r = el.getBoundingClientRect();
            setShotMenuAnchor(a => a && a.id === openShotMenuId ? { ...a, x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 } : a);
          }
        }
        if (openLocMenuId !== null) {
          const el = document.querySelector(`[data-loc-chip="${openLocMenuId}"]`);
          if (el) {
            const r = el.getBoundingClientRect();
            setLocMenuAnchor(a => a && a.id === openLocMenuId ? { ...a, x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 } : a);
          }
        }
        if (addCountAnchor) {
          const el = document.querySelector('[data-add-multi]');
          if (el) {
            const r = el.getBoundingClientRect();
            setAddCountAnchor({ x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 });
          }
        }
      });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [openShotMenuId, openLocMenuId, addCountAnchor]);
  // Close menus on outside click
  useEffect(() => {
    const handler = () => {
      // Outside click closes all popups
      setOpenShotMenuId(null); setOpenLocMenuId(null); setShotMenuAnchor(null); setLocMenuAnchor(null); setAddCountAnchor(null);
      setPresetOpen(false);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);
  // Close menus on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && // Check if any menu is open before preventing default (to allow other Escape handlers like fullscreen)
        (openShotMenuId !== null || openLocMenuId !== null || addCountAnchor !== null || presetOpen)) {
        e.preventDefault();
        setOpenShotMenuId(null);
        setOpenLocMenuId(null);
        setShotMenuAnchor(null);
        setLocMenuAnchor(null);
        setAddCountAnchor(null);
        setPresetOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openShotMenuId, openLocMenuId, addCountAnchor, presetOpen]);
  const [driftEvery, setDriftEvery] = useLocalStorage('pinball_driftEvery_v1', 4);
  const [driftMag, setDriftMag] = useLocalStorage('pinball_driftMag_v1', 2); // magnitude in 5% steps
  // Initial correct values randomization steps (each step = 5 percentage points). Previously fixed at 4 (±20).
  const [initRandSteps, setInitRandSteps] = useLocalStorage('pinball_initRandSteps_v1', 2);

  const [initialized, setInitialized] = useLocalStorage('pinball_initialized_v1', false);
  // Hidden & mental per side
  const [hiddenL, setHiddenL] = useLocalStorage('pinball_hiddenL_v1', []);
  const [hiddenR, setHiddenR] = useLocalStorage('pinball_hiddenR_v1', []);
  // Starting (anchor) values captured at session start to constrain correct values drift (±20 max, i.e. 4*5 steps)
  const [baseL, setBaseL] = useLocalStorage('pinball_baseL_v1', []);
  const [baseR, setBaseR] = useLocalStorage('pinball_baseR_v1', []);
  const [mentalL, setMentalL] = useLocalStorage('pinball_mentalL_v1', []);
  const [mentalR, setMentalR] = useLocalStorage('pinball_mentalR_v1', []);
  const [orderAscL, setOrderAscL] = useLocalStorage('pinball_initialOrderL_v1', []);
  const [orderAscR, setOrderAscR] = useLocalStorage('pinball_initialOrderR_v1', []);

  const [mode, setMode] = useLocalStorage('pinball_mode_v1', 'random'); // 'manual' | 'random'
  const [useSeededRandom, setUseSeededRandom] = useLocalStorage('pinball_useSeededRandom_v1', false);
  const [selectedIdx, setSelectedIdx] = useLocalStorage('pinball_sel_v1', 0);
  const [guess, setGuess] = useLocalStorage('pinball_guess_v1', '');
  const [selectedSide, setSelectedSide] = useLocalStorage('pinball_selSide_v1', 'L');
  const [attempts, setAttempts] = useLocalStorage('pinball_attempts_v1', []);
  const [attemptCount, setAttemptCount] = useLocalStorage('pinball_attemptCount_v1', 0);
  const [showTruth, setShowTruth] = useLocalStorage('pinball_showTruth_v1', false);
  const [finalPhase, setFinalPhase] = useLocalStorage('pinball_finalPhase_v1', false);
  const [finalRecallL, setFinalRecallL] = useLocalStorage('pinball_finalRecallL_v1', []);
  const [finalRecallR, setFinalRecallR] = useLocalStorage('pinball_finalRecallR_v1', []);
  const [showMentalModel, setShowMentalModel] = useLocalStorage('pinball_showMentalModel_v1', false); // visibility toggle for guess values
  const [showBaseValues, setShowBaseValues] = useLocalStorage('pinball_showBaseValues_v1', true); // visibility toggle for starting/original values
  const [showAttemptHistory, setShowAttemptHistory] = useLocalStorage('pinball_showAttemptHistory_v1', false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useLocalStorage('pinball_showFeedback_v1', false); // new toggle for Feedback table
  // Restore stacks removed (Not Possible is neutral now)
  // UI local (non-persisted) state: collapsed shot type rows (store ids)
  const [collapsedTypes, setCollapsedTypes] = useState([]); // Only shot type collapsing retained; flipper collapsing removed.
  // Playfield editor is always visible now; toggle removed
  // const [showPlayfield, setShowPlayfield] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  // Temporary hover state for flipper column headers ("L" or "R") to preview column highlight
  const [hoverFlipperColumn, setHoverFlipperColumn] = useState(null);
  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  // Dark mode toggle (default: true for dark mode)
  const [darkMode, setDarkMode] = useLocalStorage('pinball_darkMode_v1', true);
  // One-time auto-collapse so pre-selected values (from persisted state or defaults) show as single chips, not full option lists on first load.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (didInitCollapse.current) {
      return;
    }
    if (!rows || rows.length === 0) {
      return;
    } // nothing yet
    // Only initialize if user hasn't interacted (arrays still empty)
    if (collapsedTypes.length > 0) {
      didInitCollapse.current = true; return;
    }
    const typeIds = rows.filter(r => Boolean(r.type)).map(r => r.id);
    // Flipper collapse removed (left/right arrays no longer tracked)
    if (typeIds.length > 0) {
      setCollapsedTypes(typeIds);
    }
    // (No flipper collapse initialization)
    didInitCollapse.current = true;
  }, [rows, collapsedTypes.length]);

  // Keep selectedIdx within bounds if rows shrink
  useEffect(() => {
    setSelectedIdx((idx) => {
      if (idx === -1) {
        return -1;
      } // preserve explicit no-selection state
      if (rows.length === 0) {
        return -1;
      } // nothing to select
      return idx >= rows.length ? Math.max(0, rows.length - 1) : idx;
    });
    setSelectedSide(s => (s === 'L' || s === 'R') ? s : 'L');
    // No restore stacks to invalidate.
  }, [rows.length, setSelectedIdx, setSelectedSide]);

  // Update seeded random generator when checkbox changes
  useEffect(() => {
    setSeed(useSeededRandom);
  }, [useSeededRandom]);

  // Derived
  const totalPoints = useMemo(
    () => attempts.reduce((sum, a) => sum + a.points, 0),
    [attempts],
  );

  const avgAbsErr = useMemo(() => {
    if (attempts.length === 0) {
      return 0;
    }
    return attempts.reduce((s, a) => s + Math.abs(a.delta), 0) / attempts.length;
  }, [attempts]);

  // Session can start only if every row has a shot type (base chosen) and both flipper values
  const canStart = useMemo(() => {
    if (rows.length === 0) {
      return false;
    }
    return rows.every(r => r.base && r.base.length > 0 && r.initL !== null && r.initL !== undefined && r.initR !== null && r.initR !== undefined);
  }, [rows]);

  // Load a preset from /presets/ folder
  const loadPreset = useCallback(async (preset) => {
    try {
      let presetData;

      // Check if we have embedded presets (standalone mode)
      if (typeof window !== 'undefined' && window.EMBEDDED_PRESETS && window.EMBEDDED_PRESETS[preset.filename]) {
        presetData = window.EMBEDDED_PRESETS[preset.filename];
      } else {
        // Fetch from server
        const response = await fetch(`./presets/${preset.filename}`);
        if (!response.ok) {
          throw new Error('Preset not found');
        }
        presetData = await response.json();
      }

      // Parse preset data and create rows
      const newRows = presetData.map((shot, idx) => {
        // Parse shot type to extract base and location
        const typeStr = shot.shotType || '';
        let base = '';
        let location = '';

        // Try to match against known locations
        const foundLoc = LOCATIONS.find(loc => typeStr.includes(loc));
        if (foundLoc) {
          location = foundLoc;
          base = typeStr.replace(foundLoc, '').trim();
        } else {
          // No location, entire string is base
          base = typeStr;
        }

        // Parse flipper values (handle "NP" for Not Possible)
        const leftVal = shot.leftFlipper === 'NP' || shot.leftFlipper === 'np' ? 0 : snap5(Number(shot.leftFlipper) || 0);
        const rightVal = shot.rightFlipper === 'NP' || shot.rightFlipper === 'np' ? 0 : snap5(Number(shot.rightFlipper) || 0);

        return newRow({
          base,
          location,
          initL: leftVal,
          initR: rightVal,
        }, idx);
      });

      setRows(newRows);
      setAddCountAnchor(null);
      _pushToast(`Loaded preset: ${preset.name}`);
    } catch {
      _pushToast(`Failed to load preset: ${preset.name}`);
    }
  }, [setRows, _pushToast]);

  // Export current rows as preset-compatible JSON and download file
  const exportPreset = useCallback(() => {
    try {
      const data = rows.map(r => ({
        shotType: r.type || buildType(r.base, r.location) || '',
        leftFlipper: r.initL === 0 ? 'NP' : r.initL,
        rightFlipper: r.initR === 0 ? 'NP' : r.initR,
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shots-export.json';
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      _pushToast('Exported shots to shots-export.json');
    } catch {
      _pushToast('Export failed');
    }
  }, [rows, _pushToast]);

  // Download the current standalone HTML file
  const downloadStandalone = useCallback(() => {
    try {
      const htmlContent = document.documentElement.outerHTML;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pinball-trainer-standalone.html';
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      _pushToast('Downloaded standalone HTML file');
    } catch {
      _pushToast('Download failed');
    }
  }, [_pushToast]);

  // Check if running in standalone mode
  const isStandalone = typeof window !== 'undefined' && window.EMBEDDED_IMAGES;

  // Initialize hidden matrix (wrapped so effects & handlers can depend on stable reference)
  const startSession = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    // Capture bases directly
    const bL = rows.map(r => snap5(r.initL));
    const bR = rows.map(r => snap5(r.initR));
    setBaseL(bL); setBaseR(bR);
    // Determine original ordering by starting values
    const ascL = rows.map((r, i) => ({ i, v: r.initL })).sort((a, b) => a.v - b.v).map(x => x.i);
    const ascR = rows.map((r, i) => ({ i, v: r.initR })).sort((a, b) => a.v - b.v).map(x => x.i);
    // Candidate random offsets (independent) within allowed band using configurable steps
    const steps = Math.min(4, Math.max(0, Number(initRandSteps) || 0)); // still capped at 4 for initial randomization.
    // Edge case note: if initRandSteps exceeds the eventual drift usableSteps (floor(driftMag)) then
    // the initial hidden offsets may land outside the subsequent drift band, making early large
    // deviations unreachable until drift magnitude increases. For now we allow this (gives a
    // slightly broader initial challenge) but we could alternatively clamp:
    //   steps = Math.min(steps, Math.floor(Number(driftMag)||0));
    // if consistent bands are preferred.
    const candL = bL.map(v => {
      // If "Not Possible" (0), keep it at 0 - no randomization
      if (v === 0) {
        return 0;
      }
      const off = rndInt(-steps, steps) * 5; const lo = Math.max(0, v - 20); const hi = Math.min(100, v + 20); return snap5(Math.min(hi, Math.max(lo, v + off)));
    });
    const candR = bR.map(v => {
      // If "Not Possible" (0), keep it at 0 - no randomization
      if (v === 0) {
        return 0;
      }
      const off = rndInt(-steps, steps) * 5; const lo = Math.max(0, v - 20); const hi = Math.min(100, v + 20); return snap5(Math.min(hi, Math.max(lo, v + off)));
    });
    // Enforce ordering via bounded isotonic regression
    const hiddenInitL = strictlyIncrease(isotonicWithBounds(candL, bL, ascL).map(v => snap5(v)), bL, ascL);
    const hiddenInitR = strictlyIncrease(isotonicWithBounds(candR, bR, ascR).map(v => snap5(v)), bR, ascR);
    setHiddenL(hiddenInitL); setHiddenR(hiddenInitR);
    setOrderAscL(ascL); setOrderAscR(ascR);
    setMentalL(rows.map(r => r.initL));
    setMentalR(rows.map(r => r.initR));
    setAttempts([]);
    setAttemptCount(0);
    setFinalPhase(false);
    setFinalRecallL(rows.map(r => r.initL));
    setFinalRecallR(rows.map(r => r.initR));
    setInitialized(true);
    // Pick a random starting shot & flipper for both modes so manual mode doesn't always start at first row
    if (rows.length > 0) {
      const randIdx = rndInt(0, rows.length - 1);
      setSelectedIdx(randIdx);
      setSelectedSide(seededRandom() < 0.5 ? 'L' : 'R');
    }
  }, [rows, initRandSteps, setBaseL, setBaseR, setHiddenL, setHiddenR, setOrderAscL, setOrderAscR, setMentalL, setMentalR, setAttempts, setAttemptCount, setFinalPhase, setFinalRecallL, setFinalRecallR, setInitialized, setSelectedIdx, setSelectedSide]);

  // Allow pressing Enter anywhere on setup screen to start the session (if valid)
  useEffect(() => {
    if (initialized) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    function handleKey(e) {
      if (e.key === 'Enter' && !initialized && canStart) {
        if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) {
          return;
        }
        e.preventDefault();
        startSession();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [initialized, canStart, startSession]);

  // Apply drift every N attempts
  useEffect(() => {
    if (!initialized) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    if (attemptCount === 0) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    if (driftEvery <= 0) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    if (attemptCount % driftEvery !== 0) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    // Drift logic:
    // New rule: The drift band around each base value is dynamic: ± (driftMag * 5) percentage points.
    // We still preserve ordering via isotonic regression after applying random steps.
    // driftMag itself can be fractional (step input 0.5); we interpret usable integer steps as floor(driftMag),
    // which determines both the maximum random step distance and the per-attempt clamp band.
    const driftMagNum = Number(driftMag);
    const usableSteps = Math.max(0, Math.min(4, Math.floor(Number.isFinite(driftMagNum) ? driftMagNum : 0))); // retain legacy overall hard ceiling of 4 steps (±20)
    const stepDrift = () => {
      if (usableSteps === 0) {
        return 0;
      }
      const k = rndInt(0, usableSteps);
      const dir = seededRandom() < 0.5 ? -1 : 1;
      return dir * k * 5;
    };

    setHiddenL(prev => {
      if (prev.length === 0 || baseL.length === 0) {
        return prev;
      }
      const drifted = prev.map((v, i) => {
        // If already "Not Possible" (0), it should not drift and remain 0
        if (v === 0) {
          return 0;
        }
        const b = baseL[i];
        const lo = Math.max(0, b - usableSteps * 5);
        const hi = Math.min(100, b + usableSteps * 5);
        const candidate = snap5(v + stepDrift());
        // If drift brings value to 0, it becomes "Not Possible" and will stay 0
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseL, orderAscL);
      return strictlyIncrease(ordered, baseL, orderAscL);
    });
    setHiddenR(prev => {
      if (prev.length === 0 || baseR.length === 0) {
        return prev;
      }
      const drifted = prev.map((v, i) => {
        // If already "Not Possible" (0), it should not drift and remain 0
        if (v === 0) {
          return 0;
        }
        const b = baseR[i];
        const lo = Math.max(0, b - usableSteps * 5);
        const hi = Math.min(100, b + usableSteps * 5);
        const candidate = snap5(v + stepDrift());
        // If drift brings value to 0, it becomes "Not Possible" and will stay 0
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseR, orderAscR);
      return strictlyIncrease(ordered, baseR, orderAscR);
    });
    // eslint-disable-next-line no-empty-function
    return () => {};
  }, [attemptCount, driftEvery, driftMag, orderAscL, orderAscR, initialized, baseL, baseR, setHiddenL, setHiddenR]);

  function validatePercent(numLike) {
    const x = Number(numLike);
    if (!Number.isFinite(x)) {
      return null;
    }
    return snap5(Math.max(0, Math.min(100, x)));
  }

  function pickRandomIdx() {
    if (rows.length === 0) {
      return 0;
    }
    if (rows.length === 1) {
      return 0;
    }
    let idx = rndInt(0, rows.length - 1);
    // avoid immediate repeats
    let tries = 0;
    while (idx === selectedIdx && tries < 5) {
      idx = rndInt(0, rows.length - 1);
      tries++;
    }
    return idx;
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  function submitAttempt(overrideVal) {
    if (!initialized) {
      return;
    }
    const idx = mode === 'random' ? selectedIdx : selectedIdx;
    const usingOverride = overrideVal !== null && overrideVal !== undefined;
    const val = validatePercent(usingOverride ? overrideVal : guess);
    if (!usingOverride && (guess === '' || val === null)) {
      setRecallError('0–100 (0 - Not Possible)');
      setTimeout(() => {
        recallInputRef.current?.focus(); recallInputRef.current?.select();
      }, 0);
      return;
    }
    if (usingOverride && val === null) {
      return;
    } // ignore invalid override silently
    setRecallError('');
    const truth = (selectedSide === 'L' ? hiddenL[idx] : hiddenR[idx]) ?? 0;
    // Determine previous attempt for same shot & side to assess adjustment quality
    const prevSame = attempts.find(a => a.idx === idx && a.side === selectedSide);
    const prevInput = prevSame ? prevSame.input : null;
    const delta = Math.round(val - truth);
    const abs = Math.abs(delta);
    // Classification now fixed to 5% increments:
    // 0 => perfect, 5 => slight, 10 => fairly, >=15 => very (early/late determined by sign)
    let label;
    if (abs === 0) {
      label = 'perfect';
    } else {
      label = delta < 0 ? 'early' : 'late';
    }
    let severity;
    if (abs === 0) {
      severity = 'perfect';
    } else if (abs === 5) {
      severity = 'slight';
    } else if (abs === 10) {
      severity = 'fairly';
    } else {
      severity = 'very';
    } // abs >= 15
    const basePoints = Math.max(0, Math.round(100 - abs));
    // Adjustment logic:
    // If previous attempt existed and was 'late' (prev delta > 0), user should decrease number this time.
    // If previous attempt existed and was 'early' (prev delta < 0), user should increase number.
    // If previous attempt was within tolerance, no adjustment required.
    let adjustRequired = false;
    let requiredDir = 0; // -1 means should go lower, +1 higher, 0 none
    let adjustCorrect = true; // default true if no requirement
    if (prevSame) {
      const prevDelta = prevSame.delta;
      if (prevDelta > 0) {
        adjustRequired = true; requiredDir = -1;
      } else if (prevDelta < 0) {
        adjustRequired = true; requiredDir = 1;
      }
      if (adjustRequired) {
        if (requiredDir === -1 && val >= prevSame.input) {
          adjustCorrect = false;
        }
        if (requiredDir === 1 && val <= prevSame.input) {
          adjustCorrect = false;
        }
      }
    }
    // Adjustment penalty only if required and incorrect. Penalty magnitude scaled by how strongly you went the wrong way or failed to move.
    let adjustPenalty = 0;
    if (adjustRequired && !adjustCorrect && prevInput !== null) {
      const diff = Math.abs(val - prevInput); // wrong direction or zero movement
      // 5 points base penalty + 1 per 5% of (wrong or zero) adjustment up to 25
      adjustPenalty = Math.min(25, 5 + Math.round(diff / 5));
    }
    const points = Math.max(0, basePoints - adjustPenalty);
    const rec = { t: Date.now(), idx, side: selectedSide, input: val, truth, delta, label, severity, points, basePoints, prevInput, adjustRequired, requiredDir, adjustCorrect, adjustPenalty };
    setAttempts((a) => [rec, ...a].slice(0, 200));
    setAttemptCount((c) => c + 1);
    // Update guess values toward the input guess (still adjusts background values)
    if (selectedSide === 'L') {
      setMentalL(m => {
        const n = [...m]; n[idx] = val; return n;
      });
    } else {
      setMentalR(m => {
        const n = [...m]; n[idx] = val; return n;
      });
    }

    // Prepare next random shot and flipper if in random mode
    if (mode === 'random') {
      setSelectedIdx(pickRandomIdx());
      setSelectedSide(seededRandom() < 0.5 ? 'L' : 'R');
    }

    // Clear guess so input resets for next attempt
    setGuess('');
    setRecallError('');
  }

  const endSession = useCallback(() => {
    setFinalPhase(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- setState functions are stable

  const resetAll = useCallback(() => {
    setInitialized(false);
    setHiddenL([]); setHiddenR([]);
    setMentalL([]); setMentalR([]);
    setAttempts([]);
    setAttemptCount(0);
    setFinalPhase(false);
    setFinalRecallL([]); setFinalRecallR([]);
    // Clear any stale selection so overlay lines don't render before canvas measures
    setSelectedBlockId(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- setState functions are stable

  // Final grading
  const finalScore = useMemo(() => {
    if (!finalPhase || rows.length === 0 || hiddenL.length === 0 || hiddenR.length === 0 || finalRecallL.length === 0 || finalRecallR.length === 0) {
      return 0;
    }
    let total = 0; let count = 0;
    for (let i = 0;i < rows.length;i++) {
      const tL = hiddenL[i] ?? 0; const tR = hiddenR[i] ?? 0;
      const gL = clamp(finalRecallL[i] ?? 0); const gR = clamp(finalRecallR[i] ?? 0);
      total += Math.abs(gL - tL); count++;
      total += Math.abs(gR - tR); count++;
    }
    if (!count) {
      return 0;
    }
    const mae = total / count;
    return Math.max(0, Math.round(100 - mae));
  }, [finalPhase, rows, hiddenL, hiddenR, finalRecallL, finalRecallR]);

  // One-time snapping of any legacy non-5 values after load
  useEffect(() => {
    setRows(prev => prev.map(r => ({
      ...r,
      initL: r.initL === null || r.initL === undefined ? null : snap5(r.initL),
      initR: r.initR === null || r.initR === undefined ? null : snap5(r.initR),
    })));
    setMentalL(m => m.map(v => snap5(v ?? 0)));
    setMentalR(m => m.map(v => snap5(v ?? 0)));
    setHiddenL(h => h.map(v => snap5(v ?? 0)));
    setHiddenR(h => h.map(v => snap5(v ?? 0)));
    setFinalRecallL(r => r.map(v => snap5(v ?? 0)));
    setFinalRecallR(r => r.map(v => snap5(v ?? 0)));
    // Update ROW_ID_SEED to avoid ID conflicts with loaded rows
    if (rows.length > 0) {
      const maxId = Math.max(...rows.map(r => r.id));
      if (maxId >= ROW_ID_SEED) {
        ROW_ID_SEED = maxId + 1;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Section & NumberInput hoisted above)
  // --- Reordering helpers (only active pre-session) ---
  const [dragRowIdx, setDragRowIdx] = useState(null);
  function normalizeRowPercents(rowsArr) {
    // Left side normalization: non-decreasing; zeros allowed until first positive; after first positive, strictly increasing (>= +5); no zeros allowed below first positive.
    let lastNonZero = 0;
    const out = rowsArr.map(r => ({ ...r }));
    for (const element of out) {
      const raw = element.initL;
      if (raw === null || raw === undefined) {
        continue;
      } // leave nulls/undefined untouched
      let v = snap5(raw);
      if (v < 0) {
        v = 0;
      }
      if (lastNonZero === 0) {
        // zeros allowed; any positive establishes lastNonZero
      } else if (v === 0 || v <= lastNonZero) {
        v = Math.min(100, lastNonZero + 5);
      }
      element.initL = v;
      if (v > 0) {
        lastNonZero = v;
      }
    }
    // Right side normalization: strictly decreasing top -> bottom.
    let prevR = 105; // greater than max
    for (const element of out) {
      const raw = element.initR;
      if (raw === null || raw === undefined) {
        continue;
      } // leave nulls/undefined untouched
      let v = snap5(raw);
      if (v >= prevR) {
        v = prevR - 5;
      }
      if (v < 0) {
        v = 0;
      }
      element.initR = v;
      prevR = v;
    }
    return out;
  }
  function handleRowReorder(fromIdx, toIdx) {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) {
      setDragRowIdx(null); return;
    }
    setRows(prev => {
      // Helper: align current spatial left->right order to current top->bottom order if out of sync.
      // eslint-disable-next-line unicorn/consistent-function-scoping
      function alignPositions(list) {
        const sortedPositions = [...list].sort((a, b) => a.x - b.x).map(r => ({ x: r.x, y: r.y }));
        return list.map((r, i) => ({ ...r, x: sortedPositions[i].x, y: sortedPositions[i].y }));
      }
      // Start from a deep-ish copy (shallow objects cloned so we can mutate x,y safely)
      let arr = prev.map(r => ({ ...r }));
      // Pre-align if previous operations left them mismatched.
      const misaligned = (() => {
        const orderByX = [...arr].sort((a, b) => a.x - b.x);
        for (const [i, element] of arr.entries()) {
          if (orderByX[i].id !== element.id) {
            return true;
          }
        }
        return false;
      })();
      if (misaligned) {
        arr = alignPositions(arr);
      }
      // Perform adjacent swaps to move fromIdx to toIdx while swapping spatial coordinates with each neighbor.
      if (fromIdx < toIdx) {
        for (let i = fromIdx; i < toIdx; i++) {
          const a = arr[i];
          const b = arr[i + 1];
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
          arr[i] = b; arr[i + 1] = a;
        }
      } else if (fromIdx > toIdx) {
        for (let i = fromIdx; i > toIdx; i--) {
          const a = arr[i];
          const b = arr[i - 1];
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
          arr[i] = b; arr[i - 1] = a;
        }
      }
      // Final guarantee: enforce left->right strictly increasing relative order to index sequence (minimal reassignment if needed)
      const outOfOrder = arr.some((r, i) => i > 0 && arr[i - 1].x > r.x);
      if (outOfOrder) {
        arr = alignPositions(arr);
      }
      // Normalize percentage constraints after reorder.
      return normalizeRowPercents(arr);
    });
    setDragRowIdx(null);
  }
  // Compute dynamic insertion indicator index while dragging (target index under cursor)
  const [dragOverIdx, setDragOverIdx] = useState(null);
  // Recall input ref for auto-focus
  const recallInputRef = useRef(null);
  // Validation error message for recall input (setter used for validation feedback)
  // eslint-disable-next-line react/hook-use-state -- only setter is needed, value not displayed
  const [, setRecallError] = useState('');
  // Fullscreen playfield state
  const [playfieldFullscreen, setPlayfieldFullscreen] = useState(false);
  const [fullscreenScale, setFullscreenScale] = useState(1); // current scale reported by fullscreen playfield
  const [windowWidth, setWindowWidth] = useState(typeof window === 'undefined' ? 800 : window.innerWidth);
  // Track window width for responsive chip sizing in fullscreen mode
  useEffect(() => {
    if (playfieldFullscreen) {
      const handleResize = () => setWindowWidth(window.innerWidth);
      // Set initial value
      setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    // eslint-disable-next-line no-empty-function
    return () => {};
  }, [playfieldFullscreen]);
  // Prevent body/document scrolling when fullscreen overlay is active (removes stray window scrollbar)
  useEffect(() => {
    if (!playfieldFullscreen) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlScrollbarGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Prevent scrollbar gutter reservation that can cause white bar on right
    document.documentElement.style.scrollbarGutter = 'auto';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.scrollbarGutter = prevHtmlScrollbarGutter;
    };
  }, [playfieldFullscreen]);
  // Allow pressing Escape to exit fullscreen (mirrors clicking Exit button)
  useEffect(() => {
    if (!playfieldFullscreen) {
      // eslint-disable-next-line no-empty-function
      return () => {};
    }
    function handleEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPlayfieldFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [playfieldFullscreen]);
  // Focus recall input when session starts (initialized true and not final phase)
  useEffect(() => {
    if (initialized && !finalPhase) {
      // small timeout ensures element mounted after conditional render
      setTimeout(() => {
        recallInputRef.current?.focus(); recallInputRef.current?.select();
      }, 0);
    }
  }, [initialized, finalPhase]);
  return (
    <div className={`min-h-screen bg-gradient-to-b transition-colors ${darkMode ? 'dark from-slate-900 to-slate-950 text-slate-100' : 'from-slate-100 to-slate-200 text-slate-900'}`}>
      {/* Info Modal */}
      {showInfoModal ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setShowInfoModal(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            aria-label="Close modal"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            className={`relative rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'}`}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <h2 id="info-modal-title" className={`text-2xl md:text-3xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>About This App</h2>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={`space-y-6 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Pinball Accuracy Memory Trainer</h3>
                  <p className="leading-relaxed">
                    A training tool designed to help pinball players improve their shot accuracy estimation and mental model of flipper-to-target percentages. Practice recalling and adjusting your guesses to build muscle memory for real-world pinball play.
                  </p>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>How It Works</h3>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Setup shots on a virtual playfield with left and right flipper percentages</li>
                    <li>Practice recalling those percentages from memory</li>
                    <li>Get immediate feedback on your accuracy</li>
                    <li>Track your improvement over time with detailed scoring</li>
                  </ul>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Author</h3>
                  <p className="leading-relaxed">
                    Created by Gary Brown for the pinball community. This tool runs entirely in your browser with no data sent to any server - all your practice data stays local.
                  </p>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Open Source</h3>
                  <p className="leading-relaxed mb-3">
                    This project is open source and available on GitHub. Contributions, feedback, and suggestions are welcome!
                  </p>
                  <a
                    href="https://github.com/garybrowndev/PinballAccuracyMemoryTrainer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    View on GitHub
                  </a>
                </div>
                <div className="pt-4 border-t text-sm text-slate-500">
                  <p>
                    Version {typeof __APP_VERSION__ === 'undefined' ? '0.0.1' : __APP_VERSION__}
                    {(() => {
                      if (typeof __BUILD_COMMIT__ === 'undefined' || !__BUILD_COMMIT__) {
                        return null;
                      }
                      if (__BUILD_COMMIT__ === 'dev') {
                        return <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Development Build</span>;
                      }
                      return (
                        <span className="ml-2">
                          (
                          {(typeof __BUILD_COMMIT_URL__ !== 'undefined' && __BUILD_COMMIT_URL__) ? (
                            <a href={__BUILD_COMMIT_URL__} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" title="View commit on GitHub">
                              {__BUILD_COMMIT__}
                            </a>
                          ) : (
                            <span>{__BUILD_COMMIT__}</span>
                          )}
                          {Boolean(typeof __BUILD_WORKFLOW_URL__ !== 'undefined' && __BUILD_WORKFLOW_URL__) && (
                            <>
                              {' • '}
                              <a href={__BUILD_WORKFLOW_URL__} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" title="View build workflow">
                                build
                              </a>
                            </>
                          )}
                          )
                        </span>
                      );
                    })()}
                  </p>
                  <p className="mt-1">Built with React + Vite + Tailwind CSS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* Toast notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-fadein">
            {t.msg}
          </div>
        ))}
      </div>
      {/* Detached popups (portals) for shot & location selection */}
      {shotMenuAnchor && openShotMenuId !== null ? createPortal(
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- container for interactive buttons
        <div
          className={`absolute z-50 w-[360px] rounded-xl border shadow-xl p-3 grid grid-cols-4 gap-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          style={{ left: `${Math.max(8, shotMenuAnchor.x)}px`, top: `${shotMenuAnchor.y}px` }}
          role="dialog"
          aria-label="Select shot type"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {BASE_ELEMENTS.map(b => {
            const currentRow = rows.find(r => r.id === shotMenuAnchor.id);
            const isSel = currentRow?.base === b;
            const hasSelection = Boolean(currentRow?.base);
            return (
              <ElementTile
                key={b}
                name={b}
                selected={isSel}
                hasSelection={hasSelection}
                darkMode={darkMode}
                onSelect={() => {
                  if (isSel) {
                  // Clicking the currently selected shot deselects it; keep menu open
                    setRows(prev => {
                      const next = [...prev]; const idx = prev.findIndex(r => r.id === shotMenuAnchor.id); if (idx > -1) {
                        next[idx] = { ...next[idx], base: '', type: '' };
                      } return next;
                    });
                  } else {
                  // Selecting a new shot; close menu
                    setRows(prev => {
                      const next = [...prev]; const idx = prev.findIndex(r => r.id === shotMenuAnchor.id); if (idx > -1) {
                        next[idx] = { ...next[idx], base: b, type: buildType(b, next[idx].location || '') };
                      } return next;
                    });
                    setOpenShotMenuId(null); setShotMenuAnchor(null);
                  }
                }}
              />
            );
          })}
        </div>,
        document.body,
      ) : null}
      {locMenuAnchor && openLocMenuId !== null ? createPortal(
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- container for interactive buttons
        <div
          className={`absolute z-50 w-48 rounded-xl border shadow-xl p-2 grid grid-cols-2 gap-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          style={{ left: `${Math.max(8, locMenuAnchor.x)}px`, top: `${locMenuAnchor.y}px` }}
          role="dialog"
          aria-label="Select location"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {LOCATIONS.map(loc => {
            const currentRow = rows.find(r => r.id === locMenuAnchor.id);
            const isSel = currentRow?.location === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  if (isSel) {
                  // Clicking the currently selected location deselects it; keep menu open
                    setRows(prev => {
                      const next = [...prev]; const idx = prev.findIndex(r => r.id === locMenuAnchor.id); if (idx > -1) {
                        const base = next[idx].base || ''; next[idx] = { ...next[idx], location: '', type: buildType(base, '') };
                      } return next;
                    });
                  } else {
                  // Selecting a new location; close menu
                    setRows(prev => {
                      const next = [...prev]; const idx = prev.findIndex(r => r.id === locMenuAnchor.id); if (idx > -1) {
                        const base = next[idx].base || ''; next[idx] = { ...next[idx], location: loc, type: buildType(base, loc) };
                      } return next;
                    });
                    setOpenLocMenuId(null); setLocMenuAnchor(null);
                  }
                }}
                className={(() => {
                  let selClass;
                  if (isSel) {
                    selClass = 'bg-slate-900 text-white';
                  } else if (darkMode) {
                    selClass = 'bg-slate-700 hover:bg-slate-600 text-slate-200';
                  } else {
                    selClass = 'bg-slate-100 hover:bg-slate-200 text-slate-700';
                  }
                  return `${selClass} text-[11px] px-2 py-1 rounded-md text-left`;
                })()}
              >{loc}</button>
            );
          })}
        </div>,
        document.body,
      ) : null}
      {addCountAnchor && rows.length === 0 ? createPortal(
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- container for interactive buttons
        <div
          className={`absolute z-50 w-44 rounded-xl border shadow-xl p-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          style={{ left: `${Math.max(8, addCountAnchor.x)}px`, top: `${addCountAnchor.y}px` }}
          role="dialog"
          aria-label="How many shots to add"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 20 }, (_, k) => k + 1).map(n => (
              <button
                key={n}
                type="button"
                className={`text-[11px] px-2 py-1 rounded-md ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                onClick={() => {
                  const count = n;
                  // eslint-disable-next-line unicorn/consistent-function-scoping
                  const buildRows = (cnt) => {
                    const asc = Array.from({ length: cnt }, (_, i) => snap5(((i + 1) / (cnt + 1)) * 100));
                    for (let i = 1;i < asc.length;i++) {
                      if (asc[i] <= asc[i - 1]) {
                        asc[i] = Math.min(100, asc[i - 1] + 5);
                      }
                    }
                    for (let i = asc.length - 2;i >= 0;i--) {
                      if (asc[i] >= asc[i + 1]) {
                        asc[i] = Math.max(5, asc[i + 1] - 5);
                      }
                    }
                    const desc = [...asc].reverse();
                    return asc.map((v, i) => newRow({ initL: v, initR: desc[i] }, i));
                  };
                  setRows(buildRows(count));
                  setAddCountAnchor(null);
                }}
              >{n}</button>
            ))}
            <div className={`col-span-4 mt-1 text-[10px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>How many shots?</div>
          </div>
          {availablePresets.length > 0 && (
            <div className={`mt-2 pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`text-[10px] text-center mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Or load a preset:</div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); setPresetOpen(p => !p);
                  }}
                  className={`w-full text-left overflow-hidden whitespace-nowrap text-[11px] px-2 py-1 rounded-md flex items-center justify-between ${darkMode ? 'bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-300' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                  aria-expanded={presetOpen}
                  aria-haspopup="listbox"
                  title={selectedPresetName || 'Select preset'}
                >
                  <span className="truncate block" style={{ maxWidth: '80%' }}>{selectedPresetName || 'Choose preset...'}</span>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="w-4 h-4 ml-2">
                    <path d="M6 8l4 4 4-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {presetOpen ? (
                  <div
                    role="listbox"
                    aria-label="Available presets"
                    tabIndex={-1}
                    className={`absolute left-0 bottom-full mb-1 overflow-visible rounded-xl border-2 shadow-lg z-60 p-2 ${darkMode ? 'bg-slate-800 border-emerald-600' : 'bg-white border-emerald-400'}`}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.25rem', maxWidth: 'calc(100vw - 2rem)', width: 'max-content' }}
                  >
                    {availablePresets.map(preset => (
                      <button
                        key={preset.filename}
                        type="button"
                        role="option"
                        aria-selected={selectedPresetName === preset.name}
                        onClick={() => {
                          loadPreset(preset); setSelectedPresetName(preset.name); setPresetOpen(false); setAddCountAnchor(null);
                        }}
                        title={preset.name}
                        className={(() => {
                          const isSelected = selectedPresetName === preset.name;
                          let ringClass;
                          if (isSelected && darkMode) {
                            ringClass = 'bg-emerald-800 ring-2 ring-emerald-500';
                          } else if (isSelected) {
                            ringClass = 'bg-emerald-200 ring-2 ring-emerald-400';
                          } else if (darkMode) {
                            ringClass = 'ring-1 ring-emerald-700';
                          } else {
                            ringClass = 'ring-1 ring-emerald-200';
                          }
                          const textClass = darkMode ? 'text-emerald-300 hover:bg-emerald-700/50' : 'text-emerald-700 hover:bg-emerald-100';
                          return `${ringClass} text-left whitespace-nowrap text-[11px] px-2 py-1 rounded-md transition ${textClass}`;
                        })()}
                      >
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>,
        document.body,
      ) : null}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Setup */}
        {!initialized && (
          <>
            {/* Compute misordered shot IDs: any row whose sequence index differs from its rank in ascending x coordinate. */}
            {(() => {
              // Precompute once per render; inexpensive for small row counts.
            })()}
            <Section
              title="Setup Shots"
              darkMode={darkMode}
              right={
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isStandalone) {
                        downloadStandalone();
                      } else {
                        _pushToast('Download only works in standalone mode');
                      }
                    }}
                    className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? ICON_BTN_DARK : ICON_BTN_LIGHT} ${isStandalone ? '' : 'opacity-60'}`}
                    title={isStandalone ? 'Download this standalone HTML file' : 'Download (only works in standalone mode)'}
                    aria-label="Download standalone"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="M7 10l5 5 5-5" />
                      <path d="M12 15V3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-yellow-400 hover:text-yellow-300' : ICON_BTN_LIGHT}`}
                    title={darkMode ? DARK_MODE_SWITCH_LIGHT : DARK_MODE_SWITCH_DARK}
                    aria-label={darkMode ? DARK_MODE_SWITCH_LIGHT : DARK_MODE_SWITCH_DARK}
                  >
                    {darkMode ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInfoModal(true)}
                    className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? ICON_BTN_DARK : ICON_BTN_LIGHT}`}
                    title="About this app"
                    aria-label="About"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <path d="M12 17h.01" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled
                    className={`${BTN_ICON} ${darkMode ? 'bg-blue-600 border-2 border-blue-400' : 'bg-blue-600 border-2 border-blue-400'} font-semibold`}
                    title="Currently on Setup page"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Setup
                  </button>
                  <button
                    onClick={() => {
                      if (canStart) {
                        startSession();
                      }
                    }}
                    disabled={!canStart}
                    className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${BTN_SUCCESS} ${canStart ? '' : 'opacity-50 cursor-not-allowed'}`}
                    title={canStart ? 'Start the practice session' : 'Complete Shot Type, Left & Right values for every shot'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Practice
                  </button>
                  <button
                    onClick={() => {
                      if (canStart) {
                        startSession();
                        setFinalPhase(true);
                      }
                    }}
                    disabled={!canStart}
                    className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${BTN_SUCCESS} ${canStart ? '' : 'opacity-50 cursor-not-allowed'}`}
                    title={canStart ? 'Go directly to final recall' : 'Complete Shot Type, Left & Right values for every shot'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    Recall
                  </button>
                </div>
              }
            >
              <div className={`mb-4 text-xs ${GetTextClass(darkMode, 'secondary')}`}>Spatial arrangement helps visualize logical ordering. Misordered shots (array order vs left→right) are highlighted in red.</div>
              {(() => {
                const misorderedIds = (() => {
                  if (rows.length === 0) {
                    return new Set();
                  }
                  const byX = [...rows].sort((a, b) => a.x - b.x).map(r => r.id);
                  const mis = new Set();
                  for (const [i, row] of rows.entries()) {
                    if (row.id !== byX[i]) {
                      mis.add(row.id);
                    }
                  }
                  return mis;
                })();
                return (
                  <PlayfieldEditor
                    rows={rows}
                    setRows={setRows}
                    selectedId={selectedBlockId}
                    setSelectedId={setSelectedBlockId}
                    misorderedIds={misorderedIds}
                    darkMode={darkMode}
                    onClear={() => {
                      setRows([]);
                      setCollapsedTypes([]);
                      _pushToast('Cleared all shots');
                    }}
                    onExample={() => {
                      setRows([
                        newRow({ base: 'Orbit', location: 'Left', initL: 25, initR: 75 }, 0),
                        newRow({ base: 'Ramp', location: 'Center', initL: 50, initR: 50 }, 1),
                        newRow({ base: 'Orbit', location: 'Right', initL: 75, initR: 25 }, 2),
                      ]);
                      _pushToast('Loaded example shots');
                    }}
                    advancedOptions={
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`${GetTextClass(darkMode, 'secondary')}`} title="How far each correct value can start from your initial guess (in 5% steps)">Initial random (×5%)</span>
                          <NumberInput value={initRandSteps} onChange={setInitRandSteps} min={0} max={4} darkMode={darkMode} />
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`${GetTextClass(darkMode, 'secondary')}`} title="How often hidden values shift after attempts">Drift every N attempts</span>
                          <div className="flex items-center gap-1">
                            <NumberInput value={driftEvery} onChange={setDriftEvery} min={0} max={50} darkMode={darkMode} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`${GetTextClass(darkMode, 'secondary')}`} title="Maximum distance (in 5% steps) a value can wander from its base during drift">Drift magnitude (×5%)</span>
                          <NumberInput value={driftMag} onChange={setDriftMag} min={0} max={10} step={0.5} darkMode={darkMode} />
                        </div>
                        <div className={`pt-1.5 border-t ${GetBorderClass(darkMode)}`}>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className={`${GetTextClass(darkMode, 'secondary')}`} title="Manual lets you pick any shot & flipper; Random picks one for you">Mode</span>
                            <div className="flex gap-1">
                              <Chip active={mode === 'manual'} onClick={() => setMode('manual')} darkMode={darkMode} className="text-[10px] px-2 py-0.5">Manual</Chip>
                              <Chip active={mode === 'random'} onClick={() => setMode('random')} darkMode={darkMode} className="text-[10px] px-2 py-0.5">Random</Chip>
                            </div>
                          </div>
                          {mode === 'random' && (
                            <label className={`flex items-center justify-end gap-2 ${GetTextClass(darkMode, 'muted')}`}>
                              <span>Seeded</span>
                              <input
                                type="checkbox"
                                checked={useSeededRandom}
                                onChange={(e) => setUseSeededRandom(e.target.checked)}
                                className={GetCheckboxClass(darkMode)}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    }
                  />
                );
              })()}
              <div className="overflow-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[35%]" />
                    <col className="w-[35%]" />
                    {/* Compact actions column for 3 stacked icons */}
                    <col className="w-[5%]" />
                  </colgroup>
                  <thead>
                    <tr className={`text-left align-bottom ${GetTextClass(darkMode, 'secondary')}`}>
                      <th className={`p-2 ${selectedBlockId === 'FLIPPER_BOTH' ? GetBgClass(darkMode, 'primary') : ''}`}>
                        <div className="flex items-center gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (selectedBlockId !== 'FLIPPER_BOTH') {
                                setSelectedBlockId('FLIPPER_BOTH');
                              }
                            }}
                            onKeyDown={e => {
                              if ((e.key === 'Enter' || e.key === ' ') && selectedBlockId !== 'FLIPPER_BOTH') {
                                setSelectedBlockId('FLIPPER_BOTH');
                              }
                            }}
                            onMouseEnter={() => setHoverFlipperColumn('BOTH')}
                            onMouseLeave={() => setHoverFlipperColumn(null)}
                            className={`rounded px-1 cursor-pointer select-none ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
                            title="Select Both Flippers"
                          >Shot Type</span>
                          {rows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => prev.map(rw => ({ ...rw, base: '', location: '', type: '', initL: rw.initL, initR: rw.initR })));
                                setCollapsedTypes([]);
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-md ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-300'}`}
                              title="Clear all shot type selections"
                            >Clear</button>
                          )}
                        </div>
                      </th>
                      {/* eslint-disable-next-line no-nested-ternary */}
                      <th className={`p-2 ${selectedBlockId === 'FLIPPER_L' || selectedBlockId === 'FLIPPER_BOTH' || hoverFlipperColumn === 'L' || hoverFlipperColumn === 'BOTH' ? (darkMode ? 'bg-sky-900/30' : 'bg-sky-50') : ''}`}>
                        <div className="flex items-center gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (selectedBlockId !== 'FLIPPER_L') {
                                setSelectedSide('L'); setSelectedBlockId('FLIPPER_L');
                              }
                            }}
                            onKeyDown={e => {
                              if ((e.key === 'Enter' || e.key === ' ') && selectedBlockId !== 'FLIPPER_L') {
                                setSelectedSide('L'); setSelectedBlockId('FLIPPER_L');
                              }
                            }}
                            onMouseEnter={() => setHoverFlipperColumn('L')}
                            onMouseLeave={() => setHoverFlipperColumn(null)}
                            className="hover:bg-emerald-50 rounded px-1 cursor-pointer select-none"
                            title="Select Left Flipper"
                          >Left Flipper</span>
                          {rows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => {
                                  const n = prev.length;
                                  if (!n) {
                                    return prev;
                                  }
                                  const asc = Array.from({ length: n }, (_, i) => snap5(((i + 1) / (n + 1)) * 100));
                                  for (let k = 1;k < asc.length;k++) {
                                    if (asc[k] <= asc[k - 1]) {
                                      asc[k] = Math.min(100, asc[k - 1] + 5);
                                    }
                                  }
                                  for (let k = asc.length - 2;k >= 0;k--) {
                                    if (asc[k] >= asc[k + 1]) {
                                      asc[k] = Math.max(5, asc[k + 1] - 5);
                                    }
                                  }
                                  return prev.map((rw, idx) => ({ ...rw, initL: asc[idx] }));
                                });
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-md ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-300'}`}
                              title="Auto-fill evenly spaced ascending values starting near center for left flipper"
                            >Reset</button>
                          )}
                        </div>
                      </th>
                      {/* eslint-disable-next-line no-nested-ternary */}
                      <th className={`p-2 ${selectedBlockId === 'FLIPPER_R' || selectedBlockId === 'FLIPPER_BOTH' || hoverFlipperColumn === 'R' || hoverFlipperColumn === 'BOTH' ? (darkMode ? 'bg-rose-900/30' : 'bg-rose-50') : ''}`}>
                        <div className="flex items-center gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (selectedBlockId !== 'FLIPPER_R') {
                                setSelectedSide('R'); setSelectedBlockId('FLIPPER_R');
                              }
                            }}
                            onKeyDown={e => {
                              if ((e.key === 'Enter' || e.key === ' ') && selectedBlockId !== 'FLIPPER_R') {
                                setSelectedSide('R'); setSelectedBlockId('FLIPPER_R');
                              }
                            }}
                            onMouseEnter={() => setHoverFlipperColumn('R')}
                            onMouseLeave={() => setHoverFlipperColumn(null)}
                            className="hover:bg-rose-50 rounded px-1 cursor-pointer select-none"
                            title="Select Right Flipper"
                          >Right Flipper</span>
                          {rows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => {
                                  const n = prev.length; if (!n) {
                                    return prev;
                                  }
                                  const asc = Array.from({ length: n }, (_, i) => snap5(((i + 1) / (n + 1)) * 100));
                                  for (let k = 1;k < asc.length;k++) {
                                    if (asc[k] <= asc[k - 1]) {
                                      asc[k] = Math.min(100, asc[k - 1] + 5);
                                    }
                                  }
                                  for (let k = asc.length - 2;k >= 0;k--) {
                                    if (asc[k] >= asc[k + 1]) {
                                      asc[k] = Math.max(5, asc[k + 1] - 5);
                                    }
                                  }
                                  const desc = [...asc].reverse();
                                  return prev.map((rw, idx) => ({ ...rw, initR: desc[idx] }));
                                });
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-md ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-300'}`}
                              title="Auto-fill evenly spaced descending values (high→low) for right flipper"
                            >Reset</button>
                          )}
                        </div>
                      </th>
                      <th className="p-2 text-left align-bottom">
                        <div className="flex flex-col items-end">
                          {rows.length > 0 && (
                            <button
                              type="button"
                              onClick={exportPreset}
                              className="cursor-pointer text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                              title="Export shots as JSON"
                              aria-label="Export shots"
                            >
                              {/* Standard export/upload icon: arrow up out of tray */}
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M7 10l5-5 5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M12 5v11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className={`p-8 text-center text-sm ${GetTextClass(darkMode, 'secondary')}`}>
                          <button
                            type="button"
                            data-add-multi
                            onClick={(e) => {
                              e.stopPropagation();
                              if (addCountAnchor) {
                                setAddCountAnchor(null); return;
                              }
                              const r = e.currentTarget.getBoundingClientRect();
                              setAddCountAnchor({ x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 });
                            }}
                            className={`px-4 py-2 rounded-xl text-white text-sm ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                          >+ Add Shot(s)</button>
                        </td>
                      </tr>
                    )}
                    {rows.map((r, i) => (
                      <React.Fragment key={r.id}>
                        {/* Insertion marker BEFORE row i (visible when dragging and target is i) */}
                        {dragRowIdx !== null && dragOverIdx === i && (
                          <tr aria-hidden className="pointer-events-none">
                            <td colSpan={4} className="p-0">
                              <div className="h-2 relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] animate-pulse" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr
                          className={(() => {
                            const baseClasses = 'border-t align-top cursor-default';
                            const dragClass = dragRowIdx === i ? 'bg-emerald-50 ring-1 ring-emerald-300' : '';
                            const selectedBg = GetBgClass(darkMode, 'primary');
                            const selectedClass = selectedBlockId === r.id && dragRowIdx !== i ? selectedBg : '';
                            const hoverBg = GetHoverClass(darkMode);
                            const hoverClass = selectedBlockId === r.id ? '' : hoverBg;
                            return `${baseClasses} ${dragClass} ${selectedClass} ${hoverClass}`;
                          })()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIdx(i);
                            setSelectedBlockId(r.id);
                            // Close any open menus when clicking the row
                            setOpenShotMenuId(null);
                            setOpenLocMenuId(null);
                            setShotMenuAnchor(null);
                            setLocMenuAnchor(null);
                          }}
                          onDragOver={(e) => {
                            if (initialized) {
                              return;
                            } e.preventDefault(); setDragOverIdx(i);
                          }}
                          onDrop={(e) => {
                            if (initialized) {
                              return;
                            } e.preventDefault(); handleRowReorder(dragRowIdx, i); setDragOverIdx(null);
                          }}
                        >
                          <td className="pt-2 pr-2 pl-2 pb-2 align-top relative">
                            {(() => {
                              const base = r.base || '';
                              const location = r.location || '';
                              const shotMenuOpen = openShotMenuId === r.id;
                              const locMenuOpen = openLocMenuId === r.id;
                              const closeMenus = () => {
                                setOpenShotMenuId(null); setOpenLocMenuId(null); setShotMenuAnchor(null); setLocMenuAnchor(null);
                              };
                              return (
                                <div className="flex items-center gap-2 relative">
                                  {base ? (
                                    <InlineElementThumb
                                      name={base}
                                      selected
                                      darkMode={darkMode}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIdx(i); setSelectedBlockId(r.id);
                                        // Only open the shot menu, do not clear selection
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setShotMenuAnchor({ id: r.id, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY - ((rect.bottom - rect.top) * 0.7) });
                                        setOpenShotMenuId(r.id);
                                        setOpenLocMenuId(null);
                                      }}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      data-shot-chip={r.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIdx(i); setSelectedBlockId(r.id);
                                        if (shotMenuOpen) {
                                          closeMenus();
                                        } else {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setShotMenuAnchor({ id: r.id, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
                                          setOpenShotMenuId(r.id);
                                          setOpenLocMenuId(null);
                                        }
                                      }}
                                      className={`relative rounded-md shadow-sm ring-1 ring-slate-300 hover:ring-slate-500 transition ring-offset-1 focus:outline-none focus:ring-2 focus:ring-slate-900 overflow-visible flex items-center justify-center ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
                                      style={{ width: 80, height: 98 }}
                                      aria-label="Select Shot"
                                    >
                                      <span className={`text-[13px] font-semibold select-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select Shot</span>
                                    </button>
                                  )}
                                  <Chip
                                    active={Boolean(location)}
                                    data-loc-chip={r.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedIdx(i); setSelectedBlockId(r.id);
                                      // Always open menu, don't clear location on click
                                      if (locMenuOpen) {
                                        closeMenus();
                                      } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setLocMenuAnchor({ id: r.id, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 4 });
                                        setOpenLocMenuId(r.id);
                                        setOpenShotMenuId(null);
                                      }
                                    }}
                                  >{location || 'Location'}</Chip>
                                  {/* Popup menus rendered outside table to avoid layout shift */}
                                </div>
                              );
                            })()}
                          </td>
                          {/* eslint-disable-next-line no-nested-ternary */}
                          <td className={`p-2 ${selectedBlockId === 'FLIPPER_L' || selectedBlockId === 'FLIPPER_BOTH' || hoverFlipperColumn === 'L' || hoverFlipperColumn === 'BOTH' ? (darkMode ? 'bg-sky-900/30' : 'bg-sky-50') : ''}`}>
                            <div className="flex flex-col gap-1 w-full px-[10px]">
                              {(() => {
                                const range = computeAllowedRange(rows, 'L', i);
                                const rawAllowedMin = range ? range[0] : 5;
                                const rawAllowedMax = range ? range[1] : 100;
                                // Clamp to new visual/domain max of 95
                                const allowedMin = Math.max(5, Math.min(95, rawAllowedMin));
                                const allowedMax = Math.max(5, Math.min(95, rawAllowedMax));
                                let actual = r.initL && r.initL > 0 ? r.initL : null;
                                if (actual === null) {
                                  // No value set
                                } else {
                                  if (actual > allowedMax) {
                                    actual = allowedMax;
                                  } // clamp any legacy 100s down to 95 visually
                                  if (actual < allowedMin) {
                                    actual = allowedMin;
                                  }
                                }
                                const sliderMin = 5; const sliderMax = 95;
                                const displayVal = actual === null ? 50 : actual;
                                // Ascending visual (05 -> 95). Grey before allowedMin and after allowedMax.
                                const span = 95 - 5; // 90
                                const leftGreyPct = ((allowedMin - 5) / span) * 100;
                                const rightGreyStartPct = ((allowedMax - 5) / span) * 100;
                                const trackBg = range ? `linear-gradient(to right,
                                rgba(55,65,81,0.70) 0%,
                                rgba(55,65,81,0.70) ${leftGreyPct}%,
                                rgba(14,165,233,0.35) ${leftGreyPct}%,
                                rgba(14,165,233,0.35) ${rightGreyStartPct}%,
                                rgba(55,65,81,0.70) ${rightGreyStartPct}%,
                                rgba(55,65,81,0.70) 100%)` : 'linear-gradient(to right, rgba(55,65,81,0.70), rgba(55,65,81,0.70))';
                                return (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 -mb-1">
                                      <span>05</span><span>95</span>
                                    </div>
                                    <div className="relative">
                                      <input
                                        data-slider
                                        type="range"
                                        min={sliderMin}
                                        max={sliderMax}
                                        step={5}
                                        value={Math.min(Math.max(actual === null ? displayVal : actual, sliderMin), sliderMax)}
                                        onMouseDown={e => {
                                          e.stopPropagation();
                                        }}
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                        }}
                                        onDragStart={e => {
                                          e.preventDefault(); e.stopPropagation();
                                        }}
                                        onChange={e => {
                                          let newActual = Number(e.target.value);
                                          if (newActual > allowedMax) {
                                            newActual = allowedMax;
                                          }
                                          if (newActual < allowedMin) {
                                            newActual = allowedMin;
                                          }
                                          setRows(prev => {
                                            const next = [...prev]; next[i] = { ...next[i], initL: newActual }; return next;
                                          });
                                        }}
                                        style={{ background: trackBg }}
                                        className="w-full appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
                                      />
                                      {range && !(allowedMin === 5 && allowedMax === 95) ? (() => {
                                        return (
                                          <>
                                            <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-sky-700" style={{ left: `${leftGreyPct}%` }}>{format2(allowedMin)}</div>
                                            <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-sky-700" style={{ left: `${rightGreyStartPct}%` }}>{format2(allowedMax)}</div>
                                          </>
                                        );
                                      })() : null}
                                      {actual !== null && range ? (() => {
                                        const pct = ((actual - 5) / span) * 100;
                                        return (
                                          <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-[-50%] text-[10px] font-medium bg-sky-600 text-white px-2 py-1 rounded-md shadow min-w-[30px] text-center" style={{ left: `${pct}%` }}>{format2(actual)}</div>
                                        );
                                      })() : null}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex flex-col items-center mt-[15px]">
                                <Chip
                                  active={r.initL === 0}
                                  darkMode={darkMode}
                                  onClick={() => {
                                    const range = computeAllowedRange(rows, 'L', i);
                                    if (r.initL === 0) {
                                      if (range) {
                                        const mid = Math.round((range[0] + range[1]) / 2 / 5) * 5;
                                        setRows(prev => {
                                          const next = [...prev]; next[i] = { ...next[i], initL: mid }; return next;
                                        });
                                      }
                                    } else {
                                      setRows(prev => {
                                        const next = [...prev]; next[i] = { ...next[i], initL: 0 }; return next;
                                      });
                                    }
                                  }}
                                >Not Possible</Chip>
                              </div>
                            </div>
                          </td>
                          {/* eslint-disable-next-line no-nested-ternary */}
                          <td className={`p-2 ${selectedBlockId === 'FLIPPER_R' || selectedBlockId === 'FLIPPER_BOTH' || hoverFlipperColumn === 'R' || hoverFlipperColumn === 'BOTH' ? (darkMode ? 'bg-rose-900/30' : 'bg-rose-50') : ''}`}>
                            <div className="flex flex-col gap-1 w-full px-[10px]">
                              {(() => {
                                const range = computeAllowedRange(rows, 'R', i);
                                const rawAllowedMin = range ? range[0] : 5;
                                const rawAllowedMax = range ? range[1] : 100;
                                // Clamp both ends to 95 domain
                                const allowedMin = Math.max(5, Math.min(95, rawAllowedMin));
                                const allowedMax = Math.max(5, Math.min(95, rawAllowedMax));
                                let actual = r.initR && r.initR > 0 ? r.initR : null;
                                if (actual === null) {
                                  // No value set
                                } else {
                                  if (actual > allowedMax) {
                                    actual = allowedMax;
                                  } // clamp legacy 100
                                  if (actual < allowedMin) {
                                    actual = allowedMin;
                                  }
                                }
                                const sliderMin = 5; const sliderMax = 95; // reversed visual
                                const displayVal = actual === null ? 50 : actual;
                                // Descending visual (95 -> 05). Grey left (values > allowedMax after reversal) and right (values < allowedMin).
                                const span = 95 - 5; // 90
                                const leftStopPct = ((95 - allowedMax) / span) * 100;
                                const rightStartPct = ((95 - allowedMin) / span) * 100;
                                const trackBg = range ? `linear-gradient(to right,
                                rgba(55,65,81,0.70) 0%,
                                rgba(55,65,81,0.70) ${leftStopPct}%,
                                rgba(244,63,94,0.35) ${leftStopPct}%,
                                rgba(244,63,94,0.35) ${rightStartPct}%,
                                rgba(55,65,81,0.70) ${rightStartPct}%,
                                rgba(55,65,81,0.70) 100%)` : 'linear-gradient(to right, rgba(55,65,81,0.70), rgba(55,65,81,0.70))';
                                return (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 -mb-1">
                                      <span>95</span><span>05</span>
                                    </div>
                                    <div className="relative">
                                      <input
                                        data-slider
                                        type="range"
                                        min={sliderMin}
                                        max={sliderMax}
                                        step={5}
                                        value={Math.min(Math.max(100 - (actual === null ? displayVal : actual), sliderMin), sliderMax)}
                                        onMouseDown={e => {
                                          e.stopPropagation();
                                        }}
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                        }}
                                        onDragStart={e => {
                                          e.preventDefault(); e.stopPropagation();
                                        }}
                                        onChange={e => {
                                          const raw = Number(e.target.value);
                                          let newActual = 100 - raw;
                                          if (newActual > allowedMax) {
                                            newActual = allowedMax;
                                          }
                                          if (newActual < allowedMin) {
                                            newActual = allowedMin;
                                          }
                                          setRows(prev => {
                                            const next = [...prev]; next[i] = { ...next[i], initR: newActual }; return next;
                                          });
                                        }}
                                        style={{ background: trackBg }}
                                        className="w-full appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
                                      />
                                      {range && !(allowedMin === 5 && allowedMax === 95) ? (() => {
                                        return (
                                          <>
                                            <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-rose-700" style={{ left: `${leftStopPct}%` }}>{format2(allowedMax)}</div>
                                            <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-rose-700" style={{ left: `${rightStartPct}%` }}>{format2(allowedMin)}</div>
                                          </>
                                        );
                                      })() : null}
                                      {actual !== null && range ? (() => {
                                        const pct = ((95 - actual) / span) * 100;
                                        return (
                                          <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-[-50%] text-[10px] font-medium bg-rose-600 text-white px-2 py-1 rounded-md shadow min-w-[30px] text-center" style={{ left: `${pct}%` }}>{format2(actual)}</div>
                                        );
                                      })() : null}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex flex-col items-center mt-[15px]">
                                <Chip
                                  active={r.initR === 0}
                                  darkMode={darkMode}
                                  onClick={() => {
                                    const range = computeAllowedRange(rows, 'R', i);
                                    if (r.initR === 0) {
                                      if (range) {
                                        const mid = Math.round((range[0] + range[1]) / 2 / 5) * 5;
                                        setRows(prev => {
                                          const next = [...prev]; next[i] = { ...next[i], initR: mid }; return next;
                                        });
                                      }
                                    } else {
                                      setRows(prev => {
                                        const next = [...prev]; next[i] = { ...next[i], initR: 0 }; return next;
                                      });
                                    }
                                  }}
                                >Not Possible</Chip>
                              </div>
                            </div>
                          </td>
                          <td className="p-0.5 text-left align-bottom">
                            <div className="flex flex-col items-end">
                              <button
                                onClick={() => {
                                  setRows(prev => {
                                    const next = prev.filter((_, k) => k !== i);
                                    // Compute new selected index
                                    let newIdx = selectedIdx;
                                    if (selectedIdx === i) {
                                      // Deleted currently selected row: clear selection entirely
                                      newIdx = -1;
                                    } else if (i < selectedIdx) {
                                      // A row above the current selection was removed; shift selection index left
                                      newIdx = Math.max(0, selectedIdx - 1);
                                    }
                                    // Clamp when list becomes empty
                                    if (next.length === 0) {
                                      newIdx = -1;
                                      setSelectedBlockId(null);
                                      setSelectedIdx(-1);
                                      return next;
                                    }
                                    // Apply selection updates referencing the NEW array so ids align
                                    if (newIdx === -1) {
                                      setSelectedIdx(-1);
                                      setSelectedBlockId(null);
                                    } else {
                                      if (newIdx < 0) {
                                        newIdx = 0;
                                      } // safety
                                      if (newIdx >= next.length) {
                                        newIdx = next.length - 1;
                                      }
                                      setSelectedIdx(newIdx);
                                      setSelectedBlockId(next[newIdx]?.id ?? null);
                                    }
                                    return next;
                                  });
                                }}
                                className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 cursor-pointer"
                                title="Remove shot"
                                aria-label="Remove shot"
                              >
                                {/* Circle X delete icon */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M9 9l6 6" />
                                  <path d="M15 9l-6 6" />
                                </svg>
                              </button>
                              {!initialized && (
                                <button
                                  type="button"
                                  aria-label="Drag to reorder"
                                  draggable
                                  onDragStart={(e) => {
                                    if (initialized) {
                                      return;
                                    } setDragRowIdx(i); setDragOverIdx(i); e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragEnd={() => {
                                    setDragRowIdx(null); setDragOverIdx(null);
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100/60 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                  title="Drag to reorder"
                                >
                                  {/* Circular dotted drag handle icon */}
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none" />
                                    <circle cx="15" cy="9" r="0.9" fill="currentColor" stroke="none" />
                                    <circle cx="9" cy="15" r="0.9" fill="currentColor" stroke="none" />
                                    <circle cx="15" cy="15" r="0.9" fill="currentColor" stroke="none" />
                                    <circle cx="9" cy="12" r="0.9" fill="currentColor" stroke="none" />
                                    <circle cx="15" cy="12" r="0.9" fill="currentColor" stroke="none" />
                                  </svg>
                                </button>
                              )}
                              {!initialized && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); setRows(prev => {
                                      const next = [...prev];
                                      const aboveIdx = i; // row above insertion point
                                      const belowIdx = i + 1 < prev.length ? i + 1 : null;
                                      // eslint-disable-next-line sonarjs/cognitive-complexity
                                      const computeInsertValue = (side) => {
                                        if (side === 'L') {
                                          let upIdx = aboveIdx; while (upIdx >= 0 && prev[upIdx].initL <= 0) {
                                            upIdx--;
                                          }
                                          let downIdx = belowIdx; while (downIdx !== null && downIdx < prev.length && prev[downIdx].initL <= 0) {
                                            downIdx++;
                                          }
                                          const haveUpper = upIdx >= 0; const haveLower = downIdx !== null && downIdx < prev.length;
                                          if (!haveUpper && !haveLower) {
                                            return 0;
                                          }
                                          if (haveUpper && !haveLower) {
                                            const aboveVal = prev[upIdx].initL; if (aboveVal <= 0) {
                                              return 0;
                                            } if (aboveVal === 95) {
                                              return 100;
                                            } if (aboveVal === 100) {
                                              return 0;
                                            } const gap = 100 - aboveVal; if (gap <= 5) {
                                              return 0;
                                            } let mid = Math.round(((aboveVal + 100) / 2) / 5) * 5; if (mid <= aboveVal) {
                                              mid = aboveVal + 5;
                                            } if (mid >= 100) {
                                              mid = 95;
                                            } if (mid <= aboveVal || mid >= 100) {
                                              return 0;
                                            } return clamp(mid, 5, 100);
                                          }
                                          if (!haveUpper && haveLower) {
                                            return 0;
                                          } const aboveVal = prev[upIdx].initL; const belowVal = prev[downIdx].initL; const gap = belowVal - aboveVal; if (aboveVal <= 0 && belowVal <= 0 || gap <= 5) {
                                            return 0;
                                          } let mid = Math.round(((aboveVal + belowVal) / 2) / 5) * 5; if (mid <= aboveVal) {
                                            mid = aboveVal + 5;
                                          } if (mid >= belowVal) {
                                            mid = belowVal - 5;
                                          } if (mid <= aboveVal || mid >= belowVal) {
                                            return 0;
                                          } return clamp(mid, 5, 100);
                                        } else {
                                          let upIdx = aboveIdx; while (upIdx >= 0 && prev[upIdx].initR <= 0) {
                                            upIdx--;
                                          } let downIdx = belowIdx; while (downIdx !== null && downIdx < prev.length && prev[downIdx].initR <= 0) {
                                            downIdx++;
                                          } const haveUpper = upIdx >= 0; const haveLower = downIdx !== null && downIdx < prev.length; if (!haveUpper && !haveLower) {
                                            return 0;
                                          } if (haveUpper && !haveLower) {
                                            const aboveVal = prev[upIdx].initR; if (aboveVal <= 0) {
                                              return 0;
                                            } if (aboveVal === 10) {
                                              return 5;
                                            } if (aboveVal === 5) {
                                              return 0;
                                            } const gap = aboveVal - 5; if (gap <= 5) {
                                              return 0;
                                            } let mid = Math.round(((aboveVal + 5) / 2) / 5) * 5; if (mid >= aboveVal) {
                                              mid = aboveVal - 5;
                                            } if (mid <= 5) {
                                              mid = 10;
                                            } if (mid >= aboveVal || mid <= 5) {
                                              return 0;
                                            } return clamp(mid, 5, 100);
                                          } if (!haveUpper && haveLower) {
                                            return 0;
                                          } const aboveVal = prev[upIdx].initR; const belowVal = prev[downIdx].initR; const gap = aboveVal - belowVal; if (aboveVal <= 0 && belowVal <= 0 || gap <= 5) {
                                            return 0;
                                          } let mid = Math.round(((aboveVal + belowVal) / 2) / 5) * 5; if (mid >= aboveVal) {
                                            mid = aboveVal - 5;
                                          } if (mid <= belowVal) {
                                            mid = belowVal + 5;
                                          } if (!(mid < aboveVal && mid > belowVal)) {
                                            return 0;
                                          } return clamp(mid, 5, 100);
                                        }
                                      };
                                      const midL = computeInsertValue('L');
                                      const midR = computeInsertValue('R');
                                      const row = newRow({ initL: midL, initR: midR }, prev.length);
                                      next.splice(i + 1, 0, row);
                                      return next;
                                    });
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 hover:bg-slate-100/60 cursor-copy"
                                  aria-label="Insert shot below"
                                  title="Insert shot below"
                                >
                                  {/* Plus inside circle icon */}
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 8v8" />
                                    <path d="M8 12h8" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* If dragging to end: show marker after last row */}
                        {dragRowIdx !== null && i === rows.length - 1 && dragOverIdx === rows.length && (
                          <tr aria-hidden className="pointer-events-none">
                            <td colSpan={4} className="p-0">
                              <div className="h-2 relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] animate-pulse" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {/* Standalone insertion marker at list end when dragging over empty space below */}
                    {dragRowIdx !== null && dragOverIdx === rows.length && (
                      <tr aria-hidden className="pointer-events-none">
                        <td colSpan={4} className="p-0">
                          <div className="h-2 relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] animate-pulse" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Clear all shots button below table removed; only in-canvas button remains */}
            </Section>
          </>
        )}

        {/* Practice */}
        {initialized && !finalPhase ? <>
          <Section
            title="Practice Shots"
            darkMode={darkMode}
            right={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isStandalone) {
                      downloadStandalone();
                    } else {
                      _pushToast('Download only works in standalone mode');
                    }
                  }}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'} ${isStandalone ? '' : 'opacity-60'}`}
                  title={isStandalone ? 'Download this standalone HTML file' : 'Download (only works in standalone mode)'}
                  aria-label="Download standalone"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-yellow-400 hover:text-yellow-300' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  title="Help & About"
                  aria-label="Help & About"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </button>
                <button
                  onClick={resetAll}
                  className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${darkMode ? BTN_SUCCESS : BTN_SUCCESS}`}
                  title="Return to setup and reset session"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Setup
                </button>
                <button
                  type="button"
                  disabled
                  className={`${BTN_ICON} bg-blue-600 border-2 border-blue-400 font-semibold`}
                  title="Currently on Practice page"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Practice
                </button>
                <button
                  onClick={endSession}
                  className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${darkMode ? BTN_SUCCESS : BTN_SUCCESS}`}
                  title="Go to final recall"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Recall
                </button>
              </div>
            }
          >
            <div className={`grid grid-cols-1 ${showFeedbackPanel ? 'lg:[grid-template-columns:60fr_40fr] lg:items-start' : ''} gap-4`}>
              {/* Left: selection and input */}
              <div className="lg:col-span-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Current Attempt</h3>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-2 text-xs ${GetTextClass(darkMode, 'secondary')}`}>
                      <input
                        type="checkbox"
                        checked={showAttemptHistory}
                        onChange={(e) => setShowAttemptHistory(e.target.checked)}
                        className={GetCheckboxClass(darkMode)}
                      />
                      Attempt history
                    </label>
                    <label className={`flex items-center gap-2 text-xs ${GetTextClass(darkMode, 'secondary')}`}>
                      <input
                        type="checkbox"
                        checked={showFeedbackPanel}
                        onChange={(e) => setShowFeedbackPanel(e.target.checked)}
                        className={GetCheckboxClass(darkMode)}
                      />
                      Feedback
                    </label>
                  </div>
                </div>
                <div className={`border rounded-2xl p-3 mb-4 flex-1 ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                  <div className={`flex items-start gap-3 mb-3 pb-3 border-b-2 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <span className={`w-28 flex-shrink-0 text-sm font-medium mt-1 ${GetTextClass(darkMode, 'secondary')}`}>Mode</span>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Chip active={mode === 'manual'} onClick={() => setMode('manual')} darkMode={darkMode}>Manual</Chip>
                      <div className="flex items-center gap-2">
                        <Chip active={mode === 'random'} onClick={() => setMode('random')} darkMode={darkMode}>Random</Chip>
                        {mode === 'random' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedIdx(pickRandomIdx()); setSelectedSide(seededRandom() < 0.5 ? 'L' : 'R');
                              }}
                              className={`w-8 h-8 rounded-full border flex items-center justify-center text-lg ${darkMode ? 'border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'}`}
                              title="Random new shot & flipper"
                            >↻</button>
                            <label className={`flex items-center gap-2 text-xs ml-2 ${GetTextClass(darkMode, 'secondary')}`}>
                              <input
                                type="checkbox"
                                checked={useSeededRandom}
                                onChange={(e) => setUseSeededRandom(e.target.checked)}
                                className={GetCheckboxClass(darkMode)}
                              />
                              Seeded
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`mb-3 pb-3 border-b-2 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`w-28 flex-shrink-0 text-sm font-medium mt-1 ${GetTextClass(darkMode, 'secondary')}`}>Shot</span>
                      <div className="flex gap-2 flex-wrap">
                        {rows.map((r, i) => (
                          <Chip
                            key={r.id}
                            active={selectedIdx === i}
                            onClick={() => mode === 'manual' ? setSelectedIdx(i) : undefined}
                            disabled={mode === 'random'}
                            darkMode={darkMode}
                          >
                            {r.type}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className={`w-28 flex-shrink-0 text-sm font-medium mt-1 ${GetTextClass(darkMode, 'secondary')}`}>Flipper</span>
                    <div className="flex gap-2">
                      <Chip
                        active={selectedSide === 'L'}
                        onClick={() => mode === 'manual' ? setSelectedSide('L') : undefined}
                        disabled={mode === 'random'}
                        darkMode={darkMode}
                      >Left</Chip>
                      <Chip
                        active={selectedSide === 'R'}
                        onClick={() => mode === 'manual' ? setSelectedSide('R') : undefined}
                        disabled={mode === 'random'}
                        darkMode={darkMode}
                      >Right</Chip>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: feedback and stats (toggleable) */}
              {showFeedbackPanel ? <div className="lg:col-span-1 flex flex-col">
                <h3 className={`font-medium mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Feedback</h3>
                <div className={`border rounded-2xl p-3 flex-1 ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                  <div className="text-sm">
                    {/* eslint-disable-next-line sonarjs/cognitive-complexity */}
                    {(() => {
                      const a = attempts[0];
                      const has = Boolean(a);
                      return (
                        <>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Last shot</div>
                            <div className="font-medium" style={{ color: has ? (SEVERITY_COLORS[a.severity] || (darkMode ? '#cbd5e1' : '#334155')) : undefined }}>
                              {has ? rowDisplayWithSide(rows[a.idx], a.side) : '—'}
                            </div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Result</div>
                            <div className="font-medium capitalize">
                              {has ? (
                                <>
                                  {a.label} <span className={darkMode ? 'text-slate-500' : 'text-slate-500'}>(</span>
                                  <span style={{ color: SEVERITY_COLORS[a.severity] || (darkMode ? '#cbd5e1' : '#334155') }}>{a.severity}</span>{' '}
                                  <span className={darkMode ? 'text-slate-500' : 'text-slate-500'}>{a.delta > 0 ? '+' : ''}{format2(Math.abs(a.delta))}%)</span>
                                </>
                              ) : 'N/A'}
                            </div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Guess</div>
                            <div>{has ? formatPct(a.input) : '—'}</div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Prev guess</div>
                            <div>{(() => {
                              if (!showMentalModel) {
                                return '—';
                              }
                              if (!has || a.prevInput === null) {
                                return '—';
                              }
                              return formatPct(a.prevInput);
                            })()}</div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Guess delta</div>
                            <div>{(() => {
                              if (!has) {
                                return 'N/A';
                              }
                              if (a.prevInput === null) {
                                return 'N/A';
                              }
                              const diff = Math.round((a.input ?? 0) - (a.prevInput ?? 0));
                              return `${diff > 0 ? '+' : ''}${format2(Math.abs(diff))}%`;
                            })()}</div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Adjustment needed</div>
                            <div className="capitalize">{(() => {
                              if (!has) {
                                return 'N/A';
                              }
                              if (!a.adjustRequired) {
                                return 'N/A';
                              }
                              if (a.requiredDir === -1) {
                                return 'Lower';
                              }
                              if (a.requiredDir === 1) {
                                return 'Higher';
                              }
                              return 'None';
                            })()}</div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Adjustment result</div>
                            <div className={(() => {
                              if (!has || !a.adjustRequired) {
                                return 'text-slate-400';
                              }
                              return a.adjustCorrect ? 'text-emerald-600' : 'text-red-600';
                            })()}
                            >
                              {(() => {
                                if (!has) {
                                  return 'N/A';
                                }
                                if (!a.adjustRequired) {
                                  return 'N/A';
                                }
                                return a.adjustCorrect ? 'Correct' : 'Missed';
                              })()}
                            </div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Starting</div>
                            <div>{(() => {
                              if (!showBaseValues) {
                                return '—';
                              }
                              if (!has) {
                                return '—';
                              }
                              return formatPct((a.side === 'L' ? baseL[a.idx] : baseR[a.idx]) ?? 0);
                            })()}</div>
                          </div>
                          <div className="flex justify-between mb-1">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Correct</div>
                            <div>{(() => {
                              if (!showTruth) {
                                return '—';
                              }
                              if (!has) {
                                return '—';
                              }
                              return formatPct(a.truth);
                            })()}</div>
                          </div>
                          <div className="flex justify-between mt-2 pt-2 border-t">
                            <div className={`text-sm font-medium ${GetTextClass(darkMode, 'secondary')}`}>Points</div>
                            <div className="text-right">
                              <div>{has ? `${a.points} pts` : '—'}</div>
                              {has && a.basePoints !== null ? (
                                <div className="text-[11px] text-slate-500">Base {a.basePoints}{a.adjustPenalty ? ` − Adj Penalty ${a.adjustPenalty}` : ''}</div>
                              ) : (
                                <div className="text-[11px] text-slate-400">Awaiting first attempt</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t">
                            <div className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>View Shot Values</div>
                            <div className="flex flex-wrap gap-4 items-center mb-3">
                              <label className={`flex items-center gap-2 text-[11px] ${GetTextClass(darkMode, 'secondary')}`}>
                                <input
                                  type="checkbox"
                                  checked={showBaseValues}
                                  onChange={(e) => setShowBaseValues(e.target.checked)}
                                  className={GetCheckboxClass(darkMode)}
                                />
                                Starting
                              </label>
                              <label className={`flex items-center gap-2 text-[11px] ${GetTextClass(darkMode, 'secondary')}`}>
                                <input
                                  type="checkbox"
                                  checked={showMentalModel}
                                  onChange={(e) => {
                                    const v = e.target.checked; setShowMentalModel(v);
                                  }}
                                  className={GetCheckboxClass(darkMode)}
                                />
                                Guess
                              </label>
                              <label className={`flex items-center gap-2 text-[11px] ${GetTextClass(darkMode, 'secondary')}`}>
                                <input
                                  type="checkbox"
                                  checked={showTruth}
                                  onChange={(e) => setShowTruth(e.target.checked)}
                                  className={GetCheckboxClass(darkMode)}
                                />
                                Correct
                              </label>
                            </div>
                            {(showMentalModel || showBaseValues || showTruth) ? <div>
                              <div className="rounded-xl border overflow-hidden">
                                <table className="w-full text-[11px] md:text-xs">
                                  <thead>
                                    <tr className={darkMode ? 'bg-slate-700 text-slate-300 font-semibold' : 'bg-slate-100 text-slate-700 font-semibold'}>
                                      <th className="p-1.5 text-left" rowSpan="2">Shot</th>
                                      {(() => {
                                        const leftCols = [showMentalModel, showBaseValues, showTruth].filter(Boolean).length;
                                        const rightCols = leftCols; // same columns for right
                                        return (
                                          <>
                                            {leftCols > 0 && <th className={`p-1.5 text-center ${darkMode ? 'border-r border-slate-600' : 'border-r border-slate-300'}`} colSpan={leftCols}>Left Flipper</th>}
                                            {rightCols > 0 && <th className="p-1.5 text-center" colSpan={rightCols}>Right Flipper</th>}
                                          </>
                                        );
                                      })()}
                                    </tr>
                                    <tr className={darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                                      {showBaseValues ? <th className="p-1.5 text-right" title="Starting">Str</th> : null}
                                      {showMentalModel ? <th className="p-1.5 text-right" title="Guess">Gss</th> : null}
                                      {showTruth ? <th className={`p-1.5 text-right ${darkMode ? 'border-r border-slate-600' : 'border-r border-slate-300'}`} title="Correct">Cor</th> : null}
                                      {showBaseValues ? <th className="p-1.5 text-right" title="Starting">Str</th> : null}
                                      {showMentalModel ? <th className="p-1.5 text-right" title="Guess">Gss</th> : null}
                                      {showTruth ? <th className="p-1.5 text-right" title="Correct">Cor</th> : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((r, i) => (
                                      <tr key={r.id} className="border-t">
                                        <td className="p-1.5 whitespace-nowrap max-w-[120px] truncate" title={r.type}>{r.type}</td>
                                        {showBaseValues ? <td className={`p-1.5 text-right ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{formatPct(baseL[i] ?? 0)}</td> : null}
                                        {showMentalModel ? <td className="p-1.5 text-right">{formatPct(mentalL[i] ?? 0)}</td> : null}
                                        {showTruth ? <td className={`p-1.5 text-right ${darkMode ? 'text-slate-400 border-r border-slate-600' : 'text-slate-600 border-r border-slate-300'}`}>{formatPct(hiddenL[i] ?? 0)}</td> : null}
                                        {showBaseValues ? <td className={`p-1.5 text-right ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{formatPct(baseR[i] ?? 0)}</td> : null}
                                        {showMentalModel ? <td className="p-1.5 text-right">{formatPct(mentalR[i] ?? 0)}</td> : null}
                                        {showTruth ? <td className={`p-1.5 text-right ${GetTextClass(darkMode, 'secondary')}`}>{formatPct(hiddenR[i] ?? 0)}</td> : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div> : null}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div> : null}
            </div>

            <div className="mt-6">
              {/* Practice playfield (read-only visual) */}
              <div className="relative">
                {/* Fullscreen toggle button (enter) */}
                {!playfieldFullscreen && (
                  <button
                    type="button"
                    onClick={() => setPlayfieldFullscreen(true)}
                    title="Fullscreen"
                    className={`absolute top-1 right-1 z-40 border shadow px-2 py-1 rounded-md text-xs flex items-center gap-1 ${darkMode ? 'bg-slate-700/90 hover:bg-slate-700 text-slate-200 border-slate-600' : 'bg-white/90 hover:bg-white text-slate-700 border-slate-300'}`}
                  >
                    {/* Enter fullscreen icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M8 8H5V5" /><path d="M16 8h3V5" /><path d="M16 16h3v3" /><path d="M8 16H5v3" /></svg>
                    Fullscreen
                  </button>
                )}
                {/* Metric boxes positioned at bottom corners - responsive sizing */}
                <div className="absolute bottom-2 left-2 z-30 flex gap-1 sm:gap-2 sm:bottom-4 sm:left-4">
                  <div className={`backdrop-blur-sm border rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-lg min-w-[60px] sm:min-w-[72px] flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`}>
                    <div className={`text-[8px] sm:text-[9px] mb-0.5 leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`}>Last attempt</div>
                    <div className={`text-sm sm:text-base font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{attempts[0] ? attempts[0].points : '—'}</div>
                  </div>
                  <div className={`backdrop-blur-sm border rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-lg min-w-[60px] sm:min-w-[72px] flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`}>
                    <div className={`text-[8px] sm:text-[9px] mb-0.5 leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`}>Attempts</div>
                    <div className={`text-sm sm:text-base font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{attemptCount}</div>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 z-30 flex gap-1 sm:gap-2 sm:bottom-4 sm:right-4">
                  <div className={`backdrop-blur-sm border rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-lg min-w-[60px] sm:min-w-[72px] flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`}>
                    <div className={`text-[8px] sm:text-[9px] mb-0.5 leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`}>Total points</div>
                    <div className={`text-sm sm:text-base font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{totalPoints}</div>
                  </div>
                  <div className={`backdrop-blur-sm border rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-lg min-w-[60px] sm:min-w-[72px] flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`}>
                    <div className={`text-[8px] sm:text-[9px] mb-0.5 leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`}>Avg abs error</div>
                    <div className={`text-sm sm:text-base font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{avgAbsErr.toFixed(1)}</div>
                  </div>
                </div>
                <PracticePlayfield rows={rows} selectedIdx={selectedIdx} selectedSide={selectedSide} lastRecall={attempts[0] || null} darkMode={darkMode} />
              </div>
              {/* Quick recall chips (values 05..95) with centered rectangular Not Possible below - responsive sizing */}
              <div className="w-full overflow-x-auto">
                {(() => {
                  const values = Array.from({ length: 19 }, (_, k) => (k + 1) * 5); // 5..95
                  const ordered = selectedSide === 'L' ? values : [...values].reverse();
                  // Responsive font size using clamp for smooth scaling
                  return (
                    <div className="select-none flex flex-col items-stretch min-w-[320px]">
                      <div
                        className="grid w-full gap-[2px]"
                        style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
                      >
                        {ordered.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => submitAttempt(v)}
                            className={`aspect-square rounded-full border shadow active:scale-[0.95] transition-transform flex items-center justify-center font-semibold text-[clamp(10px,2.2vw,24px)] ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            aria-label={`Recall ${format2(v)}`}
                          ><span className="relative" style={{ top: '-1px' }}>{format2(v)}</span></button>
                        ))}
                      </div>
                      <div className="flex justify-center mt-1">
                        <button
                          type="button"
                          onClick={() => submitAttempt(0)}
                          className={`px-2 py-0.5 rounded-xl border shadow active:scale-[0.95] transition-transform font-semibold text-[clamp(10px,2.2vw,24px)] ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                        ><span className="relative" style={{ top: '-1px' }}>Not Possible</span></button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {showAttemptHistory ? <>
                {/* Attempt history below playfield */}
                <h3 className={`font-medium mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>Attempt history</h3>
                <div className="overflow-auto border rounded-2xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={darkMode ? 'bg-slate-700 text-slate-300 font-semibold' : 'bg-slate-100 text-slate-700 font-semibold'}>
                        <th className="p-2 text-left">Time</th>
                        <th className="p-2 text-left">Shot</th>
                        <th className="p-2 text-right">Recall</th>
                        <th className="p-2 text-right">Truth</th>
                        <th className="p-2 text-right">Prev</th>
                        <th className="p-2 text-right">Delta</th>
                        <th className="p-2 text-right">Adj?</th>
                        <th className="p-2 text-right">Dir</th>
                        <th className="p-2 text-right">AdjPen</th>
                        <th className="p-2 text-right">Label</th>
                        <th className="p-2 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map(a => (
                        <tr key={a.t} className="border-t">
                          <td className="p-2">{new Date(a.t).toLocaleTimeString()}</td>
                          <td className="p-2">{rowDisplayWithSide(rows[a.idx], a.side)}</td>
                          <td className="p-2 text-right">{formatPct(a.input)}</td>
                          <td className="p-2 text-right">{formatPct(a.truth)}</td>
                          <td className="p-2 text-right">{a.prevInput === null ? '—' : formatPct(a.prevInput)}</td>
                          <td className="p-2 text-right">{a.delta > 0 ? '+' : ''}{a.delta}</td>
                          <td className="p-2 text-right">{(() => {
                            if (!a.adjustRequired) {
                              return '—';
                            }
                            return a.adjustCorrect ? '✔' : '✖';
                          })()}</td>
                          <td className="p-2 text-right">{(() => {
                            if (!a.adjustRequired) {
                              return '—';
                            }
                            if (a.requiredDir === -1) {
                              return '↓';
                            }
                            if (a.requiredDir === 1) {
                              return '↑';
                            }
                            return '';
                          })()}</td>
                          <td className="p-2 text-right">{a.adjustPenalty ? a.adjustPenalty : 0}</td>
                          <td className="p-2 text-right capitalize">{a.label}</td>
                          <td className="p-2 text-right">{a.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </> : null}
            </div>
          </Section>
          {playfieldFullscreen ? createPortal(
            <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-sm flex flex-col overflow-hidden" style={{ scrollbarGutter: 'auto' }}>
              {(() => {
                // Scale based on both fullscreenScale (height-driven) and windowWidth
                const heightScale = fullscreenScale || 1;
                const widthScale = Math.min(1.5, windowWidth / 800);
                const s = Math.min(heightScale, widthScale);
                const fontSize = Math.round(11 * s); // base 11px scaled
                const padY = 0.9 * s; // base 0.9 (~py-1.5 ≈6px) adjust
                const padX = 1.2 * s; // base horizontal
                const gap = 6 * s; // base gap 6px
                const iconSize = Math.max(14, Math.round(14 * s));
                return (
                  <div className="flex items-center justify-between px-4 py-2 text-slate-200" style={{ fontSize }}>
                    <div className="font-medium" style={{ fontSize: Math.round(fontSize * 1.05) }}>Practice Playfield</div>
                    <div className="flex items-center" style={{ gap }}>
                      <button
                        type="button"
                        onClick={() => setPlayfieldFullscreen(false)}
                        title="Exit fullscreen (Esc)"
                        style={{
                          padding: `${padY}px ${padX * 8}px`,
                          fontSize: fontSize * 0.9,
                          lineHeight: 1.1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: `${Math.round(4 * s)}px`,
                          borderWidth: 1,
                        }}
                        className="rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 border border-white/20 transition-colors"
                      >
                        {/* Standard fullscreen exit: arrows pointing inward */}
                        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
                          <path d="M15 3h4a2 2 0 0 1 2 2v4" />
                          <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
                          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
                          <path d="M10 14v4h4v-4" />
                          <path d="M10 10V6h4v4" />
                        </svg>
                        <span>Exit</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
              {/* Main fullscreen content column. Use overflow-hidden to avoid phantom scrollbar when content fits. */}
              <div className="flex-1 flex flex-col items-stretch overflow-hidden">
                <div className="relative flex-1 flex flex-col min-h-0">
                  {/* Metric boxes positioned at bottom corners - scaled */}
                  {(() => {
                    // Scale based on both fullscreenScale (height-driven) and windowWidth
                    // Base reference: 800px width and scale of 1
                    const heightScale = fullscreenScale || 1;
                    const widthScale = Math.min(1.5, windowWidth / 800); // cap at 1.5 like height
                    const s = Math.min(heightScale, widthScale); // use the smaller of the two
                    const boxSize = Math.round(72 * s); // base 72px (w-18 h-18)
                    const padding = Math.round(8 * s); // base p-2
                    const margin = Math.round(16 * s); // base bottom-4/left-4/right-4
                    const gap = Math.round(8 * s); // base gap-2
                    const labelFont = Math.max(8, Math.round(9 * s)); // base text-[9px]
                    const valueFont = Math.max(12, Math.round(16 * s)); // base text-base (16px)
                    const borderRadius = Math.round(12 * s); // base rounded-xl

                    return (
                      <>
                        <div className="absolute z-30 flex" style={{ bottom: margin, left: margin, gap }}>
                          <div className={`backdrop-blur-sm border shadow-lg flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`} style={{ width: boxSize, height: boxSize, padding, borderRadius }}>
                            <div className={`leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`} style={{ fontSize: labelFont, marginBottom: Math.round(2 * s) }}>Last attempt</div>
                            <div className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontSize: valueFont }}>{attempts[0] ? attempts[0].points : '—'}</div>
                          </div>
                          <div className={`backdrop-blur-sm border shadow-lg flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`} style={{ width: boxSize, height: boxSize, padding, borderRadius }}>
                            <div className={GetTextClass(darkMode, 'secondary')} style={{ fontSize: labelFont, marginBottom: Math.round(2 * s) }}>Attempts</div>
                            <div className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontSize: valueFont }}>{attemptCount}</div>
                          </div>
                        </div>
                        <div className="absolute z-30 flex" style={{ bottom: margin, right: margin, gap }}>
                          <div className={`backdrop-blur-sm border shadow-lg flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`} style={{ width: boxSize, height: boxSize, padding, borderRadius }}>
                            <div className={`leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`} style={{ fontSize: labelFont, marginBottom: Math.round(2 * s) }}>Total points</div>
                            <div className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontSize: valueFont }}>{totalPoints}</div>
                          </div>
                          <div className={`backdrop-blur-sm border shadow-lg flex flex-col items-center justify-center ${GetMetricBoxClass(darkMode)}`} style={{ width: boxSize, height: boxSize, padding, borderRadius }}>
                            <div className={`leading-tight text-center ${GetTextClass(darkMode, 'secondary')}`} style={{ fontSize: labelFont, marginBottom: Math.round(2 * s) }}>Avg abs error</div>
                            <div className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontSize: valueFont }}>{avgAbsErr.toFixed(1)}</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <PracticePlayfield fullscreen rows={rows} selectedIdx={selectedIdx} selectedSide={selectedSide} lastRecall={attempts[0] || null} onScale={s => setFullscreenScale(s)} darkMode={darkMode} />
                </div>
                <div className="w-full px-4">
                  {/* Quick recall chips duplicated for fullscreen (non-stretch circular layout) */}
                  {(() => {
                    // 19 numeric chips (5..95) + 1 Not Possible = 20 circles that must always fit single row.
                    // Strategy:
                    // 1. Measure available container width (window.innerWidth minus side padding ~32px).
                    // 2. Solve for diameter d and gap g such that 20*d + 19*g = availableWidth.
                    //    Constrain g within [minGap,maxGap]; if d exceeds maxDiameter clamp; if below minDiameter clamp and recompute gap (may cause negative -> then reduce diameter further).
                    // Simplify: choose a target gap proportionally (baseGap=12) scaled by fullscreenScale then adjust to fill leftover exactly.
                    const values = Array.from({ length: 19 }, (_, k) => (k + 1) * 5); // 5..95
                    const ordered = selectedSide === 'L' ? values : [...values].reverse();
                    const totalChips = 19; // numeric chips only (NP below)
                    // Use tracked windowWidth state for responsive sizing
                    // Account for padding (px-4 = 32px) plus extra buffer for potential scrollbar space
                    const horizontalPadding = 48; // 16 left + 16 right + 16 buffer for scrollbar reservation
                    const avail = Math.max(300, windowWidth - horizontalPadding); // safeguard
                    // Increase overall size (~25%) and tighten spacing.
                    const maxDiameter = 112; // was 90
                    const minDiameter = 26;
                    const baseGap = 3 * fullscreenScale; // target very tight spacing (~2-3px final)
                    // First pass assume gap = baseGap => candidate diameter
                    let gap = baseGap;
                    let d = (avail - (totalChips - 1) * gap) / totalChips;
                    if (d > maxDiameter) {
                      // Grow gap to consume extra space while keeping diameter at cap
                      d = maxDiameter;
                      gap = (avail - totalChips * d) / (totalChips - 1);
                    }
                    if (d < minDiameter) {
                      // Need to shrink gap down to min (2px) and recompute diameter; if still < minDiameter, accept smaller diameter
                      gap = 4; // minimal aesthetic gap
                      d = (avail - (totalChips - 1) * gap) / totalChips;
                      if (d < 20) {
                        d = 20;
                      } // absolute floor
                    }
                    // Final safety clamp
                    d = Math.max(20, Math.min(maxDiameter, d));
                    // Recompute gap precisely to fill width (avoid leftover). Bound gap min/max after recompute.
                    gap = (avail - totalChips * d) / (totalChips - 1);
                    const minGap = 2, maxGap = 24; // allow tighter minimum
                    if (gap < minGap) {
                      // Reduce diameter slightly so gap hits minGap.
                      const targetD = (avail - (totalChips - 1) * minGap) / totalChips;
                      d = Math.max(20, Math.min(maxDiameter, targetD));
                      gap = minGap;
                    } else if (gap > maxGap) {
                      // Increase diameter so gap hits maxGap.
                      const targetD = (avail - (totalChips - 1) * maxGap) / totalChips;
                      d = Math.max(20, Math.min(maxDiameter, targetD));
                      gap = maxGap;
                    }
                    const diameter = Math.round(d);
                    const chipFont = Math.round(diameter * 0.65); // enlarge ~25% more from 0.52
                    // Container style: use exact width so chips line up flush without overflow/underflow.
                    const containerStyle = { width: avail, margin: '0 auto' };
                    return (
                      <div className="w-full select-none" style={containerStyle}>
                        <div className="flex items-center" style={{ gap: Math.round(gap) }}>
                          {ordered.map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => submitAttempt(v)}
                              className={`rounded-full border shadow active:scale-[0.95] transition-transform flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                              style={{ width: diameter, height: diameter, fontSize: chipFont, lineHeight: 1, fontWeight: 600 }}
                              aria-label={`Recall ${format2(v)}`}
                            ><span className="relative" style={{ top: '-2px' }}>{format2(v)}</span></button>
                          ))}
                        </div>
                        <div className="mt-[2px] flex justify-center">
                          <button
                            type="button"
                            onClick={() => submitAttempt(0)}
                            className={`px-1 rounded-xl border shadow active:scale-[0.97] transition-transform text-sm font-medium ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            style={{ fontSize: Math.max(12, Math.round(chipFont * 0.75)) }}
                          ><span className="relative" style={{ top: '-1px' }}>Not Possible</span></button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body,
          ) : null}
        </> : null}

        {/* Final recall */}
        {initialized && finalPhase ? (
          <Section
            title="Recall Shots"
            darkMode={darkMode}
            right={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isStandalone) {
                      downloadStandalone();
                    } else {
                      _pushToast('Download only works in standalone mode');
                    }
                  }}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'} ${isStandalone ? '' : 'opacity-60'}`}
                  title={isStandalone ? 'Download this standalone HTML file' : 'Download (only works in standalone mode)'}
                  aria-label="Download standalone"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-yellow-400 hover:text-yellow-300' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className={`w-8 h-8 rounded-full border shadow hover:shadow-md transition-all flex items-center justify-center ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  title="Help & About"
                  aria-label="Help & About"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </button>
                <button
                  onClick={resetAll}
                  className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${darkMode ? BTN_SUCCESS : BTN_SUCCESS}`}
                  title="Return to setup and reset session"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Setup
                </button>
                <button
                  onClick={() => setFinalPhase(false)}
                  className={`px-4 py-2 rounded-2xl text-white flex items-center gap-2 ${darkMode ? BTN_SUCCESS : BTN_SUCCESS}`}
                  title="Return to practice session"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Practice
                </button>
                <button
                  type="button"
                  disabled
                  className={`${BTN_ICON} bg-blue-600 border-2 border-blue-400 font-semibold`}
                  title="Currently on Recall page"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Recall
                </button>
              </div>
            }
          >
            <p className="text-sm text-slate-600 mb-4">Enter your best recall for each shot. Higher score means closer to the correct values.</p>
            <div className="overflow-auto border rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className={darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                    <th className="p-2 text-left">Shot</th>
                    <th className="p-2 text-right">Your L</th>
                    <th className="p-2 text-right">Your R</th>
                    <th className="p-2 text-right">Correct L / R</th>
                    <th className="p-2 text-right">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.type}</td>
                      <td className="p-2 text-right">
                        <NumberInput
                          value={finalRecallL[i] ?? 0}
                          onChange={(v) => setFinalRecallL(arr => {
                            const next = [...arr]; next[i] = validatePercent(v) ?? next[i] ?? 0; return next;
                          })}
                          darkMode={darkMode}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <NumberInput
                          value={finalRecallR[i] ?? 0}
                          onChange={(v) => setFinalRecallR(arr => {
                            const next = [...arr]; next[i] = validatePercent(v) ?? next[i] ?? 0; return next;
                          })}
                          darkMode={darkMode}
                        />
                      </td>
                      <td className="p-2 text-right">{formatPct(hiddenL[i] ?? 0)} / {formatPct(hiddenR[i] ?? 0)}</td>
                      <td className="p-2 text-right">{(Math.abs(clamp(finalRecallL[i] ?? 0) - (hiddenL[i] ?? 0)) + Math.abs(clamp(finalRecallR[i] ?? 0) - (hiddenR[i] ?? 0))).toFixed(0)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className={`border rounded-2xl p-3 ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                <div className={GetTextClass(darkMode, 'secondary')}>Final score</div>
                <div className="text-3xl font-semibold">{finalScore}</div>
              </div>
              <div className={`border rounded-2xl p-3 ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                <div className={GetTextClass(darkMode, 'secondary')}>Shots</div>
                <div className="text-3xl font-semibold">{rows.length}</div>
              </div>
              <div className={`border rounded-2xl p-3 ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                <div className={GetTextClass(darkMode, 'secondary')}>Total attempts</div>
                <div className="text-3xl font-semibold">{attemptCount}</div>
              </div>
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
};

export default App;
