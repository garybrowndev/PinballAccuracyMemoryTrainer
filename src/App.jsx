import React, { useEffect, useMemo, useState } from "react";

// Pinball Accuracy Memory Trainer — single-file React app
// Local, no backend. All data in memory + localStorage.
// Styling: Tailwind utility classes. No external UI libs.

// ---------- helpers ----------
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function snap5(v) { return Math.min(100, Math.max(0, Math.round(v / 5) * 5)); }
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a; // inclusive
const formatPct = (n) => `${Math.round(n)}%`;

// Stable id generator for rows to prevent input remount/focus loss
let ROW_ID_SEED = 1;
// Shot taxonomy
const SHOT_TYPES = [
  'Left Orbit','Right Orbit','Left Ramp','Right Ramp','Center Ramp','Inner Loop','Scoop','Saucer','Left Saucer','Right Saucer','Standup','Drop Target','Drop Bank','Spinner','Bumper','Target Bank','Captive Ball','VUK','Lock','Mini-Loop','Upper Loop'
];
const FLIPPERS = ['L','R']; // left/right flippers

// Current row schema only
const newRow = (over = {}) => ({ id: ROW_ID_SEED++, type: 'Left Ramp', initL: 60, initR: 60, ...over });

function rowDisplay(r) { return r ? r.type : ''; }
function rowDisplayWithSide(r, side) { return r ? `${side === 'L' ? 'L' : 'R'} • ${r.type}` : ''; }

// Allowed value computation per side with domain-specific ordering rules:
// Right flipper column: strictly decreasing top->bottom (earlier row must be > later row). No duplicates allowed anywhere.
// Left flipper column: ascending (later rows must be >= earlier). Zero may repeat freely until a first non-zero chosen above; once a non-zero appears above, later rows must be strictly greater than that last non-zero above (to preserve increasing difficulty sense). Multiple zeros below a non-zero are not allowed.
// All values are multiples of 5 between 0..100.
function computeAllowedValues(rows, side, index) {
  const STEP_VALUES = Array.from({length:21},(_,k)=>k*5);
  const vals = side==='L' ? rows.map(r=>r.initL) : rows.map(r=>r.initR);
  const current = vals[index];
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
    const firstPositiveAbove = earlier.find(v=>v>0);
    const maxEarlier = earlier.length ? Math.max(...earlier) : 0; // largest earlier value
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

// Isotonic regression (non-decreasing). Preserves initial order while minimally adjusting values.
function isotonicNonDecreasing(values) {
  // Pool-Adjacent-Violators algorithm
  const n = values.length;
  // Each block has {sum, count, value}
  const blocks = [];
  for (let i = 0; i < n; i++) {
    let block = { sum: values[i], count: 1, value: values[i] };
    blocks.push(block);
    // Merge while violation exists
    while (
      blocks.length >= 2 &&
      blocks[blocks.length - 2].value > blocks[blocks.length - 1].value
    ) {
      const b = blocks.pop();
      const a = blocks.pop();
      const merged = {
        sum: a.sum + b.sum,
        count: a.count + b.count,
        value: (a.sum + b.sum) / (a.count + b.count),
      };
      blocks.push(merged);
    }
  }
  // Expand blocks back to an array
  const out = new Array(n);
  let idx = 0;
  for (const bl of blocks) {
    for (let j = 0; j < bl.count; j++) out[idx++] = bl.value;
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
    } catch {}
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

const NumberInput = ({ value, onChange, min = 0, max = 100, step = 1, className = "" }) => (
  <input
    type="number"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={
      "w-24 px-2 py-1 border rounded-xl text-sm focus:outline-none focus:ring " +
      (className || "")
    }
  />
);

// Simple chip button
const Chip = ({ active, children, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors select-none ` +
      (active
        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300") +
      (className ? " " + className : "")
    }
  >
    {children}
  </button>
);

// ---------- main component ----------
export default function App() {
  // Setup state
  const [rows, setRows] = useLocalStorage("pinball_rows_v1", [
    { id: ROW_ID_SEED++, type: 'Left Ramp', initL: 70, initR: 55 },
    { id: ROW_ID_SEED++, type: 'Right Ramp', initL: 20, initR: 80 },
    { id: ROW_ID_SEED++, type: 'Left Orbit', initL: 65, initR: 40 },
  ]);
  const [driftEvery, setDriftEvery] = useLocalStorage("pinball_driftEvery_v1", 5);
  const [driftMag, setDriftMag] = useLocalStorage("pinball_driftMag_v1", 2);
  const [driftBias, setDriftBias] = useLocalStorage("pinball_driftBias_v1", -0.5);
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
  // UI local (non-persisted) state: collapsed shot type rows (store ids)
  const [collapsedTypes, setCollapsedTypes] = useState([]);

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
    const steps = Math.min(4, Math.max(0, Number(initRandSteps) || 0)); // keep within drift anchor bounds (±20 max)
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
    // pick a random starting shot for random mode
    if (mode === "random") setSelectedIdx(rndInt(0, rows.length - 1));
  }

  // Apply drift every N attempts
  useEffect(() => {
    if (!initialized) return;
    if (attemptCount === 0) return;
    if (driftEvery <= 0) return;
    if (attemptCount % driftEvery !== 0) return;
  const maxSteps = 4; // hard cap per requirements (4 * 5 = 20)
  // Defensive numeric coercion (in case stored as strings in localStorage parsing)
  const driftMagNum = Number(driftMag);
  const driftBiasNum = Number(driftBias);
  const safeMag = Number.isFinite(driftMagNum) ? driftMagNum : 0;
  const safeBias = Number.isFinite(driftBiasNum) ? driftBiasNum : 0;
  const stepDrift = () => (Math.random() < 0.5 ? -1 : 1) * rndInt(0, Math.min(maxSteps, safeMag)) * 5;

    setHiddenL(prev => {
      if (!prev.length || !baseL.length) return prev;
      const drifted = prev.map((v,i) => {
        const b = baseL[i];
        const lo = Math.max(0, b - 20), hi = Math.min(100, b + 20);
  const candidate = snap5(v + stepDrift() + safeBias);
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseL, orderAscL);
      return strictlyIncrease(ordered, baseL, orderAscL);
    });
    setHiddenR(prev => {
      if (!prev.length || !baseR.length) return prev;
      const drifted = prev.map((v,i) => {
        const b = baseR[i];
        const lo = Math.max(0, b - 20), hi = Math.min(100, b + 20);
  const candidate = snap5(v + stepDrift() + safeBias);
        return Math.min(hi, Math.max(lo, candidate));
      });
      const ordered = isotonicWithBounds(drifted, baseR, orderAscR);
      return strictlyIncrease(ordered, baseR, orderAscR);
    });
  }, [attemptCount, driftEvery, driftMag, driftBias, orderAscL, orderAscR, initialized, baseL, baseR]);

  function validatePercent(numLike) {
    const x = Number(numLike);
    if (!Number.isFinite(x)) return null;
    return snap5(x);
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

  function submitAttempt() {
    if (!initialized) return;
    const idx = mode === "random" ? selectedIdx : selectedIdx;
    const val = validatePercent(guess);
    if (val === null) return;
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

    // Prepare next random shot if in random mode
  if (mode === "random") setSelectedIdx(pickRandomIdx());

    setGuess("");
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
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Pinball Accuracy Memory Trainer</h1>
          <p className="text-sm text-slate-600 mt-1">Train recall and calibration against a hidden, drifting truth matrix.</p>
        </header>

        {/* Setup */}
        {!initialized && (
          <>
            <Section
              title="1) Define shots and initial guessed percentages"
              right={
                <button
                  onClick={() =>
                    setRows((r) => [
                      ...r,
                      newRow({ type: 'Left Ramp', initL: 60, initR: 0 })
                    ])
                  }
                  className="px-3 py-1.5 text-sm rounded-xl bg-slate-900 text-white"
                >
                  + Add shot
                </button>
              }
            >
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="p-2">Shot Type</th>
                      <th className="p-2">Left %</th>
                      <th className="p-2">Right %</th>
                      <th className="p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="p-2">
                          {collapsedTypes.includes(r.id) && r.type ? (
                            <div className="flex flex-wrap gap-2 max-w-xs">
                              <Chip
                                active
                                onClick={() => {
                                  // Deselect: clear type AND expand options again
                                  setRows(prev => { const next=[...prev]; next[i]={...next[i], type:null}; return next; });
                                  setCollapsedTypes(list => list.filter(id => id !== r.id));
                                }}
                              >{r.type}</Chip>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 max-w-xs">
                              {SHOT_TYPES.map(t => (
                                <Chip
                                  key={t}
                                  active={r.type === t}
                                  onClick={() => {
                                    const newType = (r.type === t) ? null : t; // toggle same chip off
                                    setRows(prev => { const next=[...prev]; next[i]={...next[i], type:newType}; return next; });
                                    // Collapse only if a type selected (non-null)
                                    setCollapsedTypes(list => {
                                      const has = list.includes(r.id);
                                      if (newType && !has) return [...list, r.id];
                                      if (!newType && has) return list.filter(id => id !== r.id);
                                      return list;
                                    });
                                  }}
                                >{t}</Chip>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {computeAllowedValues(rows, 'L', i).map(val => (
                              <Chip key={val} active={r.initL===val} onClick={()=>setRows(prev=>{const next=[...prev]; next[i]={...next[i], initL:val}; return next;})}>{val}</Chip>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {computeAllowedValues(rows, 'R', i).map(val => (
                              <Chip key={val} active={r.initR===val} onClick={()=>setRows(prev=>{const next=[...prev]; next[i]={...next[i], initR:val}; return next;})}>{val}</Chip>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                            className="text-slate-500 hover:text-red-600"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="2) Session parameters">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <label className="w-48">Initial random steps</label>
                  <NumberInput value={initRandSteps} onChange={setInitRandSteps} min={0} max={4} />
                  <span className="text-slate-500">(×5%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48">Drift every</label>
                  <NumberInput value={driftEvery} onChange={setDriftEvery} min={0} max={50} />
                  <span>attempts</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48">Drift magnitude</label>
                  <NumberInput value={driftMag} onChange={setDriftMag} min={0} max={10} step={0.5} />
                  <span>± pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48">Drift bias</label>
                  <NumberInput value={driftBias} onChange={setDriftBias} min={-5} max={5} step={0.5} />
                  <span>pts (negative simulates fade)</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48">Mode</label>
                  <div className="flex gap-2 flex-wrap">
                    <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>Manual</Chip>
                    <Chip active={mode === 'random'} onClick={() => setMode('random')}>Random</Chip>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={startSession}
                  className="px-4 py-2 rounded-2xl bg-emerald-600 text-white"
                >
                  Start Session
                </button>
                <button
                  onClick={() => {
                    setRows([
                      { id: ROW_ID_SEED++, type: 'Left Ramp', initL: 70, initR: 55 },
                      { id: ROW_ID_SEED++, type: 'Right Ramp', initL: 20, initR: 80 },
                      { id: ROW_ID_SEED++, type: 'Left Orbit', initL: 65, initR: 40 },
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
                  <button
                    onClick={() => setShowMentalModel((v) => !v)}
                    className="px-3 py-1.5 rounded-xl border text-sm"
                    title={showMentalModel ? "Hide your mental model" : "Show your mental model"}
                  >
                    {showMentalModel ? "Hide Model" : "Show Model"}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={showTruth}
                      onChange={(e) => setShowTruth(e.target.checked)}
                    />
                    Show hidden truth (debug)
                  </label>
                  <button onClick={endSession} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm">End session</button>
                  <button onClick={resetAll} className="px-3 py-1.5 rounded-xl border text-sm">Full reset</button>
                </div>
              }
            >
              <div className={`grid grid-cols-1 ${showMentalModel ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
                {/* Left: selection and input */}
                <div className="lg:col-span-1">
                  <div className="flex items-center gap-3 mb-3">
                    <label className="w-28 text-sm text-slate-600">Mode</label>
                    <div className="flex gap-2 flex-wrap">
                      <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>Manual</Chip>
                      <Chip active={mode === 'random'} onClick={() => setMode('random')}>Random</Chip>
                    </div>
                  </div>

                  {mode === "manual" ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-3 mb-2">
                        <label className="w-28 text-sm text-slate-600 mt-1">Shot</label>
                        <div className="flex gap-2 flex-wrap">
                          {rows.map((r, i) => (
                            <Chip key={r.id} active={selectedIdx === i} onClick={() => setSelectedIdx(i)}>
                              {r.type}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-3">
                      <label className="w-28 text-sm text-slate-600">Shot</label>
                      <div className="px-3 py-1.5 border rounded-xl text-sm flex-1">{rows[selectedIdx] ? rows[selectedIdx].type : ''}</div>
                      <button
                        onClick={() => setSelectedIdx(pickRandomIdx())}
                        className="px-3 py-1.5 rounded-xl border text-sm"
                      >
                        ↻ New
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <label className="w-28 text-sm text-slate-600">Flipper</label>
                    <div className="flex gap-2">
                      <Chip active={selectedSide==='L'} onClick={()=>setSelectedSide('L')}>Left</Chip>
                      <Chip active={selectedSide==='R'} onClick={()=>setSelectedSide('R')}>Right</Chip>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <label className="w-28 text-sm text-slate-600">Your recall</label>
                    <NumberInput value={guess} onChange={setGuess} />
                    <span>%</span>
                  </div>

                  <button
                    onClick={submitAttempt}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 text-white"
                  >
                    Submit
                  </button>
                </div>

                {/* Middle: mental model (conditionally rendered) */}
                {showMentalModel && (
                  <div className="lg:col-span-1">
                    <h3 className="font-medium mb-2">Your mental model</h3>
                    <div className="border rounded-2xl overflow-hidden">
                      <table className="w-full text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="p-2 text-left">Shot</th>
                            <th className="p-2 text-right">ML</th>
                            {showTruth && <th className="p-2 text-right">HL</th>}
                            <th className="p-2 text-right">MR</th>
                            {showTruth && <th className="p-2 text-right">HR</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.id} className="border-t">
                              <td className="p-2 whitespace-nowrap max-w-[110px] truncate" title={r.type}>{r.type}</td>
                              <td className="p-2 text-right">{formatPct(mentalL[i] ?? 0)}</td>
                              {showTruth && <td className="p-2 text-right text-slate-600">{formatPct(hiddenL[i] ?? 0)}</td>}
                              <td className="p-2 text-right">{formatPct(mentalR[i] ?? 0)}</td>
                              {showTruth && <td className="p-2 text-right text-slate-600">{formatPct(hiddenR[i] ?? 0)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Right: feedback and stats */}
                <div className="lg:col-span-1">
                  <h3 className="font-medium mb-2">Feedback</h3>
                  {attempts.length === 0 ? (
                    <div className="text-sm text-slate-600">Submit a recall to see feedback.</div>
                  ) : (
                    <div className="border rounded-2xl p-3">
                      <div className="text-sm">
                        <div className="flex justify-between mb-1">
                          <div className="text-slate-600">Last shot</div>
                          <div className="font-medium">{rowDisplayWithSide(rows[attempts[0].idx], attempts[0].side)}</div>
                        </div>
                        <div className="flex justify-between mb-1">
                          <div className="text-slate-600">Result</div>
                          <div className="font-medium capitalize">{attempts[0].label} <span className="text-slate-500">({attempts[0].severity})</span></div>
                        </div>
                        <div className="flex justify-between mb-1">
                          <div className="text-slate-600">Your recall</div>
                          <div>{formatPct(attempts[0].input)}</div>
                        </div>
                        {attempts[0].prevInput != null && (
                          <div className="flex justify-between mb-1">
                            <div className="text-slate-600">Prev recall</div>
                            <div>{formatPct(attempts[0].prevInput)}</div>
                          </div>
                        )}
                        {attempts[0].adjustRequired && (
                          <div className="flex justify-between mb-1">
                            <div className="text-slate-600">Adjustment needed</div>
                            <div className="capitalize">{attempts[0].requiredDir === -1 ? 'Lower' : attempts[0].requiredDir === 1 ? 'Higher' : 'None'}</div>
                          </div>
                        )}
                        {attempts[0].adjustRequired && (
                          <div className="flex justify-between mb-1">
                            <div className="text-slate-600">Adjustment result</div>
                            <div className={attempts[0].adjustCorrect ? 'text-emerald-600' : 'text-red-600'}>{attempts[0].adjustCorrect ? 'Correct' : 'Missed'}</div>
                          </div>
                        )}
                        <div className="flex justify-between mb-1">
                          <div className="text-slate-600">Hidden truth</div>
                          <div>{formatPct(attempts[0].truth)}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-slate-600">Error</div>
                          <div>{attempts[0].delta > 0 ? "+" : ""}{attempts[0].delta}</div>
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t">
                          <div className="text-slate-600">Points</div>
                          <div className="text-right">
                            <div>{attempts[0].points} pts</div>
                            {attempts[0].basePoints != null && (
                              <div className="text-[11px] text-slate-500">Base {attempts[0].basePoints}{attempts[0].adjustPenalty ? ` − Adj Penalty ${attempts[0].adjustPenalty}` : ''}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="border rounded-2xl p-3">
                      <div className="text-slate-600">Attempts</div>
                      <div className="text-2xl font-semibold">{attemptCount}</div>
                    </div>
                    <div className="border rounded-2xl p-3">
                      <div className="text-slate-600">Total points</div>
                      <div className="text-2xl font-semibold">{totalPoints}</div>
                    </div>
                    <div className="border rounded-2xl p-3 col-span-2">
                      <div className="text-slate-600">Avg abs error</div>
                      <div className="text-xl font-semibold">{avgAbsErr.toFixed(1)} pts</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
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

        <footer className="mt-8 text-xs text-slate-500">
          <div>Hidden matrix respects initial logical order via isotonic regression. Drift simulates gameplay changes while preserving order.</div>
        </footer>
      </div>
    </div>
  );
}

// Ensure existing stored rows (without ids) are upgraded on module load (outside component to avoid extra renders inside component body)
// (Legacy upgrade logic removed; current schema assumed.)
