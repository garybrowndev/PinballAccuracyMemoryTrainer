import React, { useEffect, useMemo, useState, useRef } from "react";

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
// Tailwind palette approximations: green (emerald), yellow-green (lime), yellow (amber), red (rose)
const SEVERITY_COLORS = {
  perfect: '#059669',      // emerald-600
  slight: '#65a30d',       // lime-600 (yellow-green)
  fairly: '#ca8a04',       // amber-600 (yellow)
  very: '#dc2626',         // red-600
};

// Stable id generator for rows to prevent input remount/focus loss
let ROW_ID_SEED = 1;
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
//  - Rarer/mechanical or era-specific: Horseshoe, Rollover (distinct rollover lane target group), Vari Target, Roto, Waterfall, Roto Target, Toy (unique mechs), Capture, Deadend, Gate.
//  - "Toy" is conceptually common but each is unique; as a generic category it's lower for selection granularity here.
//  - Ordering trades absolute statistical rigor for practical training relevance: earlier entries likely anchor a player's memory model.
const BASE_ELEMENTS = [
  // Very Common / Core geometry & ubiquitous scoring surfaces
  'Orbit','Ramp','Standups','Lane','Bumper','Spinner',
  // Common but slightly more situational or not on every single game
  'Drops','Scoop','Saucer','VUK','Captive Ball',
  // Regular specialty / feature mechs & control elements
  'Magnet','Kickback','Horseshoe','Rollover','Gate',
  // Occasional (era or design style dependent)
  'Loop','Vari Target','Captive','Deadend','Toy',
  // Rare / Niche / Specific mechanical assemblies or less standardized names
  'Roto','Roto Target','Waterfall','Alley','Capture'
];
// Added extended location variants to support richer spatial descriptors in practice:
// Previous: Left, Center, Right. New additions: Bottom, Top, Upper, Lower, Side.
// These simply expand selectable suffixes; no logic elsewhere depends on specific set/order.
const LOCATIONS = ['Left','Center','Right','Bottom','Top','Upper','Lower','Side'];

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
    initL: null,
    initR: null,
    // Provide a basic fan-out pattern: stagger horizontally & vertically based on index.
    x: 0.2 + ((indexHint % 6) * 0.12), // wraps every 6
    y: 0.15 + Math.floor(indexHint / 6) * 0.18,
    ...over,
  };
};

function rowDisplay(r) { return r ? (r.type || buildType(r.base, r.location)) : ''; }
function rowDisplayWithSide(r, side) { return r ? `${side === 'L' ? 'Left Flipper' : 'Right Flipper'} → ${rowDisplay(r)}` : ''; }

// Allowed value computation per side with domain-specific ordering rules:
// Right flipper column: strictly decreasing top->bottom (earlier row must be > later row). No duplicates allowed anywhere.
// Left flipper column: ascending (later rows must be >= earlier). Zero may repeat freely until a first non-zero chosen above; once a non-zero appears above, later rows must be strictly greater than that last non-zero above (to preserve increasing difficulty sense). Multiple zeros below a non-zero are not allowed.
// All values are multiples of 5 between 0..100.
function computeAllowedValues(rows, side, index) {
  const STEP_VALUES = Array.from({length:21},(_,k)=>k*5);
  const vals = side==='L' ? rows.map(r=>r.initL) : rows.map(r=>r.initR);
  if (side === 'R') {
    // Strictly decreasing top->bottom
    // Earlier rows (0..index-1) must each be > value at index; Later rows must be < value at index.
    // Allowed range upper bound = min( earlier values ) - 5 (since must be strictly less than all earlier). If no earlier, upper bound 100.
    // Lower bound = max( later values ) + 5 (must be strictly greater than all later). If no later, lower bound 0.
    const earlier = vals.slice(0,index).filter(v=>v!=null);
    const later = vals.slice(index+1).filter(v=>v!=null);
    let upper = earlier.length ? Math.min(...earlier) - 5 : 100; // strictly less than smallest earlier chosen
    let lower = later.length ? Math.max(...later) + 5 : 0;       // strictly greater than largest later chosen
    upper = Math.min(100, upper);
    lower = Math.max(0, lower);
    const allowed = STEP_VALUES.filter(v => v >= lower && v <= upper);
    // Hide chips >= value selected above: ensured by upper calculation.
    return allowed;
  } else {
    // Left side:
    // Ascending: later rows >= earlier rows. Zero can repeat any number of times until first non-zero above appears.
    // Once a non-zero appears above, later rows must be >= that non-zero + 5 (strictly increasing beyond first positive anchor).
  const earlier = vals.slice(0,index).filter(v=>v!=null);
  const later = vals.slice(index+1).filter(v=>v!=null);
    // Lower bound logic:
    // If no positive above: lower bound = 0 (zeros allowed)
    // If positive above exists: lower bound = maxEarlier (if maxEarlier===0) else firstPositiveAbove + 5? Need strictly greater than last non-zero above.
    // We'll track last non-zero above instead.
    const lastNonZeroAbove = [...earlier].reverse().find(v=>v>0) || 0;
    let lowerBound;
    if (lastNonZeroAbove === 0) lowerBound = 0; else lowerBound = lastNonZeroAbove + 5; // strictly greater than previous non-zero
    // Upper bound: must remain <= min(later values) if later chosen (since non-decreasing). If later values exist, allowed <= min(later).
    const minLater = later.length ? Math.min(...later) : 100;
    let allowed = STEP_VALUES.filter(v => v >= lowerBound && v <= minLater);
    // Special case: allow choosing 0 even if lowerBound>0 only when no non-zero above (already handled). So once non-zero above, zero removed.
    return allowed;
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

// Ensure strict increasing (no equal adjacent) by minimally bumping later duplicates within bounds
function strictlyIncrease(values, base, orderAsc) {
  if (!values.length) return values;
  // Work in sorted order space
  const idxs = orderAsc;
  const arr = idxs.map(i => values[i]);
  const bases = idxs.map(i => base[i]);
  // Forward ensure arr[i] < arr[i+1]
  for (let i=1;i<arr.length;i++) {
    if (arr[i] <= arr[i-1]) {
      const b = bases[i];
      const hi = Math.min(100, b + 20);
      let candidate = snap5(arr[i-1] + 5);
      if (candidate > hi) {
        // Need to raise earlier chain if possible OR reduce previous while keeping ordering relative to its own lower bound
        // Try pulling previous downward if its base allows
        let j = i-1;
        while (j >=0 && candidate > hi) {
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
  // Map back
  const out = [...values];
  for (let k=0;k<idxs.length;k++) out[idxs[k]] = arr[k];
  // Final clamp per base bounds & snapping & ensure strictness one more pass
  for (let k=0;k<idxs.length;k++) {
    const i = idxs[k];
    const b = base[i];
    const lo = Math.max(0, b - 20), hi = Math.min(100, b + 20);
    out[i] = snap5(Math.min(hi, Math.max(lo, out[i])));
    if (k>0) {
      const prevIdx = idxs[k-1];
      if (out[i] <= out[prevIdx]) {
        let nv = snap5(out[prevIdx] + 5);
        if (nv > hi) nv = hi; // may compress but ordering should hold due to earlier adjustments
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
  const [dragId, setDragId] = useState(null);
  const [dragOffset, setDragOffset] = useState({x:0,y:0});
  // Previously we preserved initial horizontal ordering (no crossing). Now allow free overlap/crossing.
  const dragOrderRef = useRef(null); // retained in case future features need original snapshot

  // Dimensions logic
  function clamp01(v){ return Math.min(1, Math.max(0, v)); }

  const handleMouseDown = (e, id) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const row = rows.find(r=>r.id===id);
    if (!row) return;
    const px = row.x * rect.width;
    const py = row.y * rect.height;
    setDragOffset({ x: e.clientX - (rect.left + px), y: e.clientY - (rect.top + py) });
    setDragId(id);
    setSelectedId(id);
  // Snapshot ordering (not used for clamping anymore, but may aid future features)
  dragOrderRef.current = [...rows].sort((a,b)=>a.x-b.x).map(r=>r.id);
  };

  useEffect(()=>{
    const up = ()=> { setDragId(null); dragOrderRef.current = null; };
    const move = (e)=>{
      if (!dragId) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      let nx = (e.clientX - rect.left - dragOffset.x)/rect.width;
      let ny = (e.clientY - rect.top - dragOffset.y)/rect.height;
      nx = clamp01(nx); ny = clamp01(ny);
      // Free drag: allow crossing / reordering; only clamp to bounds
      nx = clamp01(nx);
      setRows(prev => prev.map(r=> r.id===dragId ? {...r, x:nx, y:ny} : r));
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return ()=>{ window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); };
  }, [dragId, dragOffset, rows, setRows]);

  // Violation highlighting removed earlier; now no ordering enforcement (free horizontal movement).

  return (
    <div className="mt-6">
      <h3 className="font-medium mb-2">Playfield Layout</h3>
  <div className="text-xs text-slate-600 mb-2">Drag shot blocks freely; horizontal crossing now allowed.</div>
      <div ref={canvasRef} className="relative border rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 h-96 overflow-hidden">
        {/* Underlay playfield primitives (slings, inlanes, outlanes, flippers). Coordinates are proportional to canvas size. */}
        <PlayfieldScenery />
        {rows.map(r=>{
          const sel = r.id === selectedId;
          const misordered = misorderedIds?.has(r.id);
          return (
            <div
              key={r.id}
              style={{ left: `${r.x*100}%`, top:`${r.y*100}%`, transform:'translate(-50%, -50%)' }}
              onMouseDown={(e)=>handleMouseDown(e,r.id)}
              className={`absolute cursor-move select-none px-2 py-1 rounded-lg text-[11px] shadow border bg-white ${sel?'ring-2 ring-emerald-500':''} ${misordered? 'ring-2 ring-red-500 border-red-500': 'border-slate-300'}`}
            >
              <div className="font-medium truncate max-w-[110px] text-center" title={r.type||'Select type'}>{r.type||'— Type —'}</div>
              <div className="flex gap-1 mt-0.5">
                <span className="px-1 rounded bg-slate-100">L {r.initL != null ? format2(r.initL) : '—'}</span>
                <span className="px-1 rounded bg-slate-100">R {r.initR != null ? format2(r.initR) : '—'}</span>
              </div>
              <button
                onClick={(e)=>{ e.stopPropagation(); setRows(prev=>prev.filter(x=>x.id!==r.id)); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                title="Delete shot"
              >✕</button>
            </div>
          );
        })}
        {/* Lines from flipper to selected block (rough illustration) */}
        {selectedId && (()=>{
          const r = rows.find(x=>x.id===selectedId); if(!r) return null;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) return null; // skip until measured to avoid giant scaled shapes
          const w = rect.width; const h = rect.height;
          const bx = r.x * w; const by = r.y * h;
          // Mapping: 0% = wide outer tip (rail side), 100% = narrow inner base near center drain.
          // We interpolate linearly along each flipper's center edge approximation.
          function lerp(a,b,t){return a+(b-a)*t;}
          // Left flipper adjusted closer: tip low (415,970) base high (285,835)
          const L_TIP = { x: 415, y: 970 }, L_BASE = { x: 285, y: 835 };
          // Right flipper adjusted closer: tip low (585,970) base high (715,835)
          const R_TIP = { x: 585, y: 970 }, R_BASE = { x: 715, y: 835 };
          // Inverted mapping per request: previously 0=tip,100=base. Now 0=base,100=tip.
          const Lp = (p)=>({ x: lerp(L_BASE.x, L_TIP.x, (p||0)/100)/1000*w, y: lerp(L_BASE.y, L_TIP.y, (p||0)/100)/1000*h });
          const Rp = (p)=>({ x: lerp(R_BASE.x, R_TIP.x, (p||0)/100)/1000*w, y: lerp(R_BASE.y, R_TIP.y, (p||0)/100)/1000*h });
          const leftAnchor = Lp(r.initL ?? 50);
          const rightAnchor = Rp(r.initR ?? 50);
          return (
            <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${w} ${h}`}> 
              { (r.initL ?? 0) > 0 && (()=>{
                const label = `${format2(r.initL)}`;
                const fs = 11; // match shot box number font size
                const padX = 5, padY = 2;
                const wTxt = label.length * fs * 0.6;
                const rectW = wTxt + padX*2;
                const rectH = fs + padY*2;
                const cx = leftAnchor.x; const cy = leftAnchor.y - 8;
                return (
                  <g>
                    <line x1={leftAnchor.x} y1={leftAnchor.y} x2={bx} y2={by} stroke="#0ea5e9" strokeWidth={6} />
                    <rect x={cx - rectW/2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
                    <text x={cx} y={cy - rectH/2 + fs/2 - 1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400">{label}</text>
                  </g>
                );
              })()}
              { (r.initR ?? 0) > 0 && (()=>{
                const label = `${format2(r.initR)}`;
                const fs = 11;
                const padX = 5, padY = 2;
                const wTxt = label.length * fs * 0.6;
                const rectW = wTxt + padX*2;
                const rectH = fs + padY*2;
                const cx = rightAnchor.x; const cy = rightAnchor.y - 8;
                return (
                  <g>
                    <line x1={rightAnchor.x} y1={rightAnchor.y} x2={bx} y2={by} stroke="#dc2626" strokeWidth={6} />
                    <rect x={cx - rectW/2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
                    <text x={cx} y={cy - rectH/2 + fs/2 - 1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400">{label}</text>
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
  return (
    <div className="absolute inset-0 pointer-events-none">
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

// Read-only playfield during practice: displays shot boxes at their spatial positions plus flippers & connection lines
// Hides any numeric percentages (mental model or hidden truth). Boxes show only shot type. No dragging or deletion.
function PracticePlayfield({ rows, selectedIdx, selectedSide, lastRecall }) {
  const canvasRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); }, []);
  const selectedRow = rows[selectedIdx] || null;
  return (
    <div className="mt-8">
      <h3 className="font-medium mb-2">Playfield</h3>
  <div ref={canvasRef} className="relative border rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 h-96 overflow-hidden">
        <PlayfieldScenery />
        {rows.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.x*100}%`, top:`${r.y*100}%`, transform:'translate(-50%, -50%)' }}
            className={`absolute select-none px-2 py-1 rounded-lg text-[11px] shadow border bg-white border-slate-300 ${r===selectedRow?'ring-2 ring-emerald-500':''}`}
            title={r.type}
          >
            <div className="font-medium truncate max-w-[120px] text-center" title={r.type}>{r.type || '—'}</div>
            {/* Invisible placeholder row to preserve height parity with setup editor (which shows L/R values) */}
            <div className="flex gap-1 mt-0.5 opacity-0 select-none pointer-events-none">
              <span className="px-1 rounded bg-slate-100">L 00</span>
              <span className="px-1 rounded bg-slate-100">R 00</span>
            </div>
          </div>
        ))}
  {mounted && selectedRow && selectedSide && (()=>{
          // Draw two guide lines from the shot box to the extremes (0 and 100) of the selected flipper.
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect || !rect.width || !rect.height) return null;
          const w = rect.width; const h = rect.height;
          const bx = selectedRow.x * w; const by = selectedRow.y * h;
          function lerp(a,b,t){return a+(b-a)*t;}
          // Coordinate anchors (note mapping: 0=base,100=tip in editor, but we now need both extremes).
          const L_TIP = { x: 415, y: 970 }, L_BASE = { x: 285, y: 835 };
          const R_TIP = { x: 585, y: 970 }, R_BASE = { x: 715, y: 835 };
          const Lp = (p)=>({ x: lerp(L_BASE.x, L_TIP.x, p/100)/1000*w, y: lerp(L_BASE.y, L_TIP.y, p/100)/1000*h });
          const Rp = (p)=>({ x: lerp(R_BASE.x, R_TIP.x, p/100)/1000*w, y: lerp(R_BASE.y, R_TIP.y, p/100)/1000*h });
          const isLeft = selectedSide === 'L';
          const p0 = isLeft ? Lp(0) : Rp(0);    // base extreme
            const p100 = isLeft ? Lp(100) : Rp(100); // tip extreme
          // Unified green guide color for both flippers during practice
          const stroke = '#10b981'; // emerald-500
          // Determine anchor for showing last recall value (only one value shown at a time on the active flipper).
          let recallNode = null;
          if (lastRecall && Number.isFinite(lastRecall.input)) {
            const prevRow = rows[lastRecall.idx];
            const anchor = lastRecall.side === 'L' ? Lp(lastRecall.input) : Rp(lastRecall.input);
            const label = `${format2(lastRecall.input)}`;
            const fs = 11; const padX = 5; const padY = 2; const wTxt = label.length * fs * 0.6; const rectW = wTxt + padX*2; const rectH = fs + padY*2;
            const cx = anchor.x; const cy = anchor.y - 8;
            // Dynamic yellow line endpoint reflecting timing error (early/late severity) relative to shot box.
            // Rules (described for right flipper; mirrored for left):
            // Perfect => center bottom of box.
            // Slight early => 25% to the right of center (x + 0.25*width).
            // Slight late  => 25% to the left of center (x - 0.25*width).
            // Fairly early/late => 50% (edge) to that side.
            // Very early/late => 25% beyond the edge (overshoot) past box boundary.
            // Mapping of 'early/late' sign: delta < 0 => early, delta > 0 => late per earlier logic (delta = recall - truth).
            let lineEl = null;
            if (prevRow) {
              const boxCX = prevRow.x * w; // geometric center x (box centered at r.x via translate -50%)
              const boxCY = prevRow.y * h; // geometric center y
              const boxW = 120; // heuristic width (matches earlier assumption)
              const boxH = 30;  // heuristic height
              const dirLate = lastRecall.delta > 0 ? 1 : (lastRecall.delta < 0 ? -1 : 0); // +1 late, -1 early
              let shiftSign = 0;
              if (dirLate !== 0) {
                // Right flipper (current correct behavior): early (delta<0) shifts right, late shifts left.
                // Left flipper should be mirrored: early shifts LEFT, late shifts RIGHT.
                if (lastRecall.side === 'R') {
                  shiftSign = dirLate === -1 ? 1 : -1; // unchanged
                } else {
                  // Mirror for left flipper
                  shiftSign = dirLate === -1 ? -1 : 1;
                }
              }
              const absDelta = Math.abs(lastRecall.delta);
              let endX = boxCX; // default perfect
              const endY = boxCY + boxH/2; // bottom center of box
              if (absDelta !== 0) {
                let desiredShift;
                if (absDelta === 5) desiredShift = 0.15 * boxW;
                else if (absDelta === 10) desiredShift = 0.35 * boxW; // near edge
                else desiredShift = 0.50 * boxW; // very (>=15) slight overshoot
                endX = boxCX + shiftSign * desiredShift;
              }
              // Build feedback text (reversed order): "Slight Early", "Fairly Late", etc. Perfect => "Perfect".
              let word1, word2 = null;
              if (lastRecall.severity === 'perfect') {
                word1 = 'Perfect';
              } else {
                // Capitalize helper
                const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
                word1 = cap(lastRecall.severity); // Slight / Fairly / Very
                word2 = cap(lastRecall.label);     // Early / Late
              }
              // Background sizing heuristic: width based on longest line length * charWidth approximation.
              const charW = 6; // rough average glyph width at fontSize 10 (monospace-ish approximation for sizing box)
              const longest = word2 ? Math.max(word1.length, word2.length) : word1.length;
              const padX = 6; const padY = 4;
              const textW = longest * charW;
              const lineCount = word2 ? 2 : 1;
              const lineHeight = 12; // fontSize 10 with ~1.05em dy
              const boxHeight = lineCount * lineHeight + padY*2 - (lineCount>1 ? 4 : 0); // tighten for two-line stack
              const boxWidth = textW + padX*2;
              const boxX = endX - boxWidth/2;
              const boxY = endY - 6 - padY - (lineCount>1 ? lineHeight/2 : lineHeight/2); // center above endpoint slightly
              lineEl = (
                <g>
                  <line x1={anchor.x} y1={anchor.y} x2={endX} y2={endY} stroke="#eab308" strokeWidth={4} strokeLinecap="round" />
                  <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
                  <text
                    x={endX}
                    y={boxY + padY + 9} /* first line baseline */
                    fontSize={10}
                    fontFamily="ui-sans-serif"
                    fontWeight={600}
                    textAnchor="middle"
                    fill={SEVERITY_COLORS[lastRecall.severity] || '#78350f'}
                  >
                    <tspan x={endX}>{word1}</tspan>
                    {word2 && <tspan x={endX} dy="1.05em">{word2}</tspan>}
                  </text>
                </g>
              );
            }
            recallNode = (
              <g>
                {lineEl}
                <rect x={cx - rectW/2} y={cy - rectH} width={rectW} height={rectH} rx={6} ry={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
                <text x={cx} y={cy - rectH/2 + fs/2 - 1} fontSize={fs} textAnchor="middle" fill="#000" fontFamily="ui-sans-serif" fontWeight="400">{label}</text>
              </g>
            );
          }
          return (
            <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${w} ${h}`}>
              <line x1={p0.x} y1={p0.y} x2={bx} y2={by} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
              <line x1={p100.x} y1={p100.y} x2={bx} y2={by} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
              {recallNode}
            </svg>
          );
        })()}
      </div>
    </div>
  );
}

// ---------- main component ----------
export default function App() {
  // Setup state
  // Start with no shots by default; user must explicitly add via + Add shot.
  const [rowsRaw, setRowsRaw] = useLocalStorage("pinball_rows_v1", []);
  const rows = rowsRaw; // direct;
  const setRows = (updater) => {
    setRowsRaw(prev => (typeof updater === 'function' ? updater(prev) : updater));
  };
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
  // UI local (non-persisted) state: collapsed shot type rows (store ids)
  const [collapsedTypes, setCollapsedTypes] = useState([]);
  const [collapsedLeft, setCollapsedLeft] = useState([]); // row ids whose Left % list is collapsed
  const [collapsedRight, setCollapsedRight] = useState([]); // row ids whose Right % list is collapsed
  // Playfield editor is always visible now; toggle removed
  // const [showPlayfield, setShowPlayfield] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  // One-time auto-collapse so pre-selected values (from persisted state or defaults) show as single chips, not full option lists on first load.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (didInitCollapse.current) return;
    if (!rows || !rows.length) return; // nothing yet
    // Only initialize if user hasn't interacted (arrays still empty)
    if (collapsedTypes.length || collapsedLeft.length || collapsedRight.length) { didInitCollapse.current = true; return; }
    const typeIds = rows.filter(r => !!r.type).map(r => r.id);
    const leftIds = rows.filter(r => r.initL != null).map(r => r.id);
    const rightIds = rows.filter(r => r.initR != null).map(r => r.id);
    if (typeIds.length) setCollapsedTypes(typeIds);
    if (leftIds.length) setCollapsedLeft(leftIds);
    if (rightIds.length) setCollapsedRight(rightIds);
    didInitCollapse.current = true;
  }, [rows, collapsedTypes.length, collapsedLeft.length, collapsedRight.length]);

  // Keep selectedIdx within bounds if rows shrink
  useEffect(() => {
    setSelectedIdx((idx) => (idx >= rows.length ? Math.max(0, rows.length - 1) : idx));
    setSelectedSide(s => (s === 'L' || s === 'R') ? s : 'L');
  }, [rows.length, setSelectedIdx]);

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

  // Allow pressing Enter anywhere on setup screen to start the session (if valid)
  useEffect(() => {
    if (initialized) return; // only before session starts
    function handleKey(e) {
      if (e.key === 'Enter' && !initialized && canStart) {
        // Avoid starting if user holding modifier (e.g., Shift+Enter) for potential future multiline inputs
        if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        startSession();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [initialized, canStart]);

  // Initialize hidden matrix
  function startSession() {
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
  }

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
  }, [attemptCount, driftEvery, driftMag, orderAscL, orderAscR, initialized, baseL, baseR]);

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
      setRecallError("Enter a number 0–100");
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
    setRows(prev => prev.map(r => ({...r, initL: snap5(r.initL ?? 0), initR: snap5(r.initR ?? 0)})));
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
      let v = snap5(out[i].initL ?? 0);
      if (lastNonZero === 0) {
        // zeros allowed; ensure non-decreasing relative to lastNonZero (0) trivially; any positive okay
        if (v < 0) v = 0;
      } else {
        // must be strictly greater than lastNonZero and cannot be zero
        if (v === 0 || v <= lastNonZero) v = Math.min(100, lastNonZero + 5);
      }
      out[i].initL = v;
      if (v > 0) lastNonZero = v;
    }
    // Right side normalization: strictly decreasing top -> bottom.
    let prevR = 105; // greater than max
    for (let i=0;i<out.length;i++) {
      let v = snap5(out[i].initR ?? 0);
      if (v >= prevR) v = prevR - 5; // enforce strictly less
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
  // Focus recall input when session starts (initialized true and not final phase)
  useEffect(()=>{
    if (initialized && !finalPhase) {
      // small timeout ensures element mounted after conditional render
      setTimeout(()=>{ recallInputRef.current?.focus(); recallInputRef.current?.select(); }, 0);
    }
  }, [initialized, finalPhase]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
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
              right={
                <button
                  onClick={() =>
                    setRows((r) => [
                      ...r,
                      newRow({}, r.length)
                    ])
                  }
                  className="px-3 py-1.5 text-sm rounded-xl bg-slate-900 text-white"
                >
                  + Add shot
                </button>
              }
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
                    <tr className="text-left text-slate-500">
                      <th className="p-2">Shot Type</th>
                      <th className="p-2">Left Flipper</th>
                      <th className="p-2">Right Flipper</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
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
                          draggable={!initialized}
                          onDragStart={(e)=>{ if(initialized) return; setDragRowIdx(i); setDragOverIdx(i); e.dataTransfer.effectAllowed='move'; }}
                          onDragOver={(e)=>{ if(initialized) return; e.preventDefault(); setDragOverIdx(i); }}
                          onDrop={(e)=>{ if(initialized) return; e.preventDefault(); handleRowReorder(dragRowIdx, i); setDragOverIdx(null); }}
                          onDragEnd={()=> { setDragRowIdx(null); setDragOverIdx(null); }}
                        >
                        <td className="p-2 align-top">
                          {(() => {
                            const currentBase = r.base || '';
                            const currentLocation = r.location ?? '';
                            if (!currentBase) {
                              // Stage 1: choose a base only (unsuffixed), keep list expanded
                              return (
                                <div className="flex flex-wrap gap-2 max-w-[520px]">
                                  {BASE_ELEMENTS.map(base => (
                                    <Chip
                                      key={base}
                                      active={false}
                                      onClick={() => {
                                        setRows(prev => { const next=[...prev]; next[i] = { ...next[i], base, location: '', type: buildType(base, '') }; return next; });
                                        // Do NOT collapse yet – user may now pick a location variant
                                      }}
                                    >{base}</Chip>
                                  ))}
                                </div>
                              );
                            }
                            // Stage 2: base chosen -> show unsuffixed + location variants
                            return (
                              <div className="flex flex-wrap gap-2 max-w-[520px]">
                                {/* Unsuffixed base chip */}
                                <Chip
                                  key="_base_unsuffixed"
                                  active={!currentLocation}
                                  onClick={() => {
                                    if (!currentLocation) {
                                      // Clicking again clears base entirely
                                      setRows(prev => { const next=[...prev]; next[i] = { ...next[i], base: '', location: '', type: '' }; return next; });
                                      setCollapsedTypes(list => list.filter(id => id !== r.id));
                                    } else {
                                      // Revert to unsuffixed
                                      setRows(prev => { const next=[...prev]; next[i] = { ...next[i], location: '', type: buildType(currentBase, '') }; return next; });
                                      // Expand (remove collapse) since user is at base-only stage
                                      setCollapsedTypes(list => list.filter(id => id !== r.id));
                                    }
                                  }}
                                >{currentBase}</Chip>
                                {LOCATIONS.map(loc => {
                                  const label = buildType(currentBase, loc);
                                  return (
                                    <Chip
                                      key={loc}
                                      active={currentLocation === loc}
                                      onClick={() => {
                                        if (currentLocation === loc) {
                                          // Deselect entirely (same behavior as clearing the base chip) -> return to element list stage
                                          setRows(prev => { const next=[...prev]; next[i] = { ...next[i], base: '', location: '', type: '' }; return next; });
                                          setCollapsedTypes(list => list.filter(id => id !== r.id));
                                        } else {
                                          // Select specific location variant and collapse
                                          setRows(prev => { const next=[...prev]; next[i] = { ...next[i], location: loc, type: buildType(currentBase, loc) }; return next; });
                                          setCollapsedTypes(list => list.includes(r.id) ? list : [...list, r.id]);
                                        }
                                      }}
                                    >{label}</Chip>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-2">
                          {collapsedLeft.includes(r.id) && r.initL != null ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              <Chip
                                active
                                onClick={() => {
                                  // Deselect & expand
                                  setRows(prev => { const next=[...prev]; next[i]={...next[i], initL:null}; return next; });
                                  setCollapsedLeft(list => list.filter(id => id !== r.id));
                                }}
                              >{format2(r.initL)}</Chip>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {computeAllowedValues(rows, 'L', i).map(val => (
                                <Chip
                                  key={val}
                                  active={r.initL===val}
                                  onClick={() => {
                                    const newVal = (r.initL === val) ? null : val;
                                    setRows(prev => { const next=[...prev]; next[i]={...next[i], initL:newVal}; return next; });
                                    setCollapsedLeft(list => {
                                      const has = list.includes(r.id);
                                      if (newVal != null && !has) return [...list, r.id];
                                      if (newVal == null && has) return list.filter(id => id !== r.id);
                                      return list;
                                    });
                                  }}
                                >{format2(val)}</Chip>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {collapsedRight.includes(r.id) && r.initR != null ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              <Chip
                                active
                                onClick={() => {
                                  setRows(prev => { const next=[...prev]; next[i]={...next[i], initR:null}; return next; });
                                  setCollapsedRight(list => list.filter(id => id !== r.id));
                                }}
                              >{format2(r.initR)}</Chip>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {computeAllowedValues(rows, 'R', i).map(val => (
                                <Chip
                                  key={val}
                                  active={r.initR===val}
                                  onClick={() => {
                                    const newVal = (r.initR === val) ? null : val;
                                    setRows(prev => { const next=[...prev]; next[i]={...next[i], initR:newVal}; return next; });
                                    setCollapsedRight(list => {
                                      const has = list.includes(r.id);
                                      if (newVal != null && !has) return [...list, r.id];
                                      if (newVal == null && has) return list.filter(id => id !== r.id);
                                      return list;
                                    });
                                  }}
                                >{format2(val)}</Chip>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right cursor-grab select-none" title={!initialized ? 'Drag to reorder' : ''}>
                          <button
                            onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                            className="text-slate-500 hover:text-red-600"
                            title="Remove"
                          >
                            ✕
                          </button>
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
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-sm text-slate-600">Recall</label>
                      <div className="flex items-center gap-2">
                        <NumberInput
                          ref={recallInputRef}
                          value={guess}
                          min={0}
                          max={100}
                          className={recallError ? 'border-red-500 focus:ring-red-500' : ''}
                          onChange={(v) => {
                            if (v === "" || v === null || v === undefined) {
                              // Allow clearing without showing an error immediately
                              setGuess("");
                              // Clear any prior error when user resumes editing
                              if (recallError) setRecallError("");
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isFinite(n)) {
                              // Ignore invalid keystrokes; keep previous value
                              return;
                            }
                            // Clamp into range but do not show error yet; final validation occurs on submitAttempt
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
                        <span>%</span>
                      </div>
                    </div>
                    {recallError && (
                      <div className="mt-1 ml-28 text-[11px] text-red-600">{recallError}</div>
                    )}
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
                                <div>{has ? formatPct(a.input) : '—'}</div>
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
                <PracticePlayfield rows={rows} selectedIdx={selectedIdx} selectedSide={selectedSide} lastRecall={attempts[0] || null} />
                {/* Quick recall chips (dynamic order by flipper) */}
                <div className="mt-4">
                  {(() => {
                    const values = Array.from({length:21},(_,k)=>k*5);
                    // Ordering requirement: Left flipper 0→100, Right flipper 100→0
                    const ordered = selectedSide === 'L' ? values : [...values].reverse();
                    return (
                      <div className="flex gap-1 w-full select-none">
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
