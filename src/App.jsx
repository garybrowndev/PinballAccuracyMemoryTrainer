import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from 'react-dom';

// Pinball Accuracy Memory Trainer — single-file React app
// Local, no backend. All data in memory + localStorage.
// Styling: Tailwind utility classes. No external UI libs.

// ---------- helpers ----------
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function snap5(v) { return Math.min(100, Math.max(0, Math.round(v / 5) * 5)); }
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a; // inclusive
// Format percentage values with at least two digits (00, 05, 10, ...) retaining % where appropriate.
const format2 = (n) => {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return String(v).padStart(2, '0');
};
const formatPct = (n) => `${format2(n)}%`;
// Severity color mapping (Perfect, Slight, Fairly, Very)
// Updated per request: perfect bright green, slight darker green, fairly yellow, very bright red
// Chosen accessible hues (WCAG contrast vs white/black text considered). Adjust if future theme changes.
const SEVERITY_COLORS = {
  perfect: '#4ade80',  // lighter/brighter green (emerald-400)
  slight:  '#15803d',  // darker green (emerald-700)
  fairly:  '#f59e0b',  // yellow (amber-500)
  very:    '#dc2626',  // bright red (red-600)
};

// --- Image infrastructure for shot base element tiles ---
// In future you will host JPGs at a backend/static path. For now we attempt to load them optimistically.
// Convention: filename derived from element slug (lowercase, spaces -> dashes): e.g. "Left Ramp" -> "left-ramp.jpg".
// If an image 404s the browser will show the fallback text layer (we keep text absolutely positioned).
// You can later move IMAGE_BASE_URL to an environment variable if desired.
const IMAGE_BASE_URL = '/images/elements'; // adjust when backend path known
function elementSlug(name){ return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

// Stable id generator for rows to prevent input remount/focus loss
let ROW_ID_SEED = 1;
// Square selectable tile for base element selection (replaces textual chips in popup)
function ElementTile({ name, selected, onSelect }) {
  const slug = elementSlug(name);
  const imgSrc = `${IMAGE_BASE_URL}/${slug}.jpg`;
  const [imgVisible, setImgVisible] = React.useState(false); // show only after successful load
  return (
    <button
      type="button"
      onClick={onSelect}
      className={(selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-300 hover:ring-slate-500') + ' relative w-20 h-20 rounded-md overflow-hidden bg-white shadow-sm transition ring-offset-1 focus:outline-none focus:ring-2 focus:ring-slate-900'}
      aria-pressed={selected}
    >
      {/* Centered text shown until image successfully loads (or if missing) */}
      {!imgVisible && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700 p-1 text-center leading-tight select-none">
          {name}
        </div>
      )}
      {/* Render image only once it has loaded to avoid broken icon flash */}
      <img
        src={imgSrc}
        alt={name}
        onLoad={()=> setImgVisible(true)}
        onError={()=> setImgVisible(false)}
        className={(imgVisible ? 'opacity-100' : 'opacity-0') + ' absolute inset-0 w-full h-full object-cover transition-opacity duration-150'}
        draggable={false}
      />
      {/* Bottom overlay label if image present */}
      {imgVisible && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/55 backdrop-blur-[1px] text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center select-none">
          {name}
        </div>
      )}
      {selected && <div className="absolute inset-0 ring-4 ring-offset-2 ring-slate-900 pointer-events-none" />}
    </button>
  );
}

// Inline thumbnail used inside table cell (smaller API: no selection ring offset, but clickable area opens menu / toggles)
function InlineElementThumb({ name, selected, onClick }) {
  const slug = name ? elementSlug(name) : null;
  const imgSrc = slug ? `${IMAGE_BASE_URL}/${slug}.jpg` : null;
  const [imgVisible, setImgVisible] = React.useState(false);
  const size = 80; // same as selection tiles (w-20 h-20)
  // If no name (not selected) just show original placeholder styling handled by parent fallback.
  if (!name) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-shot-chip-thumb
      className={(selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-300 hover:ring-slate-500') + ' relative rounded-md overflow-hidden bg-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-900'}
      style={{ width: size, height: size }}
      aria-pressed={selected}
    >
      {!imgVisible && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700 p-1 text-center leading-tight select-none">
          {name}
        </div>
      )}
      {imgSrc && (
        <img
          src={imgSrc}
          alt={name}
          onLoad={()=> setImgVisible(true)}
          onError={()=> setImgVisible(false)}
          className={(imgVisible ? 'opacity-100' : 'opacity-0') + ' absolute inset-0 w-full h-full object-cover transition-opacity duration-150'}
          draggable={false}
        />
      )}
      {imgVisible && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/55 backdrop-blur-[1px] text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center select-none">
          {name}
        </div>
      )}
    </button>
  );
}
// New taxonomy: separate base element from location. All bases share the same location set.
// Location 'Base' (or null) means unsuffixed (e.g. "Ramp").
// BASE_ELEMENTS ordered (most common -> least common) as of 2025‑09‑26.
// Methodology (lightweight composite prevalence score):
//  1. Core reference: Typical modern (DMD / LCD) layouts from top manufacturers (Stern, Williams/Bally WPC, Jersey Jack) sampled mentally (~40 well-known titles).
//  2. Relative frequency buckets (Very Common, Common, Regular, Occasional, Rare, Novelty) scored 6..1 then sorted.
//  3. Cross-checked against feature descriptions & prevalence implied in Wikipedia "Components" section (Bumpers, Targets, Ramps, Spinners, Holes/Saucers, etc.).
//  4. Combined multi-target groupings: 'Standups' (spot targets) and 'Drops' treated separately due to distinct strategic behavior.
// Notes:
//  - "Orbit" (aka loop around top) appears on nearly every modern game; often two orbits feed lanes/upper area.
//  - "Ramp" shots (wireform or plastic) are central to mode advancement/scoring in most 1986+ titles.
//  - "Spinner" frequently integrated into orbits/lanes; ranked high but below structural shots.
//  - "Standups" (spot targets) near-universal; grouped rather than individual letter targets.
//  - "Drops" widespread but not universal (many games have banks, some have none) -> below standups.
//  - "Bumper" (pop bumper set) nearly universal historically but sometimes reduced/omitted in a few recent designs; placed after major shot geometry elements.
//  - "Lane" refers to in/outlanes or upper lanes; retained though many are implicit rather than discrete selectable shots.
//  - "Scoop" (vertical hole) and "Saucer" (shallow kick-out) both common; scoop slightly edges due to modern rule integration.
//  - Mid-prevalence specialty/mech shots: VUK (Vertical Up Kicker), Captive Ball, Kickback (earned feature), Magnet (playfield control) placed mid/low.
//  - Rarer/mechanical or era-specific: Horseshoe, Rollover (distinct rollover lane target group), Vari Target, Waterfall, Roto Target, Toy (unique mechs), Capture, Deadend, Gate.
//  - "Toy" is conceptually common but each is unique; as a generic category it's lower for selection granularity here.
//  - Ordering trades absolute statistical rigor for practical training relevance: earlier entries likely anchor a player's memory model.
const BASE_ELEMENTS = [
  // Very Common / Core geometry & ubiquitous scoring surfaces
  'Orbit','Ramp','Standups','Lane','Bumper','Spinner',
  // Common but slightly more situational or not on every single game
  'Drops','Scoop','Saucer','VUK','Lock','Captive Ball',
  // Regular specialty / feature mechs & control elements
  'Magnet','Horseshoe','Rollover','Gate',
  // Occasional (era or design style dependent)
  'Vari Target','Deadend','Toy','Roto Target'
];
// Added extended location variants to support richer spatial descriptors in practice:
// Previous: Left, Center, Right. New additions: Bottom, Top, Upper, Lower, Side.
// These simply expand selectable suffixes; no logic elsewhere depends on specific set/order.
const LOCATIONS = ['Left','Right','Center','Side','Top','Upper','Bottom','Lower'];

function buildType(base, location) {
  if (!base) return '';
  // If no location specified, return base unsuffixed
  if (!location) return base;
  // 'Base' sentinel or empty string both mean unsuffixed
  if (location === 'Base') return base;
  return `${location} ${base}`;
}
const FLIPPERS = ['L','R']; // left/right flippers

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
    initL: over.initL != null ? over.initL : 50,
    initR: over.initR != null ? over.initR : 50,
    // Provide a basic fan-out pattern: stagger horizontally & vertically based on index.
    x: 0.2 + ((indexHint % 6) * 0.12), // wraps every 6
    y: 0.15 + Math.floor(indexHint / 6) * 0.18,
    ...over,
  };
};

function rowDisplay(r) { return r ? (r.type || buildType(r.base, r.location)) : ''; }
function rowDisplayWithSide(r, side) { return r ? `${side === 'L' ? 'Left Flipper' : 'Right Flipper'} → ${rowDisplay(r)}` : ''; }


// Compute inclusive min/max positive (>=5) range for slider given ordering constraints (0 neutral/not part of ordering)
// Left flipper: strictly INCREASING top->bottom (low -> high)
// Right flipper: strictly DECREASING top->bottom (high -> low)
function computeAllowedRange(rows, side, index) {
  const vals = side==='L' ? rows.map(r=>r.initL) : rows.map(r=>r.initR);
  const earlierPos = vals.slice(0,index).filter(v=>v!=null && v>0);
  const laterPos = vals.slice(index+1).filter(v=>v!=null && v>0);
  if (side === 'L') {
    let minAllowed = earlierPos.length ? Math.max(...earlierPos) + 5 : 5; // greater than largest earlier
    let maxAllowed = laterPos.length ? Math.min(...laterPos) - 5 : 100;   // less than smallest later
    minAllowed = Math.max(5, minAllowed);
    maxAllowed = Math.min(100, maxAllowed);
    if (minAllowed > maxAllowed) return null;
    return [minAllowed, maxAllowed];
  } else { // Right: descending
    // For descending: value[i] < all earlier positives AND value[i] > all later positives.
    let maxAllowed = earlierPos.length ? Math.min(...earlierPos) - 5 : 100; // smaller than smallest earlier
    let minAllowed = laterPos.length ? Math.max(...laterPos) + 5 : 5;       // greater than largest later
    maxAllowed = Math.min(100, maxAllowed);
    minAllowed = Math.max(5, minAllowed);
    if (minAllowed > maxAllowed) return null;
    return [minAllowed, maxAllowed];
  }
}


// Bounded isotonic regression preserving initial ordering defined by orderAsc.
// Each point i constrained within base[i] ± 20 and 0..100; values snapped to 5.
function isotonicWithBounds(current, base, orderAsc) {
  if (!current.length) return current;
  const lower = base.map(v => Math.max(0, v - 20));
  const upper = base.map(v => Math.min(100, v + 20));
  const inOrderIdx = orderAsc;
  const values = inOrderIdx.map(i => current[i]);
  const lowers = inOrderIdx.map(i => lower[i]);
  const uppers = inOrderIdx.map(i => upper[i]);
  const blocks = [];
  for (let i=0;i<values.length;i++) {
    let sum = values[i];
    let count = 1;
    let lb = lowers[i];
    let ub = uppers[i];
    let mean = sum / count; if (mean < lb) mean = lb; else if (mean > ub) mean = ub;
    let val = snap5(mean);
    blocks.push({sum,count,lb,ub,value:val});
    while (blocks.length >=2 && blocks[blocks.length-2].value > blocks[blocks.length-1].value) {
      const b = blocks.pop();
      const a = blocks.pop();
      const merged = { sum: a.sum + b.sum, count: a.count + b.count, lb: Math.max(a.lb,b.lb), ub: Math.min(a.ub,b.ub), value:0 };
      let m = merged.sum / merged.count; if (m < merged.lb) m = merged.lb; else if (m > merged.ub) m = merged.ub;
      merged.value = snap5(m);
      blocks.push(merged);
    }
  }
  const adjusted = new Array(values.length);
  let k=0; for (const bl of blocks) { for (let j=0;j<bl.count;j++) adjusted[k++] = snap5(Math.min(bl.ub, Math.max(bl.lb, bl.value))); }
  const next = [...current];
  for (let i=0;i<inOrderIdx.length;i++) next[inOrderIdx[i]] = adjusted[i];
  return next;
}

// Ensure strict increasing / decreasing ordering (depending on provided index order) within ±20 bounds and snapping to 5.
function strictlyIncrease(values, base, orderAsc) {
  if (!values.length) return values;
  const idxs = orderAsc;
  const arr = idxs.map(i => values[i]);
  const bases = idxs.map(i => base[i]);
  for (let i=1;i<arr.length;i++) {
    if (arr[i] <= arr[i-1]) {
      const b = bases[i];
      const hi = Math.min(100, b + 20);
      let candidate = snap5(arr[i-1] + 5);
      if (candidate > hi) {
        let j=i-1;
        while (j>=0 && candidate>hi) {
          const bj = bases[j];
            const loPrev = Math.max(0, bj - 20);
            const lowered = snap5(arr[j] - 5);
            if (lowered >= loPrev && (j===0 || lowered > arr[j-1])) { arr[j] = lowered; } else break;
            candidate = snap5(arr[i-1] + 5);
            j--;
        }
        candidate = Math.min(hi, candidate);
      }
      if (candidate <= arr[i-1]) candidate = arr[i-1] + 5;
      arr[i] = candidate;
    }
  }
  const out = [...values];
  for (let k=0;k<idxs.length;k++) out[idxs[k]] = arr[k];
  for (let k=0;k<idxs.length;k++) {
    const i = idxs[k];
    const b = base[i];
    const lo = Math.max(0, b - 20), hi = Math.min(100, b + 20);
    out[i] = snap5(Math.min(hi, Math.max(lo, out[i])));
    if (k>0) {
      const prevIdx = idxs[k-1];
      if (out[i] <= out[prevIdx]) {
        let nv = snap5(out[prevIdx] + 5);
        if (nv > hi) nv = hi;
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
const Section = ({ title, children, right }) => (
  <div className="bg-white/80 rounded-2xl shadow p-4 md:p-6 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
      {right}
    </div>
    {children}
  </div>
);

const NumberInput = React.forwardRef(({ value, onChange, min = 0, max = 100, step = 1, className = "", onKeyDown }, ref) => (
  <input
    ref={ref}
    type="number"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    className={
      "w-24 px-2 py-1 border rounded-xl text-sm focus:outline-none focus:ring " +
      (className || "")
    }
  />
));
NumberInput.displayName = 'NumberInput';

// Simple chip button (auto multi-line for 3+ word shot type labels)
const Chip = ({ active, children, onClick, className = "", disabled = false }) => {
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
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={
        `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors select-none text-center inline-flex items-center justify-center ` +
        (active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300") +
        (disabled ? " opacity-60 cursor-not-allowed" : "") +
        (className ? " " + className : "")
      }
    >
      {content}
    </button>
  );
};

// Simple playfield editor for arranging shots spatially & adjusting flipper percentages
function PlayfieldEditor({ rows, setRows, selectedId, setSelectedId, misorderedIds }) {
  const canvasRef = React.useRef(null);
  // Auto-arrange rows along arc; effect recomputes when rows array changes length or order.
  useEffect(() => {
    if (!rows.length) return;
    const endpointY = 550; const apexY = 100; const chord = 1000; const sagitta = endpointY - apexY; // 450
    const R = (sagitta*sagitta + (chord/2)*(chord/2))/(2*sagitta);
    const centerY = apexY + R; const centerX = 500;
    const vLeft = { x: 0 - centerX, y: endpointY - centerY }; const vRight = { x: 1000 - centerX, y: endpointY - centerY };
    const startAngle = Math.atan2(vLeft.y, vLeft.x); const endAngle = Math.atan2(vRight.y, vRight.x);
    const n = rows.length;
    const fracs = n === 1 ? [0.5] : Array.from({ length: n }, (_, i) => (i + 1) / (n + 1));
    const angleDiff = endAngle - startAngle;
    const newPositions = fracs.map(f => {
      const ang = startAngle + angleDiff * f;
      return { x: (centerX + R * Math.cos(ang)) / 1000, y: (centerY + R * Math.sin(ang)) / 1000 };
    });
    // Only update state if at least one coordinate actually changed; avoids infinite render loop.
    let anyDiff = false;
    for (let i = 0; i < rows.length; i++) {
      const np = newPositions[i];
      const r = rows[i];
      if (r.x !== np.x || r.y !== np.y) { anyDiff = true; break; }
    }
    if (!anyDiff) return; // positions already correct
    setRows(prev => prev.map((r, i) => ({ ...r, x: newPositions[i].x, y: newPositions[i].y })));
  }, [rows, setRows]);

  // Drag removed; no clamping helper needed.

  const handleMouseDown = (e, id) => { setSelectedId(id); };

  // Drag logic removed.

  // Violation highlighting removed earlier; now no ordering enforcement (free horizontal movement).

  return (
    <div className="mt-6">
      <h3 className="font-medium mb-2">Playfield Layout</h3>
      <div className="text-xs text-slate-600 mb-2">Shot positions auto-arranged along arc (updates on add/remove/reorder).</div>
  <div ref={canvasRef} className="relative border rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 h-96 overflow-hidden">
        {/* Underlay playfield primitives (slings, inlanes, outlanes, flippers). Coordinates are proportional to canvas size. */}
  <PlayfieldScenery />
        {/* Precise clickable flipper paths (no visible outline when selected) */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {(() => {
            function flipperPath(base, tip, rBase, tipWidth, roundnessCtrl=0.6) {
              const dx = tip.x - base.x, dy = tip.y - base.y;
              const len = Math.sqrt(dx*dx + dy*dy) || 1;
              const ux = dx / len, uy = dy / len;
              const px = -uy, py = ux;
              const halfTip = tipWidth / 2;
              const tL = { x: tip.x + px*halfTip, y: tip.y + py*halfTip };
              const tR = { x: tip.x - px*halfTip, y: tip.y - py*halfTip };
              const bL = { x: base.x + px*rBase, y: base.y + py*rBase };
              const bR = { x: base.x - px*rBase, y: base.y - py*rBase };
              const ctrlTip = { x: tip.x + ux * (roundnessCtrl*halfTip), y: tip.y + uy * (roundnessCtrl*halfTip) };
              return [
                `M ${bL.x} ${bL.y}`,
                `A ${rBase} ${rBase} 0 1 1 ${bR.x} ${bR.y}`,
                `L ${tR.x} ${tR.y}`,
                `Q ${ctrlTip.x} ${ctrlTip.y} ${tL.x} ${tL.y}`,
                'Z'
              ].join(' ');
            }
            const L_BASE = { x: 285, y: 835 }; const L_TIP = { x: 415, y: 970 };
            const R_BASE = { x: 715, y: 835 }; const R_TIP = { x: 585, y: 970 };
            const rBase = 27.5; const tipWidth = 22;
            const leftD = flipperPath(L_BASE, L_TIP, rBase, tipWidth);
            const rightD = flipperPath(R_BASE, R_TIP, rBase, tipWidth);
            return (
              <g className="cursor-pointer select-none">
                <path
                  d={leftD}
                  fill="transparent"
                  onMouseDown={(e)=>{ e.stopPropagation(); setSelectedId(selectedId==='FLIPPER_L'? null : 'FLIPPER_L'); }}
                  title="Toggle Left flipper shot lines"
                />
                <path
                  d={rightD}
                  fill="transparent"
                  onMouseDown={(e)=>{ e.stopPropagation(); setSelectedId(selectedId==='FLIPPER_R'? null : 'FLIPPER_R'); }}
                  title="Toggle Right flipper shot lines"
                />
              </g>
            );
          })()}
        </svg>
        {rows.map(r=>{
          const sel = r.id === selectedId;
          const misordered = misorderedIds?.has(r.id);
          const hasType = !!r.type;
          const basePart = r.base || '';
          const slug = basePart ? elementSlug(basePart) : null;
          const imgSrc = slug ? `${IMAGE_BASE_URL}/${slug}.jpg` : null;
          const [imgVisible, setImgVisible] = React.useState(false); // per render; lightweight
          // Decide if we try to show image (only when base present)
          const showImageAttempt = !!imgSrc;
          const size = 80; // tile size to match selector
          return (
            <div
              key={r.id}
              style={{ left: `${r.x*100}%`, top:`${r.y*100}%`, transform:'translate(-50%, -50%)', width: size, height: size }}
              onMouseDown={(e)=>handleMouseDown(e,r.id)}
              className={`absolute z-30 select-none rounded-md shadow border overflow-hidden bg-white ${sel?'ring-2 ring-emerald-500':''} ${misordered? 'ring-2 ring-red-500 border-red-500': 'border-slate-300'}`}
            >
              {/* Background image layer */}
              {showImageAttempt && (
                <img
                  src={imgSrc}
                  alt={r.type}
                  onLoad={()=> setImgVisible(true)}
                  onError={()=> setImgVisible(false)}
                  className={(imgVisible ? 'opacity-100' : 'opacity-0') + ' absolute inset-0 w-full h-full object-cover transition-opacity duration-150'}
                  draggable={false}
                />
              )}
              {/* Top overlay with type text when image present */}
              {imgVisible && (
                <div className="absolute top-0 left-0 right-0 bg-black/55 text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center truncate" title={r.type}>{r.type}</div>
              )}
              {/* L/R values overlay moved to bottom */}
              {imgVisible && (
                <div className="absolute left-0 right-0 flex justify-between text-[11px] font-medium text-white drop-shadow pointer-events-none bg-black/35 backdrop-blur-[1px] px-1 py-[1px]" style={{ bottom: '1px' }}>
                  <span>L {r.initL != null ? format2(r.initL) : '—'}</span>
                  <span>R {r.initR != null ? format2(r.initR) : '—'}</span>
                </div>
              )}
              {/* Fallback original content if no image (or no type) */}
              {!imgVisible && (
                <div className="absolute inset-0 flex flex-col p-1 text-[11px]">
                  <div className="font-medium truncate max-w-[70px] text-center mt-4 flex-1 flex items-start justify-center" title={r.type||'Select type'}>{r.type||'— Type —'}</div>
                  <div className="mt-auto flex justify-between text-[11px]">
                    <span className="px-1 rounded bg-slate-100">L {r.initL != null ? format2(r.initL) : '—'}</span>
                    <span className="px-1 rounded bg-slate-100">R {r.initR != null ? format2(r.initR) : '—'}</span>
                  </div>
                </div>
              )}
              <button
                onClick={(e)=>{ e.stopPropagation(); setRows(prev=>prev.filter(x=>x.id!==r.id)); }}
                className="absolute -top-[18px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                title="Delete shot"
              >✕</button>
            </div>
          );
        })}
        {/* Lines visualization: either single-shot selection or flipper-wide selection */}
        {selectedId && (()=>{
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) return null;
          const w = rect.width; const h = rect.height;
          const L_TIP = { x: 415, y: 970 }, L_BASE = { x: 285, y: 835 };
          const R_TIP = { x: 585, y: 970 }, R_BASE = { x: 715, y: 835 };
          // Reuse geometry: compute top edge anchor for percentage along flipper length.
          function flipperTopEdge(base, tip, rBase, tipWidth, percent) {
            const t = Math.min(1, Math.max(0, (percent||0)/100));
            const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const ux = dx / len, uy = dy / len; // along center line
            const px = -uy, py = ux;            // perpendicular
            const cx = base.x + dx * t; const cy = base.y + dy * t; // center line point (1000-space)
            const wBase = rBase*2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width/2;
            const cand1 = { x: cx + px*half, y: cy + py*half };
            const cand2 = { x: cx - px*half, y: cy - py*half };
            const edge = cand1.y < cand2.y ? cand1 : cand2; // choose visually higher (smaller y)
            return edge;
          }
          const rBaseConst = 27.5; const tipWidthConst = 22;
          const Lp = (p)=>{ const e=flipperTopEdge(L_BASE, L_TIP, rBaseConst, tipWidthConst, p); return { x: e.x/1000*w, y: e.y/1000*h }; };
          const Rp = (p)=>{ const e=flipperTopEdge(R_BASE, R_TIP, rBaseConst, tipWidthConst, p); return { x: e.x/1000*w, y: e.y/1000*h }; };
          if (selectedId === 'FLIPPER_L' || selectedId === 'FLIPPER_R') {
            const isLeft = selectedId === 'FLIPPER_L';
            const BOX_HALF = 15;
            return (
              <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
                {rows.map(r=>{
                  const val = isLeft ? r.initL : r.initR;
                  if (val == null || val <= 0) return null;
                  const anchor = isLeft ? Lp(val) : Rp(val);
                  const bx = r.x * w; const by = r.y * h + BOX_HALF;
                  const color = isLeft ? '#0ea5e9' : '#dc2626';
                  const incomplete = !r.type; // no shot type chosen
                  const opacity = incomplete ? 0.3 : 1;
                  const label = format2(val);
                  const fs=11; const padX=5, padY=2; const wTxt=label.length*fs*0.6; const rectW=wTxt+padX*2; const rectH=fs+padY*2; const cx=anchor.x; const cy=anchor.y; // position directly at flipper edge
                  return (
                    <g key={r.id}>
                      <line x1={anchor.x} y1={anchor.y} x2={bx} y2={by} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                      <rect x={cx-rectW/2} y={cy-rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                      <text x={cx} y={cy-rectH/2+fs/2-1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                    </g>
                  );
                })}
              </svg>
            );
          }
          // Otherwise a single shot is selected
          const r = rows.find(x=>x.id===selectedId); if(!r) return null;
          const BOX_HALF = 15;
          const bx = r.x * w; const by = r.y * h + BOX_HALF; // bottom center of box
          const leftAnchor = Lp(r.initL ?? 50);
          const rightAnchor = Rp(r.initR ?? 50);
          return (
            <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
              {(r.initL ?? 0) > 0 && (()=>{
                const label = `${format2(r.initL)}`; const fs=11; const padX=5,padY=2; const wTxt=label.length*fs*0.6; const rectW=wTxt+padX*2; const rectH=fs+padY*2; const cx=leftAnchor.x; const cy=leftAnchor.y; const incomplete=!r.type; const opacity=incomplete?0.3:1; // direct edge
                return (
                  <g>
                    <line x1={leftAnchor.x} y1={leftAnchor.y} x2={bx} y2={by} stroke="#0ea5e9" strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                    <rect x={cx-rectW/2} y={cy-rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                    <text x={cx} y={cy-rectH/2+fs/2-1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                  </g>
                );
              })()}
              {(r.initR ?? 0) > 0 && (()=>{
                const label = `${format2(r.initR)}`; const fs=11; const padX=5,padY=2; const wTxt=label.length*fs*0.6; const rectW=wTxt+padX*2; const rectH=fs+padY*2; const cx=rightAnchor.x; const cy=rightAnchor.y; const incomplete=!r.type; const opacity=incomplete?0.3:1; // direct edge
                return (
                  <g>
                    <line x1={rightAnchor.x} y1={rightAnchor.y} x2={bx} y2={by} stroke="#dc2626" strokeWidth={4} strokeLinecap="round" opacity={opacity} />
                    <rect x={cx-rectW/2} y={cy-rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} opacity={opacity} />
                    <text x={cx} y={cy-rectH/2+fs/2-1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400" opacity={opacity}>{label}</text>
                  </g>
                );
              })()}
            </svg>
          );
        })()}
      </div>
      {/* Footer controls removed: editing now solely via table; additions via + Add shot button above. */}
    </div>
  );
}

function PlayfieldScenery(){
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
          function flipperPath(base, tip, rBase, tipWidth, roundnessCtrl=0.6) {
            const dx = tip.x - base.x, dy = tip.y - base.y;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const ux = dx / len, uy = dy / len;      // unit along length (base -> tip)
            const px = -uy, py = ux;                 // perpendicular (left-hand)
            const halfTip = tipWidth / 2;

            // Narrow tip points
            const tL = { x: tip.x + px*halfTip, y: tip.y + py*halfTip };
            const tR = { x: tip.x - px*halfTip, y: tip.y - py*halfTip };
            // Circle perimeter extreme points along perpendicular axis
            const bL = { x: base.x + px*rBase, y: base.y + py*rBase };
            const bR = { x: base.x - px*rBase, y: base.y - py*rBase };
            // Control point for convex rounding at tip (extend slightly beyond tip in direction of ux,uy)
            const ctrlTip = { x: tip.x + ux * (roundnessCtrl*halfTip), y: tip.y + uy * (roundnessCtrl*halfTip) };

            // Single unified outline path:
            // Start at left circle tangent, sweep large arc around outer side to right tangent, down right edge to tip, rounded tip to left tip edge, back to start.
            // Using large-arc-flag=1 ensures >180° arc giving a smooth outer circular cap without an interior seam.
            return [
              `M ${bL.x} ${bL.y}`,
              `A ${rBase} ${rBase} 0 1 1 ${bR.x} ${bR.y}`,
              `L ${tR.x} ${tR.y}`,
              `Q ${ctrlTip.x} ${ctrlTip.y} ${tL.x} ${tL.y}`,
              'Z'
            ].join(' ');
          }
          const L_BASE = { x: 285, y: 835 }; const L_TIP = { x: 415, y: 970 };
          const R_BASE = { x: 715, y: 835 }; const R_TIP = { x: 585, y: 970 };
          const rBase = 27.5; // full circle radius now at outer/high base side
          const tipWidth = 22; // narrow tip (pivot) width toward center drain
          const leftD = flipperPath(L_BASE, L_TIP, rBase, tipWidth, 0.6);
          const rightD = flipperPath(R_BASE, R_TIP, rBase, tipWidth, 0.6);
          return (
            <g /* Flipper styling: individual stroke colors per flipper */ fill="#ffffff" strokeLinecap="round" strokeLinejoin="round">
              <path d={leftD} stroke="#0ea5e9" strokeWidth={8} />
              <path d={rightD} stroke="#dc2626" strokeWidth={8} />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function PracticePlayfield({ rows, selectedIdx, selectedSide, lastRecall, fullscreen = false, onScale }) {
  const canvasRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(()=>{ setMounted(true); }, []);
  useEffect(()=>{
    if (!fullscreen) return; // only track for fullscreen scaling
    const el = canvasRef.current; if (!el) return;
    // Immediate measurement so first render already scales
    const first = el.getBoundingClientRect();
    setSize({ w: first.width, h: first.height });
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect; setSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return ()=> ro.disconnect();
  }, [fullscreen]);
  const selectedRow = rows[selectedIdx] || null;
  // Default (non-fullscreen) canvas height is h-96 => 384px (24rem at 16px). Typical width in layout around ~800px.
  // Scale shot boxes proportionally relative to BOTH dimensions so they enlarge meaningfully on large screens.
  let scale = 1;
  if (fullscreen && size.w && size.h) {
    const baseH = 384; // baseline small-mode height
    const baseW = 800; // approximate mid-size width used in standard layout
    scale = Math.min(size.h / baseH, size.w / baseW);
    if (scale < 1) scale = 1; // never shrink below normal size
    if (scale > 2.6) scale = 2.6; // prevent comically large boxes
  }
  // Notify parent of scale when in fullscreen so ancillary UI (chips) can track size.
  useEffect(()=>{ if (fullscreen && typeof onScale === 'function') onScale(scale); }, [scale, fullscreen, onScale]);
  return (
    <div className={fullscreen ? 'w-full h-full flex flex-col' : 'mt-8'}>
      {!fullscreen && <h3 className="font-medium mb-2">Playfield</h3>}
  <div ref={canvasRef} className={
        'relative border rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden ' +
        (fullscreen ? 'flex-1 min-h-0' : 'h-96')
      }>
  <PlayfieldScenery />
        {rows.map(r => {
          // Practice playfield: NO L/R values. Show image tile if available (square 80x80), else fallback text box.
          const styleBase = fullscreen ? {
            left: `${r.x*100}%`,
            top: `${r.y*100}%`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          } : {
            left: `${r.x*100}%`,
            top: `${r.y*100}%`,
            transform: 'translate(-50%, -50%)'
          };
          const basePart = r.base || '';
          const slug = basePart ? elementSlug(basePart) : null;
          const imgSrc = slug ? `${IMAGE_BASE_URL}/${slug}.jpg` : null;
          const [imgVisible, setImgVisible] = React.useState(false);
          const showImageAttempt = !!imgSrc;
          const size = 80; // match setup tile size when image
          if (showImageAttempt) {
            return (
              <div
                key={r.id}
                data-shot-box={r.id}
                style={{ ...styleBase, width: size, height: size }}
                className={`absolute z-20 select-none rounded-md shadow border overflow-hidden bg-white border-slate-300 origin-center ${r===selectedRow?'ring-2 ring-emerald-500':''}`}
                title={r.type}
              >
                <img
                  src={imgSrc}
                  alt={r.type}
                  onLoad={()=> setImgVisible(true)}
                  onError={()=> setImgVisible(false)}
                  className={(imgVisible?'opacity-100':'opacity-0')+ ' absolute inset-0 w-full h-full object-cover transition-opacity duration-150'}
                  draggable={false}
                />
                {imgVisible && (
                  <div className="absolute top-0 left-0 right-0 bg-black/55 text-[10px] text-white font-semibold px-1 py-[2px] leading-tight text-center truncate" title={r.type}>{r.type || '—'}</div>
                )}
                {!imgVisible && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium px-1 text-center" title={r.type||'—'}>{r.type||'—'}</div>
                )}
              </div>
            );
          }
          // Fallback standard-size (previously w-24 h-20) text box (keep prior proportions) without L/R
          return (
            <div
              key={r.id}
              data-shot-box={r.id}
              style={styleBase}
              className={`absolute z-20 select-none rounded-lg shadow border bg-white border-slate-300 origin-center w-24 h-20 overflow-hidden ${r===selectedRow?'ring-2 ring-emerald-500':''}`}
              title={r.type}
            >
              <div className="absolute inset-0 flex items-center justify-center px-1 text-center text-[11px] font-medium" title={r.type||'—'}>{r.type||'—'}</div>
            </div>
          );
        })}
  {mounted && selectedRow && selectedSide && (()=>{
          // Draw two guide lines from the shot box to the extremes (0 and 100) of the selected flipper.
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) return null;
          const w = rect.width; const h = rect.height;
          const BOX_HALF = 15 * scale; // approximate half-height scaled
          const bx = selectedRow.x * w; const by = selectedRow.y * h + BOX_HALF; // bottom center of shot box
          // Coordinate anchors (note mapping: 0=base,100=tip in editor, but we now need both extremes).
          const L_TIP = { x: 415, y: 970 }, L_BASE = { x: 285, y: 835 };
          const R_TIP = { x: 585, y: 970 }, R_BASE = { x: 715, y: 835 };
          const Lp = (p)=>({
            x: (L_BASE.x + (L_TIP.x - L_BASE.x)*(p/100))/1000*w,
            y: (L_BASE.y + (L_TIP.y - L_BASE.y)*(p/100))/1000*h
          });
          const Rp = (p)=>({
            x: (R_BASE.x + (R_TIP.x - R_BASE.x)*(p/100))/1000*w,
            y: (R_BASE.y + (R_TIP.y - R_BASE.y)*(p/100))/1000*h
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
                const t = Math.min(1, Math.max(0, percent/100));
                const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.sqrt(dx*dx + dy*dy) || 1;
                const ux = dx / len, uy = dy / len;
                const px = -uy, py = ux;
                const cxLine = base.x + dx * t; const cyLine = base.y + dy * t;
                const wBase = rBase*2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width/2;
                const cand1 = { x: cxLine + px*half, y: cyLine + py*half };
                const cand2 = { x: cxLine - px*half, y: cyLine - py*half };
                return cand1.y < cand2.y ? cand1 : cand2;
              }
              const rawEdge = lastRecall.side === 'L'
                ? flipperTopEdge({ x:285, y:835 }, { x:415, y:970 }, 27.5, 22, lastRecall.input)
                : flipperTopEdge({ x:715, y:835 }, { x:585, y:970 }, 27.5, 22, lastRecall.input);
              const anchor = { x: rawEdge.x/1000*w, y: rawEdge.y/1000*h };
              const label = `${format2(lastRecall.input)}`;
              const textScale = scale;
              // Recall value label sizing (50% larger)
              const baseFs = 11 * 1.5; const rPadXBase = 5; const rPadYBase = 2;
              const fs = baseFs * textScale; const rPadX = rPadXBase * textScale; const rPadY = rPadYBase * textScale;
              const wTxt = label.length * fs * 0.6; const rectW = wTxt + rPadX*2; const rectH = fs + rPadY*2;
              const cx = anchor.x; const cy = anchor.y - 8;
              // Shot box center (percent coords already represent center due to translate(-50%, -50%))
              const boxCX = prevRow.x * w; const boxCY = prevRow.y * h;
              // Measure actual shot box width (after scaling) for proportional offsets
              let boxW = 120;
              const shotEl = canvasRef.current?.querySelector(`[data-shot-box="${prevRow.id}"]`);
              if (shotEl) { try { const br = shotEl.getBoundingClientRect(); if (br?.width) boxW = br.width; } catch {} }
              const boxH = 30; // heuristic height only for vertical anchor reference
              // Direction: Right flipper early-> +x, late-> -x; Left flipper mirrored
              const dirLate = lastRecall.delta > 0 ? 1 : (lastRecall.delta < 0 ? -1 : 0);
              let shiftSign = 0;
              if (dirLate !== 0) {
                if (lastRecall.side === 'R') shiftSign = dirLate === -1 ? 1 : -1; else shiftSign = dirLate === -1 ? -1 : 1;
              }
              // Proportional factor (of half shot box width): perfect 0, slight 0.50, fairly 1.00, very 1.65
              let factor = 0;
              if (lastRecall.severity === 'slight') factor = 0.50;
              else if (lastRecall.severity === 'fairly') factor = 1.00;
              else if (lastRecall.severity === 'very') factor = 1.65;
              const endX = boxCX + shiftSign * (factor * (boxW / 2));
              const endY = boxCY + boxH/2;
              // Feedback text content
              let word1, word2 = null;
              if (lastRecall.severity === 'perfect') {
                word1 = 'Perfect';
              } else {
                const cap = (s)=> s.charAt(0).toUpperCase() + s.slice(1);
                word1 = cap(lastRecall.severity);
                word2 = cap(lastRecall.label);
              }
              // Feedback box sizing
              const tScale = scale; const fontSize = 10 * 1.5 * tScale; const lineGap = 2 * tScale;
              const fbPadX = 6 * tScale; const fbPadY = 4 * tScale;
              const longest = word2 ? Math.max(word1.length, word2.length) : word1.length;
              const approxCharW = fontSize * 0.6;
              const textW = longest * approxCharW;
              const lineCount = word2 ? 2 : 1;
              const lineHeight = fontSize;
              const contentHeight = lineCount === 1 ? lineHeight : (lineHeight*2 + lineGap);
              const boxHeight = contentHeight + fbPadY*2;
              const boxWidth = textW + fbPadX*2;
              const boxCenterX = endX; // center box at computed endX
              const boxX = boxCenterX - boxWidth/2;
              const downwardOffset = 0.80 * boxHeight;
              const boxY = endY + downwardOffset - boxHeight;
              // Update: pill fill now matches severity color; border same color; text remains black for contrast
              lineEl = (
                <g>
                  <line x1={anchor.x} y1={anchor.y} x2={endX} y2={endY} stroke="#eab308" strokeWidth={4 * tScale} strokeLinecap="round" />
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={6 * tScale}
                    ry={6 * tScale}
                    fill={SEVERITY_COLORS[lastRecall.severity] || '#eab308'}
                    stroke={SEVERITY_COLORS[lastRecall.severity] || '#eab308'}
                    strokeWidth={1 * tScale}
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
                    {word2 && <tspan x={boxCenterX} dy={lineGap + lineHeight}>{word2}</tspan>}
                  </text>
                </g>
              );
              recallNode = (
                <g>
                  {lineEl}
                  <rect x={cx - rectW/2} y={cy - rectH} width={rectW} height={rectH} rx={6 * textScale} ry={6 * textScale} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1 * textScale} />
                  {/* Display 'NP' (Not Possible) instead of '00' when the recalled value is 0 */}
                  <text x={cx} y={cy - rectH/2 + fs/2 - 1 * textScale} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400">{label === '00' ? 'NP' : label}</text>
                </g>
              );
            }
          }
          // Split rendering: green guide lines behind (z-0) already fine; yellow feedback & recall node should be ABOVE flippers/boxes.
          // We'll draw green lines first (existing layer), then overlay a second SVG (z-30) for yellow feedback + recall node.
          // Recompute p0/p100 using top-edge anchor logic so green lines terminate on visible flipper edge (not center line)
          function topEdgePoint(side, percent) {
            // Replicate flipperTopEdge from earlier (editor & yellow feedback) for consistency
            function flipperTopEdge(base, tip, rBase, tipWidth, pct) {
              const t = Math.min(1, Math.max(0, pct/100));
              const dx = tip.x - base.x, dy = tip.y - base.y; const len = Math.sqrt(dx*dx + dy*dy) || 1;
              const ux = dx / len, uy = dy / len;
              const px = -uy, py = ux; // perpendicular
              const cx = base.x + dx * t; const cy = base.y + dy * t;
              const wBase = rBase*2; const wTip = tipWidth; const width = wBase + (wTip - wBase) * t; const half = width/2;
              const cand1 = { x: cx + px*half, y: cy + py*half };
              const cand2 = { x: cx - px*half, y: cy - py*half };
              return cand1.y < cand2.y ? cand1 : cand2; // choose visually higher
            }
            const rBaseConst = 27.5; const tipWidthConst = 22;
            if (side === 'L') {
              const edge = flipperTopEdge({ x:285, y:835 }, { x:415, y:970 }, rBaseConst, tipWidthConst, percent);
              return { x: edge.x/1000*w, y: edge.y/1000*h };
            } else {
              const edge = flipperTopEdge({ x:715, y:835 }, { x:585, y:970 }, rBaseConst, tipWidthConst, percent);
              return { x: edge.x/1000*w, y: edge.y/1000*h };
            }
          }
          const p0Top = topEdgePoint(selectedSide, 0);
          const p100Top = topEdgePoint(selectedSide, 100);
          const greenLayer = (
            <svg className="absolute inset-0 pointer-events-none z-0" viewBox={`0 0 ${w} ${h}`}>
              {/* Shaded wedge between anchors and shot box */}
              <polygon
                points={`${p0Top.x},${p0Top.y} ${p100Top.x},${p100Top.y} ${bx},${by}`}
                fill={stroke}
                fillOpacity={0.18}
              />
              <line x1={p0Top.x} y1={p0Top.y} x2={bx} y2={by} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
              <line x1={p100Top.x} y1={p100Top.y} x2={bx} y2={by} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
            </svg>
          );
          const yellowLayer = recallNode && (
            <svg className="absolute inset-0 pointer-events-none z-30" viewBox={`0 0 ${w} ${h}`}>
              {recallNode}
            </svg>
          );
          return <>{greenLayer}{yellowLayer}</>;
        })()}
      </div>
    </div>
  );
}

// ---------- main component ----------
export default function App() {
  const [toasts, setToasts] = useState([]); // {id,msg}
  const _pushToast = useCallback((msg)=>{
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
    setToasts(t=>[...t,{id,msg}]);
    setTimeout(()=> setToasts(t=> t.filter(x=>x.id!==id)), 3200);
  },[]);
  // Setup state
  // Start with no shots by default; user must explicitly add via + Add shot.
  const [rowsRaw, setRowsRaw] = useLocalStorage("pinball_rows_v1", []);
  const rows = rowsRaw; // direct;
  const setRows = (updater) => {
    setRowsRaw(prev => (typeof updater === 'function' ? updater(prev) : updater));
  };
  // Popup menus for new shot/location selector
  const [openShotMenuId, setOpenShotMenuId] = useState(null); // row id currently showing shot list
  const [openLocMenuId, setOpenLocMenuId] = useState(null);  // row id currently showing location list
  const [shotMenuAnchor, setShotMenuAnchor] = useState(null); // {id,x,y}
  const [locMenuAnchor, setLocMenuAnchor] = useState(null);   // {id,x,y}
  // Anchor for multi-add popup when list is empty
  const [addCountAnchor, setAddCountAnchor] = useState(null); // {x,y} or null
  // Keep popup anchored to triggering chip while scrolling/resizing
  useEffect(()=>{
    if (openShotMenuId==null && openLocMenuId==null && !addCountAnchor) return;
    let raf = null;
    const update = ()=>{
      if (raf) return;
      raf = requestAnimationFrame(()=>{
        raf = null;
        if (openShotMenuId!=null) {
          const el = document.querySelector(`[data-shot-chip="${openShotMenuId}"]`);
          if (el) {
            const r = el.getBoundingClientRect();
            setShotMenuAnchor(a=> a && a.id===openShotMenuId ? { ...a, x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 } : a);
          }
        }
        if (openLocMenuId!=null) {
          const el = document.querySelector(`[data-loc-chip="${openLocMenuId}"]`);
          if (el) {
            const r = el.getBoundingClientRect();
            setLocMenuAnchor(a=> a && a.id===openLocMenuId ? { ...a, x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 } : a);
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
    return ()=>{ window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); if(raf) cancelAnimationFrame(raf); };
  }, [openShotMenuId, openLocMenuId, addCountAnchor]);
  // Close menus on outside click
  useEffect(()=>{
    const handler = ()=>{
      // Outside click closes all popups
      setOpenShotMenuId(null); setOpenLocMenuId(null); setShotMenuAnchor(null); setLocMenuAnchor(null); setAddCountAnchor(null);
    };
    window.addEventListener('click', handler);
    return ()=> window.removeEventListener('click', handler);
  },[]);
  const [driftEvery, setDriftEvery] = useLocalStorage("pinball_driftEvery_v1", 5);
  const [driftMag, setDriftMag] = useLocalStorage("pinball_driftMag_v1", 2); // magnitude in 5% steps
  // Initial hidden truth randomization steps (each step = 5 percentage points). Previously fixed at 4 (±20).
  const [initRandSteps, setInitRandSteps] = useLocalStorage("pinball_initRandSteps_v1", 4);

  const [initialized, setInitialized] = useLocalStorage("pinball_initialized_v1", false);
  // Hidden & mental per side
  const [hiddenL, setHiddenL] = useLocalStorage("pinball_hiddenL_v1", []);
  const [hiddenR, setHiddenR] = useLocalStorage("pinball_hiddenR_v1", []);
  // Base (anchor) values captured at session start to constrain hidden truth drift (±20 max, i.e. 4*5 steps)
  const [baseL, setBaseL] = useLocalStorage("pinball_baseL_v1", []);
  const [baseR, setBaseR] = useLocalStorage("pinball_baseR_v1", []);
  const [mentalL, setMentalL] = useLocalStorage("pinball_mentalL_v1", []);
  const [mentalR, setMentalR] = useLocalStorage("pinball_mentalR_v1", []);
  const [orderAscL, setOrderAscL] = useLocalStorage("pinball_initialOrderL_v1", []);
  const [orderAscR, setOrderAscR] = useLocalStorage("pinball_initialOrderR_v1", []);

  const [mode, setMode] = useLocalStorage("pinball_mode_v1", "random"); // 'manual' | 'random'
  const [selectedIdx, setSelectedIdx] = useLocalStorage("pinball_sel_v1", 0);
  const [guess, setGuess] = useLocalStorage("pinball_guess_v1", "");
  const [selectedSide, setSelectedSide] = useLocalStorage("pinball_selSide_v1", 'L');
  const [attempts, setAttempts] = useLocalStorage("pinball_attempts_v1", []);
  const [attemptCount, setAttemptCount] = useLocalStorage("pinball_attemptCount_v1", 0);
  const [showTruth, setShowTruth] = useLocalStorage("pinball_showTruth_v1", false);
  const [finalPhase, setFinalPhase] = useLocalStorage("pinball_finalPhase_v1", false);
  const [finalRecallL, setFinalRecallL] = useLocalStorage("pinball_finalRecallL_v1", []);
  const [finalRecallR, setFinalRecallR] = useLocalStorage("pinball_finalRecallR_v1", []);
  const [showMentalModel, setShowMentalModel] = useLocalStorage("pinball_showMentalModel_v1", false); // visibility toggle
  const [showAttemptHistory, setShowAttemptHistory] = useLocalStorage("pinball_showAttemptHistory_v1", false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useLocalStorage("pinball_showFeedback_v1", false); // new toggle for Feedback table
  // Restore stacks removed (Not Possible is neutral now)
  // UI local (non-persisted) state: collapsed shot type rows (store ids)
  const [collapsedTypes, setCollapsedTypes] = useState([]); // Only shot type collapsing retained; flipper collapsing removed.
  // Playfield editor is always visible now; toggle removed
  // const [showPlayfield, setShowPlayfield] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  // One-time auto-collapse so pre-selected values (from persisted state or defaults) show as single chips, not full option lists on first load.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (didInitCollapse.current) return;
    if (!rows || !rows.length) return; // nothing yet
    // Only initialize if user hasn't interacted (arrays still empty)
  if (collapsedTypes.length) { didInitCollapse.current = true; return; }
    const typeIds = rows.filter(r => !!r.type).map(r => r.id);
  // Flipper collapse removed (left/right arrays no longer tracked)
    if (typeIds.length) setCollapsedTypes(typeIds);
  // (No flipper collapse initialization)
    didInitCollapse.current = true;
  }, [rows, collapsedTypes.length]);

  // Keep selectedIdx within bounds if rows shrink
  useEffect(() => {
    setSelectedIdx((idx) => (idx >= rows.length ? Math.max(0, rows.length - 1) : idx));
    setSelectedSide(s => (s === 'L' || s === 'R') ? s : 'L');
    // No restore stacks to invalidate.
  }, [rows.length, setSelectedIdx, setSelectedSide]);

  // Derived
  const totalPoints = useMemo(
    () => attempts.reduce((sum, a) => sum + a.points, 0),
    [attempts]
  );

  const avgAbsErr = useMemo(() => {
    if (!attempts.length) return 0;
    const m = attempts.reduce((s, a) => s + Math.abs(a.delta), 0) / attempts.length;
    return m;
  }, [attempts]);

  // Session can start only if every row has a shot type (base chosen) and both flipper values
  const canStart = useMemo(() => {
    if (!rows.length) return false;
    return rows.every(r => r.base && r.base.length > 0 && r.initL != null && r.initR != null);
  }, [rows]);

  // Initialize hidden matrix (wrapped so effects & handlers can depend on stable reference)
  const startSession = useCallback(() => {
    if (!rows.length) return;
    // Capture bases directly
    const bL = rows.map(r=>snap5(r.initL));
    const bR = rows.map(r=>snap5(r.initR));
    setBaseL(bL); setBaseR(bR);
    // Determine original ordering by base values
  const ascL = rows.map((r,i)=>({i,v:r.initL})).sort((a,b)=>a.v-b.v).map(x=>x.i);
  const ascR = rows.map((r,i)=>({i,v:r.initR})).sort((a,b)=>a.v-b.v).map(x=>x.i);
    // Candidate random offsets (independent) within allowed band using configurable steps
  const steps = Math.min(4, Math.max(0, Number(initRandSteps) || 0)); // still capped at 4 for initial randomization.
    // Edge case note: if initRandSteps exceeds the eventual drift usableSteps (floor(driftMag)) then
    // the initial hidden offsets may land outside the subsequent drift band, making early large
    // deviations unreachable until drift magnitude increases. For now we allow this (gives a
    // slightly broader initial challenge) but we could alternatively clamp:
    //   steps = Math.min(steps, Math.floor(Number(driftMag)||0));
    // if consistent bands are preferred.
    const candL = bL.map(v => {
      const off = rndInt(-steps, steps) * 5; const lo = Math.max(0, v - 20); const hi = Math.min(100, v + 20); return snap5(Math.min(hi, Math.max(lo, v + off)));
    });
    const candR = bR.map(v => {
      const off = rndInt(-steps, steps) * 5; const lo = Math.max(0, v - 20); const hi = Math.min(100, v + 20); return snap5(Math.min(hi, Math.max(lo, v + off)));
    });
    // Enforce ordering via bounded isotonic regression
  const hiddenInitL = strictlyIncrease(isotonicWithBounds(candL, bL, ascL).map(v=>snap5(v)), bL, ascL);
  const hiddenInitR = strictlyIncrease(isotonicWithBounds(candR, bR, ascR).map(v=>snap5(v)), bR, ascR);
    setHiddenL(hiddenInitL); setHiddenR(hiddenInitR);
    setOrderAscL(ascL); setOrderAscR(ascR);
  setMentalL(rows.map(r=>r.initL));
  setMentalR(rows.map(r=>r.initR));
    setAttempts([]);
    setAttemptCount(0);
    setFinalPhase(false);
  setFinalRecallL(rows.map(r=>r.initL));
  setFinalRecallR(rows.map(r=>r.initR));
    setInitialized(true);
    // Hide mental model by default when a session starts
    setShowMentalModel(false);
    // Pick a random starting shot & flipper for both modes so manual mode doesn't always start at first row
    if (rows.length) {
      const randIdx = rndInt(0, rows.length - 1);
      setSelectedIdx(randIdx);
      setSelectedSide(Math.random() < 0.5 ? 'L' : 'R');
    }
  }, [rows, initRandSteps, setBaseL, setBaseR, setHiddenL, setHiddenR, setOrderAscL, setOrderAscR, setMentalL, setMentalR, setAttempts, setAttemptCount, setFinalPhase, setFinalRecallL, setFinalRecallR, setInitialized, setShowMentalModel, setSelectedIdx, setSelectedSide]);

  // Allow pressing Enter anywhere on setup screen to start the session (if valid)
  useEffect(() => {
    if (initialized) return; // only before session starts
    function handleKey(e) {
      if (e.key === 'Enter' && !initialized && canStart) {
        if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        startSession();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [initialized, canStart, startSession]);

  // Apply drift every N attempts
  useEffect(() => {
    if (!initialized) return;
    if (attemptCount === 0) return;
    if (driftEvery <= 0) return;
    if (attemptCount % driftEvery !== 0) return;
  // Drift logic:
  // New rule: The drift band around each base value is dynamic: ± (driftMag * 5) percentage points.
  // We still preserve ordering via isotonic regression after applying random steps.
  // driftMag itself can be fractional (step input 0.5); we interpret usable integer steps as floor(driftMag),
  // which determines both the maximum random step distance and the per-attempt clamp band.
  const driftMagNum = Number(driftMag);
  const usableSteps = Math.max(0, Math.min(4, Math.floor(Number.isFinite(driftMagNum) ? driftMagNum : 0))); // retain legacy overall hard ceiling of 4 steps (±20)
  const stepDrift = () => {
    if (usableSteps === 0) return 0;
    const k = rndInt(0, usableSteps);
    const dir = Math.random() < 0.5 ? -1 : 1;
    return dir * k * 5;
  };

    setHiddenL(prev => {
      if (!prev.length || !baseL.length) return prev;
      const drifted = prev.map((v,i) => {
        const b = baseL[i];
        const lo = Math.max(0, b - usableSteps * 5);
        const hi = Math.min(100, b + usableSteps * 5);
        const candidate = snap5(v + stepDrift());
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseL, orderAscL);
      return strictlyIncrease(ordered, baseL, orderAscL);
    });
    setHiddenR(prev => {
      if (!prev.length || !baseR.length) return prev;
      const drifted = prev.map((v,i) => {
        const b = baseR[i];
        const lo = Math.max(0, b - usableSteps * 5);
        const hi = Math.min(100, b + usableSteps * 5);
        const candidate = snap5(v + stepDrift());
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseR, orderAscR);
      return strictlyIncrease(ordered, baseR, orderAscR);
    });
  }, [attemptCount, driftEvery, driftMag, orderAscL, orderAscR, initialized, baseL, baseR, setHiddenL, setHiddenR]);

  function validatePercent(numLike) {
    const x = Number(numLike);
    if (!Number.isFinite(x)) return null;
    return snap5(Math.max(0, Math.min(100, x)));
  }

  function pickRandomIdx() {
    if (!rows.length) return 0;
    if (rows.length === 1) return 0;
    let idx = rndInt(0, rows.length - 1);
    // avoid immediate repeats
    let tries = 0;
    while (idx === selectedIdx && tries < 5) {
      idx = rndInt(0, rows.length - 1);
      tries++;
    }
    return idx;
  }

  function submitAttempt(overrideVal) {
    if (!initialized) return;
    const idx = mode === "random" ? selectedIdx : selectedIdx;
    const usingOverride = overrideVal != null;
    const val = validatePercent(usingOverride ? overrideVal : guess);
    if (!usingOverride && (guess === "" || val === null)) {
      setRecallError("0–100 (0 - Not Possible)");
      setTimeout(()=>{ recallInputRef.current?.focus(); recallInputRef.current?.select(); },0);
      return;
    }
    if (usingOverride && val == null) return; // ignore invalid override silently
    setRecallError("");
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
        label = "perfect";
      } else {
        label = delta < 0 ? "early" : "late";
      }
      let severity;
      if (abs === 0) severity = "perfect";
      else if (abs === 5) severity = "slight";
      else if (abs === 10) severity = "fairly";
      else severity = "very"; // abs >= 15
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
  if (prevDelta > 0) { adjustRequired = true; requiredDir = -1; }
  else if (prevDelta < 0) { adjustRequired = true; requiredDir = 1; }
        if (adjustRequired) {
          if (requiredDir === -1 && !(val < prevSame.input)) adjustCorrect = false;
          if (requiredDir === 1 && !(val > prevSame.input)) adjustCorrect = false;
        }
      }
      // Adjustment penalty only if required and incorrect. Penalty magnitude scaled by how strongly you went the wrong way or failed to move.
      let adjustPenalty = 0;
      if (adjustRequired && !adjustCorrect && prevInput != null) {
        const diff = Math.abs(val - prevInput); // wrong direction or zero movement
        // 5 points base penalty + 1 per 5% of (wrong or zero) adjustment up to 25
        adjustPenalty = Math.min(25, 5 + Math.round(diff / 5));
      }
      const points = Math.max(0, basePoints - adjustPenalty);
      const rec = { t: Date.now(), idx, side: selectedSide, input: val, truth, delta, label, severity, points, basePoints, prevInput, adjustRequired, requiredDir, adjustCorrect, adjustPenalty };
      setAttempts((a) => [rec, ...a].slice(0, 200));
      setAttemptCount((c) => c + 1);
      // Update mental model toward the input guess (still adjusts background model)
      if (selectedSide === 'L') {
        setMentalL(m => { const n=[...m]; n[idx]=val; return n; });
      } else {
        setMentalR(m => { const n=[...m]; n[idx]=val; return n; });
      }

    // Prepare next random shot and flipper if in random mode
    if (mode === "random") {
      setSelectedIdx(pickRandomIdx());
      setSelectedSide(Math.random() < 0.5 ? 'L' : 'R');
    }

    // Clear guess so input resets for next attempt
    setGuess("");
    setRecallError("");
  }

  function endSession() {
    setFinalPhase(true);
  }

  function resetAll() {
    setInitialized(false);
    setHiddenL([]); setHiddenR([]);
    setMentalL([]); setMentalR([]);
    setAttempts([]);
    setAttemptCount(0);
    setFinalPhase(false);
    setFinalRecallL([]); setFinalRecallR([]);
    setShowTruth(false);
    // Clear any stale selection so overlay lines don't render before canvas measures
    setSelectedBlockId(null);
  }

  // Final grading
  const finalScore = useMemo(() => {
    if (!finalPhase || !rows.length || !hiddenL.length || !hiddenR.length || !finalRecallL.length || !finalRecallR.length) return 0;
    let total = 0; let count = 0;
    for (let i=0;i<rows.length;i++) {
      const tL = hiddenL[i] ?? 0; const tR = hiddenR[i] ?? 0;
      const gL = clamp(finalRecallL[i] ?? 0); const gR = clamp(finalRecallR[i] ?? 0);
      total += Math.abs(gL - tL); count++;
      total += Math.abs(gR - tR); count++;
    }
    if (!count) return 0;
    const mae = total / count;
    return Math.max(0, Math.round(100 - mae));
  }, [finalPhase, rows, hiddenL, hiddenR, finalRecallL, finalRecallR]);

  // One-time snapping of any legacy non-5 values after load
  useEffect(() => {
    setRows(prev => prev.map(r => ({
      ...r,
      initL: r.initL == null ? null : snap5(r.initL),
      initR: r.initR == null ? null : snap5(r.initR)
    })));
    setMentalL(m => m.map(v=>snap5(v ?? 0)));
    setMentalR(m => m.map(v=>snap5(v ?? 0)));
    setHiddenL(h => h.map(v=>snap5(v ?? 0)));
    setHiddenR(h => h.map(v=>snap5(v ?? 0)));
    setFinalRecallL(r => r.map(v=>snap5(v ?? 0)));
    setFinalRecallR(r => r.map(v=>snap5(v ?? 0)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Section & NumberInput hoisted above)
  // --- Reordering helpers (only active pre-session) ---
  const [dragRowIdx, setDragRowIdx] = useState(null);
  function normalizeRowPercents(rowsArr) {
    // Left side normalization: non-decreasing; zeros allowed until first positive; after first positive, strictly increasing (>= +5); no zeros allowed below first positive.
    let lastNonZero = 0;
    const out = rowsArr.map(r => ({...r}));
    for (let i=0;i<out.length;i++) {
      let raw = out[i].initL;
      if (raw == null) continue; // leave nulls untouched
      let v = snap5(raw);
      if (v < 0) v = 0;
      if (lastNonZero === 0) {
        // zeros allowed; any positive establishes lastNonZero
      } else {
        if (v === 0 || v <= lastNonZero) v = Math.min(100, lastNonZero + 5);
      }
      out[i].initL = v;
      if (v > 0) lastNonZero = v;
    }
    // Right side normalization: strictly decreasing top -> bottom.
    let prevR = 105; // greater than max
    for (let i=0;i<out.length;i++) {
      let raw = out[i].initR;
      if (raw == null) continue; // leave nulls untouched
      let v = snap5(raw);
      if (v >= prevR) v = prevR - 5;
      if (v < 0) v = 0;
      out[i].initR = v;
      prevR = v;
    }
    return out;
  }
  function handleRowReorder(fromIdx, toIdx) {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) { setDragRowIdx(null); return; }
    setRows(prev => {
      // Helper: align current spatial left->right order to current top->bottom order if out of sync.
      function alignPositions(list) {
        const sortedPositions = [...list].sort((a,b)=>a.x-b.x).map(r=>({x:r.x,y:r.y}));
        return list.map((r,i)=> ({...r, x: sortedPositions[i].x, y: sortedPositions[i].y }));
      }
      // Start from a deep-ish copy (shallow objects cloned so we can mutate x,y safely)
      let arr = prev.map(r=>({...r}));
      // Pre-align if previous operations left them mismatched.
      const misaligned = (()=>{
        const orderByX = [...arr].sort((a,b)=>a.x-b.x);
        for (let i=0;i<arr.length;i++) if (orderByX[i].id !== arr[i].id) return true;
        return false;
      })();
      if (misaligned) arr = alignPositions(arr);
      // Perform adjacent swaps to move fromIdx to toIdx while swapping spatial coordinates with each neighbor.
      if (fromIdx < toIdx) {
        for (let i = fromIdx; i < toIdx; i++) {
          const a = arr[i];
          const b = arr[i+1];
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
          arr[i] = b; arr[i+1] = a;
        }
      } else if (fromIdx > toIdx) {
        for (let i = fromIdx; i > toIdx; i--) {
          const a = arr[i];
          const b = arr[i-1];
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
          arr[i] = b; arr[i-1] = a;
        }
      }
      // Final guarantee: enforce left->right strictly increasing relative order to index sequence (minimal reassignment if needed)
      const outOfOrder = arr.some((r,i)=> i>0 && arr[i-1].x > r.x);
      if (outOfOrder) arr = alignPositions(arr);
      // Normalize percentage constraints after reorder.
      return normalizeRowPercents(arr);
    });
    setDragRowIdx(null);
  }
  // Compute dynamic insertion indicator index while dragging (target index under cursor)
  const [dragOverIdx, setDragOverIdx] = useState(null);
  // Recall input ref for auto-focus
  const recallInputRef = useRef(null);
  // Validation error message for recall input
  const [recallError, setRecallError] = useState("");
  // Fullscreen playfield state
  const [playfieldFullscreen, setPlayfieldFullscreen] = useState(false);
  const [fullscreenScale, setFullscreenScale] = useState(1); // current scale reported by fullscreen playfield
  // Prevent body/document scrolling when fullscreen overlay is active (removes stray window scrollbar)
  useEffect(() => {
    if (!playfieldFullscreen) return; // only lock when entering fullscreen
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [playfieldFullscreen]);
  // Allow pressing Escape to exit fullscreen (mirrors clicking Exit button)
  useEffect(() => {
    if (!playfieldFullscreen) return;
    function handleEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPlayfieldFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [playfieldFullscreen]);
  // Focus recall input when session starts (initialized true and not final phase)
  useEffect(()=>{
    if (initialized && !finalPhase) {
      // small timeout ensures element mounted after conditional render
      setTimeout(()=>{ recallInputRef.current?.focus(); recallInputRef.current?.select(); }, 0);
    }
  }, [initialized, finalPhase]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
    {/* Toast notifications */}
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t=> (
        <div key={t.id} className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-fadein">
          {t.msg}
        </div>
      ))}
    </div>
    {/* Detached popups (portals) for shot & location selection */}
    {shotMenuAnchor && openShotMenuId!=null && createPortal(
      <div
        className="absolute z-50 w-[360px] rounded-xl border bg-white shadow-xl p-3 grid grid-cols-4 gap-3"
        style={{ left: Math.max(8, shotMenuAnchor.x) + 'px', top: shotMenuAnchor.y + 'px' }}
        onClick={e=> e.stopPropagation()}
      >
        {BASE_ELEMENTS.map(b => {
          const isSel = rows.find(r=>r.id===shotMenuAnchor.id)?.base===b;
          return (
            <ElementTile
              key={b}
              name={b}
              selected={isSel}
              onSelect={()=>{
                setRows(prev=>{ const next=[...prev]; const idx = prev.findIndex(r=>r.id===shotMenuAnchor.id); if(idx>-1){ next[idx]={...next[idx], base:b, location:'', type: buildType(b,'')}; } return next; });
                setOpenShotMenuId(null); setShotMenuAnchor(null);
              }}
            />
          );
        })}
        <div className="col-span-4 -mb-1 text-[10px] text-slate-400 text-center">Select shot element</div>
      </div>,
      document.body
    )}
    {locMenuAnchor && openLocMenuId!=null && createPortal(
      <div
        className="absolute z-50 w-48 rounded-xl border bg-white shadow-xl p-2 grid grid-cols-2 gap-2"
        style={{ left: Math.max(8, locMenuAnchor.x) + 'px', top: locMenuAnchor.y + 'px' }}
        onClick={e=> e.stopPropagation()}
      >
        {LOCATIONS.map(loc => (
          <button
            key={loc}
            type="button"
            onClick={()=>{ setRows(prev=>{ const next=[...prev]; const idx = prev.findIndex(r=>r.id===locMenuAnchor.id); if(idx>-1){ const base = next[idx].base||''; next[idx]={...next[idx], location:loc, type: buildType(base,loc)}; } return next; }); setOpenLocMenuId(null); setLocMenuAnchor(null); }}
            className={(rows.find(r=>r.id===locMenuAnchor.id)?.location===loc?'bg-slate-900 text-white':'bg-slate-100 hover:bg-slate-200 text-slate-700') + ' text-[11px] px-2 py-1 rounded-md text-left'}
          >{loc}</button>
        ))}
        <div className="col-span-2 mt-1 text-[10px] text-slate-400 text-center">Select location (optional)</div>
      </div>,
      document.body
    )}
    {addCountAnchor && rows.length===0 && createPortal(
      <div
        className="absolute z-50 w-44 rounded-xl border bg-white shadow-xl p-2 grid grid-cols-4 gap-1"
        style={{ left: Math.max(8, addCountAnchor.x) + 'px', top: addCountAnchor.y + 'px' }}
        onClick={e=> e.stopPropagation()}
      >
        {Array.from({length:20},(_,k)=>k+1).map(n => (
          <button
            key={n}
            type="button"
            className="text-[11px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            onClick={()=>{
              const count = n;
              const buildRows = (cnt)=>{
                const asc = Array.from({length:cnt},(_,i)=> snap5(((i+1)/(cnt+1))*100));
                for (let i=1;i<asc.length;i++) if (asc[i] <= asc[i-1]) asc[i] = Math.min(100, asc[i-1]+5);
                for (let i=asc.length-2;i>=0;i--) if (asc[i] >= asc[i+1]) asc[i] = Math.max(5, asc[i+1]-5);
                const desc = [...asc].reverse();
                return asc.map((v,i)=> newRow({ initL: v, initR: desc[i] }, i));
              };
              setRows(buildRows(count));
              setAddCountAnchor(null);
            }}
          >{n}</button>
        ))}
        <div className="col-span-4 mt-1 text-[10px] text-slate-400 text-center">How many shots?</div>
      </div>,
      document.body
    )}
  <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Setup */}
        {!initialized && (
          <>
            {/* Compute misordered shot IDs: any row whose sequence index differs from its rank in ascending x coordinate. */}
            {(() => {
              // Precompute once per render; inexpensive for small row counts.
            })()}
            <Section
              title="1) Define shots and initial guessed percentages"
            >
              <div className="mb-4 text-xs text-slate-600">Spatial arrangement helps visualize logical ordering. Misordered shots (array order vs left→right) are highlighted in red.</div>
              {(() => {
                const misorderedIds = (() => {
                  if (!rows.length) return new Set();
                  const byX = [...rows].sort((a,b)=>a.x-b.x).map(r=>r.id);
                  const mis = new Set();
                  for (let i=0;i<rows.length;i++) if (rows[i].id !== byX[i]) mis.add(rows[i].id);
                  return mis;
                })();
                return <PlayfieldEditor rows={rows} setRows={setRows} selectedId={selectedBlockId} setSelectedId={setSelectedBlockId} misorderedIds={misorderedIds} />;
              })()}
              <div className="overflow-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-46-/100" />
                    <col className="w-28/100" />
                    <col className="w-28/100" />
                    <col className="w-[40px]" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-slate-500 align-bottom">
                      <th className="p-2">
                        <div className="flex items-center gap-2">
                          <span>Shot Type</span>
                          {!!rows.length && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => prev.map(rw => ({ ...rw, base:'', location:'', type:'', initL: rw.initL, initR: rw.initR })));
                                setCollapsedTypes([]);
                              }}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-600"
                              title="Clear all shot type selections"
                            >Clear</button>
                          )}
                        </div>
                      </th>
                      <th className="p-2">
                        <div className="flex items-center gap-2">
                          <span>Left Flipper</span>
                          {!!rows.length && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => {
                                  const n = prev.length;
                                  if (!n) return prev;
                                  // Interior partition (i+1)/(n+1)*100 snapped to 5 yields centered spread; we now keep ascending directly.
                                  let asc = Array.from({length:n}, (_,i)=> snap5(((i+1)/(n+1))*100));
                                  // Ensure strict ascending (dedupe by bumping forward)
                                  for (let k=1;k<asc.length;k++) if (asc[k] <= asc[k-1]) asc[k] = Math.min(100, asc[k-1] + 5);
                                  // Clamp top if overflowed due to bumps - back-propagate if needed
                                  for (let k=asc.length-2;k>=0;k--) if (asc[k] >= asc[k+1]) asc[k] = Math.max(5, asc[k+1]-5);
                                  return prev.map((rw, idx)=> ({ ...rw, initL: asc[idx] }));
                                });
                              }}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-600"
                              title="Auto-fill evenly spaced ascending values starting near center for left flipper"
                            >Reset</button>
                          )}
                        </div>
                      </th>
                      <th className="p-2">
                        <div className="flex items-center gap-2">
                          <span>Right Flipper</span>
                          {!!rows.length && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows(prev => {
                                  const n = prev.length; if (!n) return prev;
                                  // Generate ascending interior partition then reverse for descending constraint (high -> low)
                                  let asc = Array.from({length:n}, (_,i)=> snap5(((i+1)/(n+1))*100));
                                  for (let k=1;k<asc.length;k++) if (asc[k] <= asc[k-1]) asc[k] = Math.min(100, asc[k-1] + 5);
                                  for (let k=asc.length-2;k>=0;k--) if (asc[k] >= asc[k+1]) asc[k] = Math.max(5, asc[k+1]-5);
                                  const desc = [...asc].reverse();
                                  return prev.map((rw, idx)=> ({ ...rw, initR: desc[idx] }));
                                });
                              }}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-600"
                              title="Auto-fill evenly spaced descending values (high→low) for right flipper"
                            >Reset</button>
                          )}
                        </div>
                      </th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm text-slate-600">
                          <button
                            type="button"
                            data-add-multi
                            onClick={(e)=>{
                              e.stopPropagation();
                              if (addCountAnchor) { setAddCountAnchor(null); return; }
                              const r = e.currentTarget.getBoundingClientRect();
                              setAddCountAnchor({ x: r.left + window.scrollX, y: r.bottom + window.scrollY + 4 });
                            }}
                            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800"
                          >+ Add Shot(s)</button>
                        </td>
                      </tr>
                    )}
                    {rows.map((r, i) => (
                      <React.Fragment key={r.id}>
                        {/* Insertion marker BEFORE row i (visible when dragging and target is i) */}
                        {dragRowIdx != null && dragOverIdx === i && (
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
                          className={`border-t align-top ${dragRowIdx===i ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}`}
                          onDragOver={(e)=>{ if(initialized) return; e.preventDefault(); setDragOverIdx(i); }}
                          onDrop={(e)=>{ if(initialized) return; e.preventDefault(); handleRowReorder(dragRowIdx, i); setDragOverIdx(null); }}
                        >
                        <td className="pt-2 pr-2 pl-2 pb-2 align-top relative">
                          {(() => {
                            const base = r.base || '';
                            const location = r.location || '';
                            const shotMenuOpen = openShotMenuId === r.id;
                            const locMenuOpen = openLocMenuId === r.id;
                            const closeMenus = () => { setOpenShotMenuId(null); setOpenLocMenuId(null); setShotMenuAnchor(null); setLocMenuAnchor(null); };
                            return (
                              <div className="flex items-center gap-2 relative">
                                {base ? (
                                  <InlineElementThumb
                                    name={base}
                                    selected={true}
                                    onClick={(e)=>{
                                      e.stopPropagation();
                                      // Clicking when selected toggles off (previous behavior)
                                      setRows(prev=>{ const next=[...prev]; next[i]={...next[i], base:'', location:'', type:''}; return next; });
                                      closeMenus();
                                    }}
                                  />
                                ) : (
                                  <Chip
                                    active={false}
                                    data-shot-chip={r.id}
                                    onClick={(e)=>{
                                      e.stopPropagation();
                                      if (shotMenuOpen) {
                                        closeMenus();
                                      } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setShotMenuAnchor({ id: r.id, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 4 });
                                        setOpenShotMenuId(r.id);
                                        setOpenLocMenuId(null);
                                      }
                                    }}
                                  >Select Shot</Chip>
                                )}
                                {base && (
                                  <Chip
                                    active={!!location}
                                    data-loc-chip={r.id}
                                    onClick={(e)=>{
                                      e.stopPropagation();
                                      if (location) {
                                        // Deselect only location
                                        setRows(prev=>{ const next=[...prev]; next[i]={...next[i], location:'', type: buildType(base,'')}; return next; });
                                        closeMenus();
                                      } else {
                                        if (locMenuOpen) {
                                          closeMenus();
                                        } else {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setLocMenuAnchor({ id: r.id, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 4 });
                                          setOpenLocMenuId(r.id);
                                          setOpenShotMenuId(null);
                                        }
                                      }
                                    }}
                                  >{location || 'Select Location'}</Chip>
                                )}
                                {/* Popup menus rendered outside table to avoid layout shift */}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            {(() => {
                              const range = computeAllowedRange(rows,'L',i);
                              const allowedMin = range ? range[0] : 5;
                              const allowedMax = range ? range[1] : 100;
                              let actual = r.initL && r.initL>0 ? r.initL : null;
                              if (actual != null) {
                                if (actual > allowedMax) actual = allowedMax;
                                if (actual < allowedMin) actual = allowedMin;
                              }
                              const sliderMin = 5; const sliderMax = 100;
                              const displayVal = actual != null ? actual : 50;
                              // Ascending visual (05 -> 100). Grey before allowedMin and after allowedMax.
                              const leftGreyPct = ((allowedMin - 5) / 95) * 100;
                              const rightGreyStartPct = ((allowedMax - 5) / 95) * 100;
                              const trackBg = range ? `linear-gradient(to right,
                                rgba(55,65,81,0.70) 0%,
                                rgba(55,65,81,0.70) ${leftGreyPct}%,
                                rgba(16,185,129,0.35) ${leftGreyPct}%,
                                rgba(16,185,129,0.35) ${rightGreyStartPct}%,
                                rgba(55,65,81,0.70) ${rightGreyStartPct}%,
                                rgba(55,65,81,0.70) 100%)` : 'linear-gradient(to right, rgba(55,65,81,0.70), rgba(55,65,81,0.70))';
                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between text-[10px] text-slate-500 -mb-1">
                                    <span>05</span><span>100</span>
                                  </div>
                                  <div className="relative">
                                    <input
                                      data-slider
                                      type="range"
                                      min={sliderMin}
                                      max={sliderMax}
                                      step={5}
                                      value={Math.min(Math.max(actual != null ? actual : displayVal, sliderMin), sliderMax)}
                                      onMouseDown={e=>{ e.stopPropagation(); }}
                                      onPointerDown={e=>{ e.stopPropagation(); }}
                                      onDragStart={e=>{ e.preventDefault(); e.stopPropagation(); }}
                                      onChange={e=>{
                                        let newActual = Number(e.target.value);
                                        if (newActual > allowedMax) newActual = allowedMax;
                                        if (newActual < allowedMin) newActual = allowedMin;
                                        setRows(prev=>{ const next=[...prev]; next[i]={...next[i], initL: newActual}; return next; });
                                      }}
                                      style={{ background: trackBg }}
                                      className="w-full appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"/>
                                    {range && !(allowedMin===5 && allowedMax===100) && (()=>{
                                      return (
                                        <>
                                          <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-emerald-700" style={{ left: leftGreyPct + '%' }}>{format2(allowedMin)}</div>
                                          <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-emerald-700" style={{ left: rightGreyStartPct + '%' }}>{format2(allowedMax)}</div>
                                        </>
                                      );
                                    })()}
                                    {actual!=null && range && (()=>{
                                      const pct = ((actual - 5) / 95) * 100;
                                      return (
                                        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-[-50%] text-[10px] font-medium bg-emerald-600 text-white px-2 py-1 rounded-md shadow min-w-[30px] text-center" style={{ left: pct + '%' }}>{format2(actual)}</div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="mt-5">
                              <Chip
                                active={r.initL===0}
                                onClick={()=>{
                                  if (r.initL===0) return;
                                  setRows(prev=>{ const next=[...prev]; next[i]={...next[i], initL:0}; return next; });
                                }}
                              >Not Possible</Chip>
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            {(() => {
                              const range = computeAllowedRange(rows,'R',i);
                              const allowedMin = range ? range[0] : 5;
                              const allowedMax = range ? range[1] : 100;
                              let actual = r.initR && r.initR>0 ? r.initR : null;
                              if (actual != null) {
                                if (actual > allowedMax) actual = allowedMax;
                                if (actual < allowedMin) actual = allowedMin;
                              }
                              const sliderMin = 5; const sliderMax = 100; // reversed visual
                              const displayVal = actual != null ? actual : 50;
                              // Descending visual (100 -> 05). Grey left (values > allowedMax after reversal) and right (values < allowedMin).
                              const leftStopPct = ((100 - allowedMax) / 95) * 100;
                              const rightStartPct = ((100 - allowedMin) / 95) * 100;
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
                                    <span>100</span><span>05</span>
                                  </div>
                                  <div className="relative">
                                    <input
                                      data-slider
                                      type="range"
                                      min={sliderMin}
                                      max={sliderMax}
                                      step={5}
                                      value={Math.min(Math.max(105 - (actual != null ? actual : displayVal), sliderMin), sliderMax)}
                                      onMouseDown={e=>{ e.stopPropagation(); }}
                                      onPointerDown={e=>{ e.stopPropagation(); }}
                                      onDragStart={e=>{ e.preventDefault(); e.stopPropagation(); }}
                                      onChange={e=>{
                                        const raw = Number(e.target.value);
                                        let newActual = 105 - raw;
                                        if (newActual > allowedMax) newActual = allowedMax;
                                        if (newActual < allowedMin) newActual = allowedMin;
                                        setRows(prev=>{ const next=[...prev]; next[i]={...next[i], initR: newActual}; return next; });
                                      }}
                                      style={{ background: trackBg }}
                                      className="w-full appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"/>
                                    {range && !(allowedMin===5 && allowedMax===100) && (()=>{
                                      return (
                                        <>
                                          <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-rose-700" style={{ left: leftStopPct + '%' }}>{format2(allowedMax)}</div>
                                          <div className="pointer-events-none absolute top-full mt-1 translate-x-[-50%] text-[10px] text-rose-700" style={{ left: rightStartPct + '%' }}>{format2(allowedMin)}</div>
                                        </>
                                      );
                                    })()}
                                    {actual!=null && range && (()=>{
                                      const pct = ((100 - actual) / 95) * 100;
                                      return (
                                        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-[-50%] text-[10px] font-medium bg-rose-600 text-white px-2 py-1 rounded-md shadow min-w-[30px] text-center" style={{ left: pct + '%' }}>{format2(actual)}</div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="mt-5">
                              <Chip
                                active={r.initR===0}
                                onClick={()=>{
                                  if (r.initR===0) return;
                                  setRows(prev=>{ const next=[...prev]; next[i]={...next[i], initR:0}; return next; });
                                }}
                              >Not Possible</Chip>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-right relative select-none">
                          <button
                            onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                            className="text-slate-500 hover:text-red-600"
                            title="Remove"
                          >
                            ✕
                          </button>
                          {!initialized && (
                            <button
                              type="button"
                              aria-label="Drag to reorder"
                              draggable
                              onDragStart={(e)=>{ if(initialized) return; setDragRowIdx(i); setDragOverIdx(i); e.dataTransfer.effectAllowed='move'; }}
                              onDragEnd={()=> { setDragRowIdx(null); setDragOverIdx(null); }}
                              className="absolute right-1 bottom-1 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-grab active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 15a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
                              </svg>
                            </button>
                          )}
                          {!initialized && (
                            <button
                              type="button"
                              onClick={() => setRows(prev => {
                                const next=[...prev];
                                const aboveIdx = i; // row above insertion point
                                const belowIdx = i+1 < prev.length ? i+1 : null;
                                // Compute insertion default per flipper. If adjacent (<=5 gap) auto set Not Possible (0) for that side.
                                const computeInsertValue = (side) => {
                                  if (side === 'L') { // ascending
                                    // Find nearest positive above (strictly >0) scanning upward including immediate above
                                    let upIdx = aboveIdx;
                                    while (upIdx >= 0 && !(prev[upIdx].initL > 0)) upIdx--;
                                    // Find nearest positive below scanning downward starting at belowIdx
                                    let downIdx = belowIdx;
                                    while (downIdx != null && downIdx < prev.length && !(prev[downIdx].initL > 0)) downIdx++;
                                    const haveUpper = upIdx >= 0;
                                    const haveLower = downIdx != null && downIdx < prev.length;
                                    if (!haveUpper && !haveLower) return 0; // no usable bounds
                                    // Phantom lower bound of 100 if inserting at bottom with only an upper bound.
                                    if (haveUpper && !haveLower) {
                                      const aboveVal = prev[upIdx].initL;
                                      if (!(aboveVal > 0)) return 0;
                                      // Special boundary cases:
                                      // If above=95 and phantom=100 -> place 100 (allowed) instead of Not Possible.
                                      if (aboveVal === 95) return 100;
                                      // If above already at 100 -> Not Possible below.
                                      if (aboveVal === 100) return 0;
                                      const gap = 100 - aboveVal;
                                      if (gap <= 5) return 0; // (covers aboveVal 96-100 except 95 handled earlier)
                                      let mid = Math.round(((aboveVal + 100) / 2) / 5) * 5;
                                      if (mid <= aboveVal) mid = aboveVal + 5;
                                      if (mid >= 100) mid = 95; // keep strictly below phantom 100
                                      if (!(mid > aboveVal && mid < 100)) return 0;
                                      return clamp(mid, 5, 100);
                                    }
                                    if (!haveUpper && haveLower) return 0; // top insertion without upper bound -> Not Possible
                                    const aboveVal = prev[upIdx].initL;
                                    const belowVal = prev[downIdx].initL; // real lower bound
                                    const gap = belowVal - aboveVal;
                                    if (!(aboveVal > 0) || !(belowVal > 0) || gap <= 5) return 0;
                                    let mid = Math.round(((aboveVal + belowVal) / 2) / 5) * 5;
                                    if (mid <= aboveVal) mid = aboveVal + 5;
                                    if (mid >= belowVal) mid = belowVal - 5;
                                    if (!(mid > aboveVal && mid < belowVal)) return 0;
                                    return clamp(mid, 5, 100);
                                  } else { // Right descending (higher -> lower)
                                    let upIdx = aboveIdx; // upIdx is the immediate above (should be higher value in descending sequence)
                                    while (upIdx >= 0 && !(prev[upIdx].initR > 0)) upIdx--;
                                    let downIdx = belowIdx;
                                    while (downIdx != null && downIdx < prev.length && !(prev[downIdx].initR > 0)) downIdx++;
                                    const haveUpper = upIdx >= 0;
                                    const haveLower = downIdx != null && downIdx < prev.length;
                                    if (!haveUpper && !haveLower) return 0;
                                    // Phantom lower (smaller) bound of 5 if inserting at bottom with only upper bound in descending sequence
                                    if (haveUpper && !haveLower) {
                                      const aboveVal = prev[upIdx].initR;
                                      if (!(aboveVal > 0)) return 0;
                                      // Special boundary cases for descending side with phantom 5:
                                      // If above=10 and phantom=5 -> set 5 (allowed) instead of Not Possible.
                                      if (aboveVal === 10) return 5;
                                      // If above=5 -> Not Possible (can't go below 5).
                                      if (aboveVal === 5) return 0;
                                      const gap = aboveVal - 5;
                                      if (gap <= 5) return 0; // covers aboveVal 6-10 except 10 handled above
                                      let mid = Math.round(((aboveVal + 5) / 2) / 5) * 5;
                                      if (mid >= aboveVal) mid = aboveVal - 5;
                                      if (mid <= 5) mid = 10; // keep strictly above phantom 5
                                      if (!(mid < aboveVal && mid > 5)) return 0;
                                      return clamp(mid, 5, 100);
                                    }
                                    if (!haveUpper && haveLower) return 0; // top insertion without upper bound
                                    const aboveVal = prev[upIdx].initR; // higher
                                    const belowVal = prev[downIdx].initR; // real lower
                                    const gap = aboveVal - belowVal;
                                    if (!(aboveVal > 0) || !(belowVal > 0) || gap <= 5) return 0;
                                    let mid = Math.round(((aboveVal + belowVal) / 2) / 5) * 5;
                                    if (mid >= aboveVal) mid = aboveVal - 5;
                                    if (mid <= belowVal) mid = belowVal + 5;
                                    if (!(mid < aboveVal && mid > belowVal)) return 0;
                                    return clamp(mid, 5, 100);
                                  }
                                };
                                const midL = computeInsertValue('L');
                                const midR = computeInsertValue('R');
                                const row = newRow({ initL: midL, initR: midR }, prev.length);
                                next.splice(i+1,0,row);
                                return next;
                              })}
                              className="absolute right-8 bottom-1 px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-[11px] text-slate-700 whitespace-nowrap"
                            >+ Insert Shot</button>
                          )}
                        </td>
                        </tr>
                        {/* If dragging to end: show marker after last row */}
                        {dragRowIdx != null && i === rows.length-1 && dragOverIdx === rows.length && (
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
                    {dragRowIdx != null && dragOverIdx === rows.length && (
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
            </Section>

            <Section title="2) Session parameters">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <label className="w-48" title={"How far each hidden truth can start from your initial guess (in 5% steps).\nExample: 3 steps lets a 60 become anywhere from 45 to 75."} >Initial random steps</label>
                  <NumberInput value={initRandSteps} onChange={setInitRandSteps} min={0} max={4} />
                  <span className="text-slate-500">(×5%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48" title={"How often hidden values shift after attempts.\nExample: 5 means every 5th attempt triggers a drift."} >Drift every</label>
                  <NumberInput value={driftEvery} onChange={setDriftEvery} min={0} max={50} />
                  <span>attempts</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48" title={"Maximum distance (in 5% steps) a value can wander from its base during drift.\nExample: 2 means each shot stays within ±10 of its starting value."} >Drift magnitude</label>
                  <NumberInput value={driftMag} onChange={setDriftMag} min={0} max={10} step={0.5} />
                  <span className="text-slate-500">(×5%)</span>
                </div>
                {/* Drift bias removed: drift band now directly based on magnitude (usable integer steps = floor(mag)) */}
                <div className="flex items-center gap-3">
                  <label className="w-48" title={"Manual lets you pick any shot & flipper; Random picks one for you each attempt to reduce bias.\nExample: Random may jump Ramp Left → Orbit Right."} >Mode</label>
                  <div className="flex gap-2 flex-wrap">
                    <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>Manual</Chip>
                    <Chip active={mode === 'random'} onClick={() => setMode('random')}>Random</Chip>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={canStart ? startSession : undefined}
                  disabled={!canStart}
                  title={canStart ? 'Start the practice session' : 'Complete Shot Type, Left & Right values for every shot'}
                  className={"px-4 py-2 rounded-2xl text-white " + (canStart ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-400 opacity-60 cursor-not-allowed')}
                >
                  Start Session
                </button>
                <button
                  onClick={() => {
                    setRows([
                      newRow({ base: 'Ramp', location: 'Left', initL: 70, initR: 55 }, 0),
                      newRow({ base: 'Ramp', location: 'Right', initL: 20, initR: 80 }, 1),
                      newRow({ base: 'Orbit', location: 'Left', initL: 65, initR: 40 }, 2),
                    ]);
                  }}
                  className="px-4 py-2 rounded-2xl border"
                >
                  Reset to example
                </button>
              </div>
            </Section>
          </>
        )}

        {/* Practice */}
        {initialized && !finalPhase && (
          <>
            <Section
              title="Practice"
              right={
                <div className="flex items-center gap-3">
                  {/* Mental model & hidden truth toggles moved into feedback panel */}
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={showAttemptHistory}
                      onChange={(e) => setShowAttemptHistory(e.target.checked)}
                    />
                    Attempt history
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={showFeedbackPanel}
                      onChange={(e) => setShowFeedbackPanel(e.target.checked)}
                    />
                    Feedback
                  </label>
                  <button onClick={endSession} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm">End session</button>
                  <button onClick={resetAll} className="px-3 py-1.5 rounded-xl border text-sm">Full reset</button>
                </div>
              }
            >
              <div className={`grid grid-cols-1 ${showFeedbackPanel ? 'lg:[grid-template-columns:1.2fr_1fr]' : ''} gap-4`}>
                {/* Left: selection and input */}
                <div className="lg:col-span-1">
                  <div className="flex items-center gap-3 mb-3">
                    <label className="w-28 text-sm text-slate-600">Mode</label>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>Manual</Chip>
                      <div className="flex items-center gap-2">
                        <Chip active={mode === 'random'} onClick={() => setMode('random')}>Random</Chip>
                        {mode === 'random' && (
                          <button
                            onClick={() => { setSelectedIdx(pickRandomIdx()); setSelectedSide(Math.random() < 0.5 ? 'L' : 'R'); }}
                            className="px-3 py-1.5 rounded-xl border text-sm"
                            title="Random new shot & flipper"
                          >↻ New</button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <label className="w-28 text-sm text-slate-600 mt-1">Shot</label>
                      <div className="flex gap-2 flex-wrap">
                        {rows.map((r, i) => (
                          <Chip
                            key={r.id}
                            active={selectedIdx === i}
                            onClick={() => mode === 'manual' ? setSelectedIdx(i) : undefined}
                            disabled={mode === 'random'}
                          >
                            {r.type}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <label className="w-28 text-sm text-slate-600">Flipper</label>
                    <div className="flex gap-2">
                      <Chip
                        active={selectedSide==='L'}
                        onClick={()=> mode==='manual' ? setSelectedSide('L') : undefined}
                        disabled={mode==='random'}
                      >Left</Chip>
                      <Chip
                        active={selectedSide==='R'}
                        onClick={()=> mode==='manual' ? setSelectedSide('R') : undefined}
                        disabled={mode==='random'}
                      >Right</Chip>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-start gap-3">
                      <label className="w-28 text-sm text-slate-600 mt-1">Recall</label>
                      <div className="flex flex-col items-stretch">
                        <div className="flex items-center gap-2">
                          <NumberInput
                            ref={recallInputRef}
                            value={guess}
                            min={0}
                            max={100}
                            className={recallError ? 'border-red-500 focus:ring-red-500' : ''}
                            onChange={(v) => {
                              if (v === "" || v === null || v === undefined) {
                                setGuess("");
                                if (recallError) setRecallError("");
                                return;
                              }
                              const n = Number(v);
                              if (!Number.isFinite(n)) return;
                              const clamped = Math.max(0, Math.min(100, n));
                              setGuess(clamped);
                              if (recallError) setRecallError("");
                            }}
                            step={5}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitAttempt();
                              }
                            }}
                          />
                        </div>
                        {recallError && (
                          <div className="mt-1 text-center text-[11px] leading-snug whitespace-pre-line text-red-600">
                            {recallError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => { submitAttempt(); /* keep focus for rapid entry */ setTimeout(()=>{recallInputRef.current?.focus(); recallInputRef.current?.select();},0); }}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 text-white"
                  >
                    Submit
                  </button>

                  {/* Mental model moved into feedback panel */}
                </div>

                {/* Right: feedback and stats (toggleable) */}
                {showFeedbackPanel && (
                  <div className="lg:col-span-1">
                    <h3 className="font-medium mb-2">Feedback</h3>
                    <div className="border rounded-2xl p-3">
                      <div className="text-sm">
                        {(() => {
                          const a = attempts[0];
                          const has = !!a;
                          return (
                            <>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Last shot</div>
                                <div className="font-medium">{has ? rowDisplayWithSide(rows[a.idx], a.side) : '—'}</div>
                              </div>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Result</div>
                                <div className="font-medium capitalize">
                                  {has ? (
                                    <>
                                      {a.label} <span className="text-slate-500">(</span>
                                      <span style={{color: SEVERITY_COLORS[a.severity] || '#334155'}}>{a.severity}</span>{' '}
                                      <span className="text-slate-500">{a.delta > 0 ? '+' : ''}{a.delta})</span>
                                    </>
                                  ) : 'N/A'}
                                </div>
                              </div>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Recall</div>
                                <div>{has ? format2(a.input) : '—'}</div>
                              </div>
                              {showMentalModel && has && a.prevInput != null && (
                                <div className="flex justify-between mb-1">
                                  <div className="text-slate-600">Prev recall</div>
                                  <div>{formatPct(a.prevInput)}</div>
                                </div>
                              )}
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Recall delta</div>
                                <div>{has ? (a.prevInput != null ? (()=>{ const diff = Math.round((a.input ?? 0)-(a.prevInput ?? 0)); return (diff>0?'+':'')+diff; })() : 'N/A') : 'N/A'}</div>
                              </div>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Adjustment needed</div>
                                <div className="capitalize">{has ? (a.adjustRequired ? (a.requiredDir === -1 ? 'Lower' : a.requiredDir === 1 ? 'Higher' : 'None') : 'N/A') : 'N/A'}</div>
                              </div>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Adjustment result</div>
                                <div className={has && a.adjustRequired ? (a.adjustCorrect ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}>
                                  {has ? (a.adjustRequired ? (a.adjustCorrect ? 'Correct' : 'Missed') : 'N/A') : 'N/A'}
                                </div>
                              </div>
                              <div className="flex justify-between mb-1">
                                <div className="text-slate-600">Hidden truth</div>
                                <div>{showTruth ? (has ? formatPct(a.truth) : '—') : '—'}</div>
                              </div>
                              <div className="flex justify-between mt-2 pt-2 border-t">
                                <div className="text-slate-600">Points</div>
                                <div className="text-right">
                                  <div>{has ? `${a.points} pts` : '—'}</div>
                                  {has && a.basePoints != null ? (
                                    <div className="text-[11px] text-slate-500">Base {a.basePoints}{a.adjustPenalty ? ` − Adj Penalty ${a.adjustPenalty}` : ''}</div>
                                  ) : (
                                    <div className="text-[11px] text-slate-400">Awaiting first attempt</div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t">
                                <div className="flex flex-wrap gap-4 items-center mb-3">
                                  <label className="flex items-center gap-2 text-[11px] text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={showMentalModel}
                                      onChange={(e)=>{ const v=e.target.checked; setShowMentalModel(v); }}
                                    />
                                    Mental model
                                  </label>
                                  <label className="flex items-center gap-2 text-[11px] text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={showTruth}
                                      onChange={(e)=> setShowTruth(e.target.checked)}
                                    />
                                    Hidden truth
                                  </label>
                                </div>
                                {showMentalModel && (
                                  <div>
                                    <h4 className="font-medium mb-2 text-sm">Your mental model</h4>
                                    <div className="rounded-xl border overflow-hidden">
                                      <table className="w-full text-[11px] md:text-xs">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="p-1.5 text-left">Shot</th>
                                            <th className="p-1.5 text-right">ML</th>
                                            {showTruth && <th className="p-1.5 text-right">HL</th>}
                                            <th className="p-1.5 text-right">MR</th>
                                            {showTruth && <th className="p-1.5 text-right">HR</th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.map((r, i) => (
                                            <tr key={r.id} className="border-t">
                                              <td className="p-1.5 whitespace-nowrap max-w-[120px] truncate" title={r.type}>{r.type}</td>
                                              <td className="p-1.5 text-right">{formatPct(mentalL[i] ?? 0)}</td>
                                              {showTruth && <td className="p-1.5 text-right text-slate-600">{formatPct(hiddenL[i] ?? 0)}</td>}
                                              <td className="p-1.5 text-right">{formatPct(mentalR[i] ?? 0)}</td>
                                              {showTruth && <td className="p-1.5 text-right text-slate-600">{formatPct(hiddenR[i] ?? 0)}</td>}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Consolidated metrics row above playfield */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="border rounded-2xl p-4 flex flex-col items-center justify-center">
                  <div className="text-slate-600 mb-1">Last attempt</div>
                  <div className="text-2xl font-semibold">{attempts[0] ? attempts[0].points : '—'}</div>
                  <div className={"text-[11px] mt-1 text-center min-h-[14px] " + (attempts[0] ? 'text-slate-500' : 'text-slate-400')}>
                    {attempts[0]
                      ? `Base ${attempts[0].basePoints}${attempts[0].adjustPenalty ? ` − Penalty ${attempts[0].adjustPenalty}` : ''}`
                      : 'Base —'}
                  </div>
                </div>
                <div className="border rounded-2xl p-4 flex flex-col items-center justify-center">
                  <div className="text-slate-600 mb-1">Attempts</div>
                  <div className="text-2xl font-semibold">{attemptCount}</div>
                </div>
                <div className="border rounded-2xl p-4 flex flex-col items-center justify-center">
                  <div className="text-slate-600 mb-1">Total points</div>
                  <div className="text-2xl font-semibold">{totalPoints}</div>
                </div>
                <div className="border rounded-2xl p-4 flex flex-col items-center justify-center">
                  <div className="text-slate-600 mb-1">Avg abs error</div>
                  <div className="text-2xl font-semibold">{avgAbsErr.toFixed(1)} pts</div>
                </div>
              </div>

              <div className="mt-6">
                {/* Practice playfield (read-only visual) */}
                <div className="relative">
                  {/* Fullscreen toggle button (enter) */}
                  {!playfieldFullscreen && (
                    <button
                      type="button"
                      onClick={()=> setPlayfieldFullscreen(true)}
                      title="Fullscreen"
                      className="absolute top-2 right-2 z-40 bg-white/90 hover:bg-white text-slate-700 border shadow px-2 py-1 rounded-md text-xs flex items-center gap-1"
                    >
                      {/* Enter fullscreen icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M8 8H5V5"/><path d="M16 8h3V5"/><path d="M16 16h3v3"/><path d="M8 16H5v3"/></svg>
                      Fullscreen
                    </button>
                  )}
                  <PracticePlayfield rows={rows} selectedIdx={selectedIdx} selectedSide={selectedSide} lastRecall={attempts[0] || null} />
                </div>
                {/* Quick recall chips (values 05..95) with centered rectangular Not Possible below */}
                <div className="mt-4">
                  {(() => {
                    const values = Array.from({length:19},(_,k)=> (k+1)*5); // 5..95
                    const ordered = selectedSide === 'L' ? values : [...values].reverse();
                    return (
                      <div className="w-full select-none flex flex-col items-stretch gap-3">
                        <div className="flex gap-1 w-full">
                          {ordered.map(v => (
                            <div key={v} className="flex-1 min-w-0">
                              <Chip
                                className="w-full px-1 py-1"
                                active={false}
                                onClick={()=>submitAttempt(v)}
                              >{format2(v)}</Chip>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={()=>submitAttempt(0)}
                            className="px-5 py-2 rounded-xl bg-white border border-slate-300 shadow hover:bg-slate-100 text-xs font-medium"
                          >Not Possible</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {showAttemptHistory && (
                  <>
                    {/* Attempt history below playfield */}
                    <h3 className="font-medium mb-2">Attempt history</h3>
                    <div className="overflow-auto border rounded-2xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
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
                          {attempts.map((a, i) => (
                            <tr key={a.t + ":" + i} className="border-t">
                              <td className="p-2">{new Date(a.t).toLocaleTimeString()}</td>
                              <td className="p-2">{rowDisplayWithSide(rows[a.idx], a.side)}</td>
                              <td className="p-2 text-right">{formatPct(a.input)}</td>
                              <td className="p-2 text-right">{formatPct(a.truth)}</td>
                              <td className="p-2 text-right">{a.prevInput != null ? formatPct(a.prevInput) : '—'}</td>
                              <td className="p-2 text-right">{a.delta > 0 ? "+" : ""}{a.delta}</td>
                              <td className="p-2 text-right">{a.adjustRequired ? (a.adjustCorrect ? '✔' : '✖') : '—'}</td>
                              <td className="p-2 text-right">{a.adjustRequired ? (a.requiredDir === -1 ? '↓' : a.requiredDir === 1 ? '↑' : '') : '—'}</td>
                              <td className="p-2 text-right">{a.adjustPenalty ? a.adjustPenalty : 0}</td>
                              <td className="p-2 text-right capitalize">{a.label}</td>
                              <td className="p-2 text-right">{a.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </Section>
            {playfieldFullscreen && createPortal(
              <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-sm flex flex-col overflow-hidden">
                {(() => {
                  const s = fullscreenScale || 1;
                  const fontSize = Math.round(11 * s); // base 11px scaled
                  const padY = 0.9 * s; // base 0.9 (~py-1.5 ≈6px) adjust
                  const padX = 1.2 * s; // base horizontal
                  const gap = 6 * s; // base gap 6px
                  const iconSize = Math.max(14, Math.round(14 * s));
                  return (
                    <div className="flex items-center justify-between px-4 py-2 text-slate-200" style={{fontSize}}>
                      <div className="font-medium" style={{fontSize: Math.round(fontSize*1.05)}}>Practice Playfield</div>
                      <div className="flex items-center" style={{gap}}>
                        <button
                          type="button"
                          onClick={()=> setPlayfieldFullscreen(false)}
                          title="Exit fullscreen (Esc)"
                          style={{
                            padding: `${padY}px ${padX*8}px`,
                            fontSize: fontSize * 0.9,
                            lineHeight: 1.1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: `${Math.round(4*s)}px`,
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
                <div className="flex-1 flex flex-col items-stretch px-4 pb-4 gap-4 overflow-hidden">
                    <div className="relative flex-1 flex flex-col min-h-0">
                      <PracticePlayfield fullscreen rows={rows} selectedIdx={selectedIdx} selectedSide={selectedSide} lastRecall={attempts[0] || null} onScale={s=> setFullscreenScale(s)} />
                    </div>
                    <div className="w-full mx-auto pt-2">
                    {/* Quick recall chips duplicated for fullscreen (non-stretch circular layout) */}
                    {(() => {
                      // 19 numeric chips (5..95) + 1 Not Possible = 20 circles that must always fit single row.
                      // Strategy:
                      // 1. Measure available container width (window.innerWidth minus side padding ~32px).
                      // 2. Solve for diameter d and gap g such that 20*d + 19*g = availableWidth.
                      //    Constrain g within [minGap,maxGap]; if d exceeds maxDiameter clamp; if below minDiameter clamp and recompute gap (may cause negative -> then reduce diameter further).
                      // Simplify: choose a target gap proportionally (baseGap=12) scaled by fullscreenScale then adjust to fill leftover exactly.
                      const values = Array.from({length:19},(_,k)=> (k+1)*5); // 5..95
                      const ordered = selectedSide === 'L' ? values : [...values].reverse();
                      const totalChips = 19; // numeric chips only (NP below)
                      // Estimate inner horizontal padding (px). Container uses px-4 on parent (16px each side).
                      const horizontalPadding = 32; // 16 left + 16 right
                      const avail = Math.max(300, window.innerWidth - horizontalPadding); // safeguard
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
                        if (d < 20) d = 20; // absolute floor
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
                                onClick={()=>submitAttempt(v)}
                                className="rounded-full bg-white border border-slate-300 shadow hover:bg-slate-50 active:scale-[0.95] transition-transform flex items-center justify-center flex-shrink-0"
                                style={{ width: diameter, height: diameter, fontSize: chipFont, lineHeight: 1, fontWeight: 600 }}
                                aria-label={`Recall ${format2(v)}`}
                              >{format2(v)}</button>
                            ))}
                          </div>
                          <div className="mt-4 flex justify-center">
                            <button
                              type="button"
                              onClick={()=>submitAttempt(0)}
                              className="px-6 py-3 rounded-xl bg-white border border-slate-300 shadow hover:bg-slate-50 active:scale-[0.97] transition-transform text-sm font-medium"
                              style={{ fontSize: Math.max(12, Math.round(chipFont*0.75)) }}
                            >Not Possible</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </>
        )}

        {/* Final recall */}
        {initialized && finalPhase && (
          <>
            <Section
              title="Final Recall Challenge"
              right={
                <div className="flex items-center gap-3">
                  <button onClick={() => setFinalPhase(false)} className="px-3 py-1.5 rounded-xl border text-sm">Back to practice</button>
                  <button onClick={resetAll} className="px-3 py-1.5 rounded-xl border text-sm">Full reset</button>
                </div>
              }
            >
              <p className="text-sm text-slate-600 mb-4">Enter your best recall for each shot. Higher score means closer to the hidden truth.</p>
              <div className="overflow-auto border rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="p-2 text-left">Shot</th>
                      <th className="p-2 text-right">Your final recall</th>
                      <th className="p-2 text-right">Hidden truth</th>
                      <th className="p-2 text-right">Abs error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.type}</td>
                        <td className="p-2 text-right">
                          <NumberInput value={finalRecallL[i] ?? 0} onChange={(v)=>setFinalRecallL(arr=>{const next=[...arr]; next[i]=validatePercent(v) ?? next[i] ?? 0; return next;})} />
                        </td>
                        <td className="p-2 text-right">
                          <NumberInput value={finalRecallR[i] ?? 0} onChange={(v)=>setFinalRecallR(arr=>{const next=[...arr]; next[i]=validatePercent(v) ?? next[i] ?? 0; return next;})} />
                        </td>
                        <td className="p-2 text-right">{formatPct(hiddenL[i] ?? 0)} / {formatPct(hiddenR[i] ?? 0)}</td>
                        <td className="p-2 text-right">{(Math.abs(clamp(finalRecallL[i] ?? 0)-(hiddenL[i] ?? 0)) + Math.abs(clamp(finalRecallR[i] ?? 0)-(hiddenR[i] ?? 0))).toFixed(0)} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded-2xl p-3">
                  <div className="text-slate-600">Final score</div>
                  <div className="text-3xl font-semibold">{finalScore}</div>
                </div>
                <div className="border rounded-2xl p-3">
                  <div className="text-slate-600">Shots</div>
                  <div className="text-3xl font-semibold">{rows.length}</div>
                </div>
                <div className="border rounded-2xl p-3">
                  <div className="text-slate-600">Total attempts</div>
                  <div className="text-3xl font-semibold">{attemptCount}</div>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
