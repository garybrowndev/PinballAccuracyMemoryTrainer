import React, { useEffect, useMemo, useState } from "react";

// Pinball Accuracy Memory Trainer — single-file React app
// Local, no backend. All data in memory + localStorage.
// Styling: Tailwind utility classes. No external UI libs.

// ---------- helpers ----------
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a; // inclusive
const formatPct = (n) => `${Math.round(n)}%`;

// Stable id generator for rows to prevent input remount/focus loss
let ROW_ID_SEED = 1;
// Shot taxonomy
const SHOT_TYPES = [
  'Left Orbit','Right Orbit','Left Ramp','Right Ramp','Center Ramp','Inner Loop','Scoop','Saucer','Left Saucer','Right Saucer','Standup','Drop Target','Drop Bank','Spinner','Bumper','Target Bank','Captive Ball','VUK','Lock','Mini-Loop','Upper Loop'
];
const FLIPPERS = ['L','R']; // left/right flippers

// New row schema: per shot store both left/right initial percentages (initL, initR)
const newRow = (over = {}) => ({ id: ROW_ID_SEED++, type: 'Left Ramp', initL: 60, initR: 60, ...over });
function ensureRowIds(rows) {
  let changed = false;
  const next = rows.map(r => {
    if (r.id == null) { changed = true; return { ...r, id: ROW_ID_SEED++ }; }
    return r;
  });
  return changed ? next : rows;
}

// Legacy upgrade: rows may have name field; attempt heuristic mapping
// Upgrade legacy schemas:
// 1) Old free-text name -> {type, side, init}
// 2) Previous schema with per-row side + init -> merge by type into new structure with initL/initR
function upgradeLegacyRows(rows) {
  // First, normalize any entries missing type/side.
  const normalized = rows.map(r => {
    if (r.initL != null || r.initR != null) return r; // already new or partially new
    if (r.type && r.side != null && r.init != null) {
      // side-based legacy row
      return { id: r.id || ROW_ID_SEED++, type: r.type, side: r.side, init: r.init };
    }
    if (!r.type) {
      const name = r.name || '';
      let side = name.toLowerCase().startsWith('left') ? 'L' : name.toLowerCase().startsWith('right') ? 'R' : 'L';
      const lower = name.toLowerCase();
      let type = SHOT_TYPES.find(t => lower.includes(t.split(' ')[t.split(' ').length-1].toLowerCase())) || SHOT_TYPES[0];
      if (!type) type = SHOT_TYPES.find(t => lower.includes(t.toLowerCase().split(' ')[0])) || SHOT_TYPES[0];
      return { id: r.id || ROW_ID_SEED++, type, side, init: r.init ?? 60 };
    }
    return r;
  });
  // Merge side-based rows into per-shot objects
  const byType = new Map();
  for (const r of normalized) {
    if (r.initL != null || r.initR != null) {
      // already new style
      byType.set(r.type + ':' + (r.id || ''), r); // treat as distinct
      continue;
    }
    const key = r.type;
    if (!byType.has(key)) {
      byType.set(key, { id: r.id || ROW_ID_SEED++, type: r.type, initL: r.side === 'L' ? (r.init ?? 0) : 0, initR: r.side === 'R' ? (r.init ?? 0) : 0 });
    } else {
      const existing = byType.get(key);
      if (r.side === 'L') existing.initL = r.init ?? existing.initL;
      else existing.initR = r.init ?? existing.initR;
    }
  }
  return Array.from(byType.values());
}

function rowDisplay(r) { return r ? r.type : ''; }
function rowDisplayWithSide(r, side) { return r ? `${side === 'L' ? 'L' : 'R'} • ${r.type}` : ''; }

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
  const [randRange, setRandRange] = useLocalStorage("pinball_randRange_v1", 15);
  const [perfectTol, setPerfectTol] = useLocalStorage("pinball_tol_v1", 2);
  const [driftEvery, setDriftEvery] = useLocalStorage("pinball_driftEvery_v1", 5);
  const [driftMag, setDriftMag] = useLocalStorage("pinball_driftMag_v1", 2);
  const [driftBias, setDriftBias] = useLocalStorage("pinball_driftBias_v1", -0.5);

  const [initialized, setInitialized] = useLocalStorage("pinball_initialized_v1", false);
  // Hidden & mental per side
  const [hiddenL, setHiddenL] = useLocalStorage("pinball_hiddenL_v1", []);
  const [hiddenR, setHiddenR] = useLocalStorage("pinball_hiddenR_v1", []);
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
    const upgraded = upgradeLegacyRows(rows);
    setRows(upgraded); // persist upgrade
    const hiddenInitL = upgraded.map(r => clamp(r.initL + rndInt(-randRange, randRange)));
    const hiddenInitR = upgraded.map(r => clamp(r.initR + rndInt(-randRange, randRange)));
    const ascL = upgraded.map((r,i)=>({i,v:r.initL})).sort((a,b)=>a.v-b.v).map(x=>x.i);
    const ascR = upgraded.map((r,i)=>({i,v:r.initR})).sort((a,b)=>a.v-b.v).map(x=>x.i);
    setHiddenL(hiddenInitL); setHiddenR(hiddenInitR);
    setOrderAscL(ascL); setOrderAscR(ascR);
    setMentalL(upgraded.map(r=>r.initL));
    setMentalR(upgraded.map(r=>r.initR));
    setAttempts([]);
    setAttemptCount(0);
    setFinalPhase(false);
    setFinalRecallL(upgraded.map(r=>r.initL));
    setFinalRecallR(upgraded.map(r=>r.initR));
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

    setHiddenL(prev => {
      if (!prev.length) return prev;
      const drifted = prev.map(v=>clamp(v + (Math.random()*2 -1)*driftMag + driftBias));
      const inOrder = orderAscL.map(idx=>drifted[idx]);
      const adjusted = isotonicNonDecreasing(inOrder).map(v=>clamp(v));
      const next = [...prev];
      for (let k=0;k<orderAscL.length;k++) next[orderAscL[k]] = adjusted[k];
      return next;
    });
    setHiddenR(prev => {
      if (!prev.length) return prev;
      const drifted = prev.map(v=>clamp(v + (Math.random()*2 -1)*driftMag + driftBias));
      const inOrder = orderAscR.map(idx=>drifted[idx]);
      const adjusted = isotonicNonDecreasing(inOrder).map(v=>clamp(v));
      const next = [...prev];
      for (let k=0;k<orderAscR.length;k++) next[orderAscR[k]] = adjusted[k];
      return next;
    });
  }, [attemptCount, driftEvery, driftMag, driftBias, orderAscL, orderAscR, initialized]);

  function validatePercent(numLike) {
    const x = Number(numLike);
    if (!Number.isFinite(x)) return null;
    return clamp(x);
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
    const delta = Math.round(val - truth);
    const abs = Math.abs(delta);
    let label = "perfect";
    if (abs > perfectTol) label = delta < 0 ? "early" : "late";

    const severity = abs <= perfectTol ? "perfect" : abs <= 5 ? "slight" : abs <= 10 ? "moderate" : "severe";
    const points = Math.max(0, Math.round(100 - abs));

    const rec = { t: Date.now(), idx, side: selectedSide, input: val, truth, delta, label, severity, points };

    setAttempts((a) => [rec, ...a].slice(0, 200));
    setAttemptCount((c) => c + 1);

    // Optionally update mental model toward the input guess
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
                      ...ensureRowIds(r),
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
                    {upgradeLegacyRows(rows).map((r, i) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2 max-w-xs">
                            {SHOT_TYPES.map(t => (
                              <Chip
                                key={t}
                                active={r.type === t}
                                onClick={() => setRows(prev => { const next=[...upgradeLegacyRows(prev)]; next[i]={...next[i], type:t}; return next; })}
                              >{t}</Chip>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <NumberInput
                            value={r.initL ?? 0}
                            onChange={(v) => setRows(prev => { const next=[...upgradeLegacyRows(prev)]; const val=validatePercent(v) ?? next[i].initL; next[i]={...next[i], initL: val}; return next; })}
                          />
                        </td>
                        <td className="p-2">
                          <NumberInput
                            value={r.initR ?? 0}
                            onChange={(v) => setRows(prev => { const next=[...upgradeLegacyRows(prev)]; const val=validatePercent(v) ?? next[i].initR; next[i]={...next[i], initR: val}; return next; })}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => setRows((prev) => upgradeLegacyRows(prev).filter((_, k) => k !== i))}
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
                  <label className="w-48">Hidden randomization ±</label>
                  <NumberInput value={randRange} onChange={setRandRange} min={0} max={50} />
                  <span>%</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="w-48">Perfect tolerance ±</label>
                  <NumberInput value={perfectTol} onChange={setPerfectTol} min={0} max={10} />
                  <span>pts</span>
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="p-2 text-left">Shot</th>
                            <th className="p-2 text-right">You</th>
                            {showTruth && <th className="p-2 text-right">Truth</th>}
                            <th className="p-2 text-right">Adjust</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.id} className="border-t">
                              <td className="p-2">{r.type}</td>
                              <td className="p-2 text-right">
                                <NumberInput value={mentalL[i] ?? 0} onChange={(v)=>setMentalL(m=>{const n=[...m]; n[i]=validatePercent(v) ?? n[i] ?? 0; return n;})} />
                              </td>
                              <td className="p-2 text-right">
                                <NumberInput value={mentalR[i] ?? 0} onChange={(v)=>setMentalR(m=>{const n=[...m]; n[i]=validatePercent(v) ?? n[i] ?? 0; return n;})} />
                              </td>
                              {showTruth && (
                                <>
                                  <td className="p-2 text-right text-slate-600">{formatPct(hiddenL[i] ?? 0)}</td>
                                  <td className="p-2 text-right text-slate-600">{formatPct(hiddenR[i] ?? 0)}</td>
                                </>
                              )}
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
                        <div className="flex justify-between mb-1">
                          <div className="text-slate-600">Hidden truth</div>
                          <div>{formatPct(attempts[0].truth)}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-slate-600">Error</div>
                          <div>{attempts[0].delta > 0 ? "+" : ""}{attempts[0].delta}</div>
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
                        <th className="p-2 text-right">Delta</th>
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
                          <td className="p-2 text-right">{a.delta > 0 ? "+" : ""}{a.delta}</td>
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
// Note: actual upgrade handled inside component via ensureRowIds usage when adding new rows.
