// T4 Separation rules: scripted legal / illegal cases for radar separation, CWT wake (in-trail, at the threshold, departure intervals),
// same-runway (3-9-6 / 3-10-3) and one crossing-runway case. Every illegal case flagged, no legal case flagged.
import { Gate } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Aircraft, MODES } from '../sim/aircraft.js';
import { Rules, RADAR_NM } from '../sim/rules.js';
import { advance, rad, NM_FT, FT_NM } from '../sim/geo.js';
import * as rulesMod from '../sim/rules.js';

const g = new Gate('T4', 'Separation rules');
const data = loadData();
const base = new Shift(data, { seed: 't4', weather: 'clear' });
const perf = base.perf;

/** Build a bare shift in the given weather condition with no traffic. */
function scene(cond = 'VISUAL', rulesOpts = {}) {
  const s = new Shift(data, { seed: 't4', weather: cond === 'VISUAL' ? 'clear' : 'fog', durationMin: 10 });
  s.aircraft.clear(); s.events.length = 0; s.traffic.schedule = []; s.rules = new Rules(s.airport, rulesOpts);
  if (s.weather.current.conditions !== cond) s.weather.current = { ...s.weather.current, conditions: cond, visualOK: cond === 'VISUAL' };
  return s;
}
let n = 0;
const mk = (s, o) => { const ac = new Aircraft({ id: 'X' + (++n), callsign: o.cs ?? 'TST' + n, telephony: 'Test', type: o.type, perf: perf[o.type], kind: o.kind ?? 'ARR', mode: o.mode ?? MODES.VECTOR, x: o.x ?? 0, y: o.y ?? 0, alt: o.alt ?? 5000, hdg: o.hdg ?? 0, ias: o.ias ?? 200 }); Object.assign(ac, o.set ?? {}); ac.gs = ac.tas = ac.ias; s.aircraft.set(ac.id, ac); return ac; };
/** Aircraft established on final `rwy` at d NM from the threshold, on the glideslope. */
const onFinal = (s, type, rwy, d, extra = {}) => { const rw = s.airport.ends[rwy]; const p = s.airport.finalPoint(rwy, d); return mk(s, { type, mode: MODES.FINAL, x: p.x, y: p.y, alt: rw.elevFt + rw.tchFt + d * NM_FT * Math.tan(rad(rw.gsDeg)), hdg: rw.finalCourse, ias: 150, set: { runway: rwy, finalDistNm: d, established: true, clearedApproach: true, ...extra } }); };
const flags = (s, types) => { s.rules.check(s); return s.events.filter((e) => types.includes(e.type)); };
const legal = (name, s, types) => { const f = flags(s, types); g.check(`legal   ${name}`, f.length === 0, f.map((e) => e.type + ' ' + (e.nm ?? '') + (e.how ?? '')).join('; ')); };
const illegal = (name, s, types) => { const f = flags(s, types); g.check(`illegal ${name}`, f.length > 0 && f.every((e) => types.includes(e.type)), f.map((e) => e.type + ' ' + (e.nm ?? '') + (e.how ?? '')).join('; ') || 'not flagged'); return f; };
const SEP = ['SEP_LOSS', 'WAKE'], RWY = ['RUNWAY_INCURSION', 'CROSSING_CONFLICT'];

function scenarios(build) {
  // ---- radar (5-5-4): 3 NM or 1,000 ft
  { const s = scene(); mk(s, { type: 'B738', x: 10, y: 10, alt: 6000 }); mk(s, { type: 'A320', x: 13.3, y: 10, alt: 6000 }); build('radar 3.3 NM same altitude', s, SEP, true); }
  { const s = scene(); mk(s, { type: 'B738', x: 10, y: 10, alt: 6000 }); mk(s, { type: 'A320', x: 12.0, y: 10, alt: 7100 }); build('radar 2.0 NM, 1,100 ft apart', s, SEP, true); }
  { const s = scene(); mk(s, { type: 'B738', x: 10, y: 10, alt: 6000 }); mk(s, { type: 'A320', x: 12.8, y: 10, alt: 6500 }); build('radar 2.8 NM, 500 ft', s, SEP, false); }
  // ---- final: 2.5 NM inside 10 NM, 3 NM outside (5-5-4 i); same runway; VISUAL
  { const s = scene(); onFinal(s, 'A320', '28R', 6); onFinal(s, 'A320', '28R', 8.6); build('final same runway 2.6 NM inside 10 NM', s, SEP, true); }
  { const s = scene(); onFinal(s, 'A320', '28R', 6); onFinal(s, 'A320', '28R', 8.3); build('final same runway 2.3 NM inside 10 NM', s, SEP, false); }
  { const s = scene(); onFinal(s, 'A320', '28R', 12); onFinal(s, 'A320', '28R', 14.7); build('final same runway 2.7 NM outside 10 NM (needs 3)', s, SEP, false); }
  // ---- wake in trail on final, TBL 5-5-1 (28L/28R < 2,500 ft apart count as one runway)
  { const s = scene(); onFinal(s, 'B77W', '28R', 8); onFinal(s, 'B738', '28R', 11.1); build('wake B (B77W) → F (B738) 3.1 NM (needs 5)', s, SEP, false); }
  { const s = scene(); onFinal(s, 'B77W', '28R', 8); onFinal(s, 'B738', '28R', 13.2); build('wake B → F 5.2 NM', s, SEP, true); }
  { const s = scene(); onFinal(s, 'B77W', '28L', 8); onFinal(s, 'B738', '28R', 11.5); build('wake B on 28L → F on 28R 3.5 NM (parallels 750 ft apart = one runway)', s, SEP, false); }
  { const s = scene(); onFinal(s, 'A388', '28R', 8); onFinal(s, 'B738', '28R', 14.5); build('wake A (A388) → F 6.5 NM (needs 7)', s, SEP, false); }
  { const s = scene(); onFinal(s, 'A388', '28R', 8); onFinal(s, 'B738', '28R', 15.2); build('wake A → F 7.2 NM', s, SEP, true); }
  { const s = scene(); onFinal(s, 'B752', '28R', 8); onFinal(s, 'C172', '28R', 11.5); build('wake E (B757) → I (C172) 3.5 NM (needs 4)', s, SEP, false); }
  { const s = scene(); onFinal(s, 'B752', '28R', 8); onFinal(s, 'C172', '28R', 12.2); build('wake E → I 4.2 NM', s, SEP, true); }
  { const s = scene(); onFinal(s, 'B752', '28R', 8); onFinal(s, 'B738', '28R', 10.6); build('E (B757) → F (B738) has no wake minimum: 2.6 NM inside 10 NM is legal', s, SEP, true); }
  { const s = scene(); onFinal(s, 'B763', '28R', 8); onFinal(s, 'E75L', '28R', 11.2); build('wake C (B767) → G (E175) 3.2 NM (needs 3.5)', s, SEP, false); }
  { const s = scene(); onFinal(s, 'B763', '28R', 8); onFinal(s, 'E75L', '28R', 11.7); build('wake C → G 3.7 NM', s, SEP, true); }
  // ---- wake directly behind, not on final (5-5-4 g): within 2,500 ft laterally and < 1,000 ft below
  { const s = scene(); mk(s, { type: 'B77W', x: 10, y: 20, alt: 8000, hdg: 90 }); mk(s, { type: 'B738', x: 6, y: 20, alt: 7500, hdg: 90 }); build('wake directly behind B, 4 NM, 500 ft below (needs 5)', s, SEP, false); }
  { const s = scene(); mk(s, { type: 'B77W', x: 10, y: 20, alt: 8000, hdg: 90 }); mk(s, { type: 'B738', x: 6, y: 20, alt: 6500, hdg: 90 }); build('4 NM behind B but 1,500 ft below: no wake, radar ok', s, SEP, true); }
  { const s = scene(); mk(s, { type: 'B77W', x: 10, y: 20, alt: 8000, hdg: 90 }); mk(s, { type: 'B738', x: 6, y: 20, alt: 8000, hdg: 90 }); build('wake directly behind B, 4 NM, same altitude', s, SEP, false); }
  // ---- wake at the threshold, TBL 5-5-2 (checked when the leader crosses the threshold)
  for (const [lt, ft, d, ok, note] of [['B763', 'C172', 5.5, false, 'C → I 5.5 (needs 6)'], ['B763', 'C172', 6.3, true, 'C → I 6.3'], ['B738', 'C172', 3.5, false, 'F → I 3.5 (needs 4)'], ['B738', 'C172', 4.2, true, 'F → I 4.2'], ['B77W', 'B738', 4.5, false, 'B → F 4.5 (needs 5)'], ['B77W', 'B738', 5.2, true, 'B → F 5.2']]) {
    const s = scene(); const lead = onFinal(s, lt, '28R', 0.0); onFinal(s, ft, '28R', d); s.t = 100; s.events.push({ t: 100, type: 'THRESHOLD', ac: lead.id, runway: '28R' }); build(`threshold wake ${note}`, s, SEP, ok);
  }
  // ---- same runway departure (3-9-6): preceding departure airborne 7,000 ft ahead (cat III/III needs 6,000) vs 5,000
  for (const [ahead, ok] of [[7000, true], [5000, false]]) {
    const s = scene(); const rw = s.airport.ends['1R']; const p = advance(rw.thr, rw.hdg, ahead * FT_NM);
    const lead = mk(s, { type: 'B738', kind: 'DEP', mode: MODES.TAKEOFF, x: p.x, y: p.y, alt: rw.elevFt + 300, hdg: rw.hdg, ias: 160, set: { runway: '1R', onRunway: rw.physical, liftoffAt: 90, rollStartAt: 50, rolledFt: ahead, alongRunwayFt: ahead, onGround: false } });
    const dep = mk(s, { type: 'A320', kind: 'DEP', mode: MODES.TAKEOFF, x: rw.thr.x, y: rw.thr.y, alt: rw.elevFt, hdg: rw.hdg, ias: 0, set: { runway: '1R', onRunway: rw.physical, rollStartAt: 100, rolledFt: 0 } });
    s.t = 100; s.events.push({ t: 100, type: 'ROLL_START', ac: dep.id, runway: '1R' }); build(`same runway departure behind airborne departure ${ahead} ft ahead`, s, RWY, ok);
  }
  // ---- same runway arrival (3-10-3): crossing the threshold with the previous arrival still rolling
  for (const [cleared, ok] of [[true, true], [false, false]]) {
    const s = scene(); const rw = s.airport.ends['28R']; const p = advance(rw.thr, rw.hdg, 5000 * FT_NM);
    mk(s, { type: 'B738', mode: MODES.ROLLOUT, x: p.x, y: p.y, alt: rw.elevFt, hdg: rw.hdg, ias: 60, set: { runway: '28R', onRunway: rw.physical, onGround: true, alongRunwayFt: 5000, thresholdCrossedAt: 40, clearedRunwayAt: cleared ? 95 : null } });
    const arr = onFinal(s, 'A320', '28R', 0.0); s.t = 100; s.events.push({ t: 100, type: 'THRESHOLD', ac: arr.id, runway: '28R' }); build(`arrival over the threshold, previous arrival ${cleared ? 'clear of' : 'still on'} the runway`, s, RWY, ok);
  }
  // ---- departure wake time intervals (3-9-6 f/g): behind a B (heavy) departure on the same runway
  for (const [lt, ft, secs, ok, note] of [['B77W', 'B738', 100, false, 'B → F 100 s (needs 120)'], ['B77W', 'B738', 130, true, 'B → F 130 s'], ['A388', 'B738', 170, false, 'A → F 170 s (needs 180)'], ['A388', 'B738', 190, true, 'A → F 190 s'], ['B752', 'C172', 100, false, 'E → I 100 s (needs 120)'], ['B752', 'B738', 60, true, 'E → F 60 s: no interval']]) {
    const s = scene(); const rw = s.airport.ends['1R']; const far = advance(rw.thr, rw.hdg, 4);
    mk(s, { type: lt, kind: 'DEP', mode: MODES.SID, x: far.x, y: far.y, alt: 3000, hdg: rw.hdg, ias: 220, set: { runway: '1R', liftoffAt: 200 - secs + 35, rollStartAt: 200 - secs, rolledFt: 25000 } });
    const dep = mk(s, { type: ft, kind: 'DEP', mode: MODES.TAKEOFF, x: rw.thr.x, y: rw.thr.y, alt: rw.elevFt, hdg: rw.hdg, ias: 0, set: { runway: '1R', onRunway: rw.physical, rollStartAt: 200, rolledFt: 0 } });
    s.rules.lastRoll[s.aircraft.keys().next().value] = 200 - secs; s.t = 200; s.events.push({ t: 200, type: 'ROLL_START', ac: dep.id, runway: '1R' }); build(`departure interval ${note}`, s, SEP, ok);
  }
  // ---- crossing runway (3-9-8): 1R departure rolls while a 28L arrival is still short of the intersection / already past it
  for (const [along, ok] of [[3000, false], [5500, true]]) {
    const s = scene(); const rw28 = s.airport.ends['28L'], rw1 = s.airport.ends['1R']; const p = advance(rw28.thr, rw28.hdg, along * FT_NM);
    mk(s, { type: 'B738', mode: MODES.ROLLOUT, x: p.x, y: p.y, alt: rw28.elevFt, hdg: rw28.hdg, ias: 70, set: { runway: '28L', onRunway: rw28.physical, onGround: true, alongRunwayFt: along, thresholdCrossedAt: 60 } });
    const dep = mk(s, { type: 'A320', kind: 'DEP', mode: MODES.TAKEOFF, x: rw1.thr.x, y: rw1.thr.y, alt: rw1.elevFt, hdg: rw1.hdg, ias: 0, set: { runway: '1R', onRunway: rw1.physical, rollStartAt: 100, rolledFt: 0 } });
    s.t = 100; s.events.push({ t: 100, type: 'ROLL_START', ac: dep.id, runway: '1R' }); build(`1R rolls with 28L arrival at ${along} ft (intersection at ${Math.round(s.airport.intersecting('1R', '28L').fromThrFt['28L'])} ft)`, s, RWY, ok);
  }
  // ---- collision
  { const s = scene(); mk(s, { type: 'B738', x: 10, y: 10, alt: 6000 }); mk(s, { type: 'A320', x: 10.03, y: 10, alt: 6050 }); build('collision 0.03 NM / 50 ft', s, ['COLLISION'], false); }
}

// ---- negatives: a broken rule set must fail the library ----
function libraryPasses(patch) {
  let fails = 0; const saved = {};
  for (const [k, v] of Object.entries(patch)) { saved[k] = Rules.prototype[k]; if (v) Rules.prototype[k] = v; }
  try { scenarios((name, s, types, ok) => { const f = flags(s, types); if (ok ? f.length > 0 : f.length === 0) fails++; }); } finally { for (const [k, v] of Object.entries(saved)) Rules.prototype[k] = v; }
  return fails === 0;
}
g.negative('radar minimum lowered to 2 NM is caught', () => { const orig = Rules.prototype.requiredNm; return libraryPasses({ requiredNm(a, b, w) { const r = orig.call(this, a, b, w); return r === RADAR_NM ? 2 : r; } }); });
g.negative('wake matrices ignored is caught', () => { const orig = Rules.prototype.requiredNm; return libraryPasses({ requiredNm(a, b, w) { return Math.min(orig.call(this, a, b, w), RADAR_NM); }, checkThreshold() {} }); });
g.negative('same-runway checks disabled is caught', () => libraryPasses({ checkRollStart() {}, checkThreshold() {} }));
g.negative('crossing protection off is caught', () => { let fails = 0; scenarios((name, s, types, ok) => { if (!name.startsWith('1R rolls')) return; s.rules.protectionOff = true; const f = flags(s, types); if (ok ? f.length > 0 : f.length === 0) fails++; }); return fails === 0; });
g.negative('a wake case injected into a legal scene is flagged (library is sensitive)', () => { let flagged = false; const s = scene(); onFinal(s, 'A388', '28R', 8); onFinal(s, 'B738', '28R', 11); flagged = flags(s, SEP).length > 0; return !flagged; });

// ---- real run ----
let count = 0;
scenarios((name, s, types, ok) => { count++; ok ? legal(name, s, types) : illegal(name, s, types); });
g.finish(`${count} scenarios (legal + illegal), radar / wake / same-runway / crossing / collision`);
