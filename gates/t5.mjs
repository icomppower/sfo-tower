// T5 SFO runway ops: crossing-runway protection (3-9-8 / 3-10-4) between 1L/1R departures and 28L/28R arrivals, runway occupancy
// (3-9-6 / 3-10-3), LUAW behaviour. Negative: protection off must fail; occupancy off must fail.
import { Gate } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
import { Aircraft, MODES } from '../sim/aircraft.js';
import { Rules } from '../sim/rules.js';
import { advance, rad, NM_FT, FT_NM } from '../sim/geo.js';

const g = new Gate('T5', 'SFO runway ops');
const data = loadData();
const base = new Shift(data, { seed: 't5', weather: 'clear' }); const perf = base.perf;
let n = 0;
function scene(rulesOpts = {}) { const s = new Shift(data, { seed: 't5', weather: 'clear', durationMin: 10 }); s.aircraft.clear(); s.events.length = 0; s.traffic.schedule = []; s.rules = new Rules(s.airport, rulesOpts); return s; }
const mk = (s, o) => { const ac = new Aircraft({ id: 'X' + (++n), callsign: o.cs ?? 'TST' + n, telephony: 'Test', type: o.type, perf: perf[o.type], kind: o.kind ?? 'ARR', mode: o.mode ?? MODES.VECTOR, x: o.x ?? 0, y: o.y ?? 0, alt: o.alt ?? 5000, hdg: o.hdg ?? 0, ias: o.ias ?? 200 }); Object.assign(ac, o.set ?? {}); ac.gs = ac.tas = ac.ias; s.aircraft.set(ac.id, ac); return ac; };
const onFinal = (s, type, rwy, d, extra = {}) => { const rw = s.airport.ends[rwy]; const p = s.airport.finalPoint(rwy, d); return mk(s, { type, mode: MODES.FINAL, x: p.x, y: p.y, alt: rw.elevFt + rw.tchFt + d * NM_FT * Math.tan(rad(rw.gsDeg)), hdg: rw.finalCourse, ias: 145, set: { runway: rwy, finalDistNm: d, established: true, clearedApproach: true, clearedLand: true, ...extra } }); };
const depAtThr = (s, type, rwy, mode = MODES.TAKEOFF, extra = {}) => { const rw = s.airport.ends[rwy]; return mk(s, { type, kind: 'DEP', mode, x: rw.thr.x, y: rw.thr.y, alt: rw.elevFt, hdg: rw.hdg, ias: 0, set: { runway: rwy, onRunway: rw.physical, rolledFt: 0, alongRunwayFt: 0, ...extra } }); };
const rolling = (s, type, rwy, alongFt, extra = {}) => { const rw = s.airport.ends[rwy]; const p = advance(rw.thr, rw.hdg, alongFt * FT_NM); return mk(s, { type, mode: MODES.ROLLOUT, x: p.x, y: p.y, alt: rw.elevFt, hdg: rw.hdg, ias: 70, set: { runway: rwy, onRunway: rw.physical, onGround: true, alongRunwayFt: alongFt, thresholdCrossedAt: 40, ...extra } }); };
const roll = (s, dep) => { s.t = 100; dep.rollStartAt = 100; s.events.push({ t: 100, type: 'ROLL_START', ac: dep.id, runway: dep.runway }); s.rules.check(s); return s.events.filter((e) => ['CROSSING_CONFLICT', 'RUNWAY_INCURSION', 'WAKE'].includes(e.type)); };
const threshold = (s, arr) => { s.t = 100; s.events.push({ t: 100, type: 'THRESHOLD', ac: arr.id, runway: arr.runway }); s.rules.check(s); return s.events.filter((e) => ['CROSSING_CONFLICT', 'RUNWAY_INCURSION'].includes(e.type)); };
const sect = base.airport.intersecting('1R', '28L');
const tCross = (dep) => Math.sqrt(2 * sect.fromThrFt[dep.runway] / (dep.perf.accelGround * 1.6878)); // standing start to the intersection (s)

function scenarios(build, opts = {}) {
  // ---- departure roll vs arrival on final to the crossing runway (3-10-4 anticipation): conflict iff the arrival reaches its threshold before the departure clears the intersection (+5 s)
  for (const eta of [15, 30, 45, 60, 90, 150]) {
    const s = scene(opts); const dep = depAtThr(s, 'B738', '1R'); const d = eta * 145 / 3600; onFinal(s, 'A320', '28L', d);
    const need = tCross(dep) + 5; build(`1R rolls with a 28L arrival ${eta} s from its threshold (needs > ${need.toFixed(0)} s)`, roll(s, dep), eta > need);
  }
  // ---- departure roll vs arrival already rolling on 28L: short of / past the intersection / holding short / exited
  for (const [along, ias, cleared, ok, note] of [[2500, 80, null, false, 'rolling 2,500 ft, short of the 4,590 ft intersection'], [5200, 60, null, true, 'past the intersection'], [3800, 0, null, true, 'stopped short of the intersection (holding short)'], [3500, 30, 95, true, 'exited at a taxiway before the intersection']]) {
    const s = scene(opts); const dep = depAtThr(s, 'B738', '1R'); rolling(s, 'A320', '28L', along, { ias, clearedRunwayAt: cleared }); build(`1R rolls with a 28L arrival ${note}`, roll(s, dep), ok);
  }
  // ---- arrival crosses the 28L threshold with a 1R departure on the ground / airborne (3-10-4)
  for (const [rolled, liftoff, hdgOff, ok, note] of [[1500, null, 0, false, 'rolling, 1,500 ft down 1R (short of the intersection)'], [4800, 60, 0, true, 'airborne past the intersection'], [3000, 70, 25, true, 'airborne and turning 25° away'], [0, null, 0, true, 'lined up and waiting (not moving)']]) {
    const s = scene(opts); const rw = s.airport.ends['1R']; const p = advance(rw.thr, rw.hdg, rolled * FT_NM);
    mk(s, { type: 'B738', kind: 'DEP', mode: rolled === 0 ? MODES.LUAW : MODES.TAKEOFF, x: p.x, y: p.y, alt: rw.elevFt + (liftoff ? 200 : 0), hdg: rw.hdg + hdgOff, ias: rolled === 0 ? 0 : 140, set: { runway: '1R', onRunway: rw.physical, rolledFt: rolled, alongRunwayFt: rolled, liftoffAt: liftoff, rollStartAt: liftoff ? 40 : 90, onGround: !liftoff } });
    const arr = onFinal(s, 'A320', '28L', 0.0); build(`28L arrival over the threshold, 1R departure ${note}`, threshold(s, arr), ok);
  }
  // ---- runway occupancy (3-10-3 / 3-9-6): same runway
  { const s = scene(opts); rolling(s, 'B738', '28R', 6000, { ias: 50 }); const arr = onFinal(s, 'A320', '28R', 0.0); build('28R arrival over the threshold with the previous arrival still rolling at 6,000 ft (cat III)', threshold(s, arr), false); }
  { const s = scene(opts); rolling(s, 'B738', '28R', 7000, { ias: 30, clearedRunwayAt: 95 }); const arr = onFinal(s, 'A320', '28R', 0.0); build('28R arrival over the threshold, previous arrival exited', threshold(s, arr), true); }
  { const s = scene(opts); const dep = depAtThr(s, 'B738', '1L'); depAtThr(s, 'A320', '1L', MODES.LUAW, { x: advance(s.airport.ends['1L'].thr, s.airport.ends['1L'].hdg, 0.3).x, y: advance(s.airport.ends['1L'].thr, s.airport.ends['1L'].hdg, 0.3).y, alongRunwayFt: 1800 }); build('1L departure rolls with another aircraft lined up ahead on 1L', roll(s, dep), false); }
  { const s = scene(opts); const dep = depAtThr(s, 'B738', '1L'); rolling(s, 'A320', '28R', 5600, { ias: 40 }); build('1L rolls while a 28R arrival is past the 28R×1L intersection (5,338 ft)', roll(s, dep), true); }
}

// ---- negatives ----
const lib = (opts) => { let bad = 0; scenarios((name, flags, ok) => { if (ok ? flags.length > 0 : flags.length === 0) bad++; }, opts); return bad === 0; };
g.negative('crossing protection off is caught', () => lib({ protectionOff: true }));
g.negative('occupancy / same-runway checks removed are caught', () => { const o1 = Rules.prototype.checkThreshold, o2 = Rules.prototype.checkRollStart; Rules.prototype.checkThreshold = function () {}; Rules.prototype.checkRollStart = function () {}; try { return lib({}); } finally { Rules.prototype.checkThreshold = o1; Rules.prototype.checkRollStart = o2; } });
g.negative('a slower departure acceleration (longer time to the intersection) changes the 45 s verdict', () => { const s = scene(); const dep = depAtThr(s, 'B738', '1R'); dep.perf = { ...dep.perf, accelGround: 1.2 }; onFinal(s, 'A320', '28L', 45 * 145 / 3600); return roll(s, dep).length === 0; });

// ---- library ----
let count = 0; scenarios((name, flags, ok) => { count++; g.check(`${ok ? 'legal  ' : 'illegal'} ${name}`, ok ? flags.length === 0 : flags.length > 0, flags.map((f) => f.type + ' ' + (f.how ?? '')).join('; ') || (ok ? '' : 'not flagged')); });
// ---- bot shift: the rules-following bot never triggers crossing conflicts or incursions on easy (protection on); with protection off, the same shift still runs (the checks are what would catch it)
{
  const run = (rules) => { const s = new Shift(data, { seed: 't5-bot', difficulty: 'easy', weather: 'clear', durationMin: 60, rules }); const bot = new Bot(s); while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); } return s; };
  const s = run({}); const sc = s.scoring.summary();
  g.check('bot works a 60-min easy shift with 0 crossing conflicts and 0 runway incursions while launching 1L/1R departures between 28L/28R arrivals', sc.CROSSING_CONFLICT === 0 && sc.RUNWAY_INCURSION === 0 && sc.DEPARTED >= 8 && sc.LANDED >= 5, `landed ${sc.LANDED}, departed ${sc.DEPARTED}, crossing ${sc.CROSSING_CONFLICT}, incursions ${sc.RUNWAY_INCURSION}`);
  const rolls = s.events.filter((e) => e.type === 'ROLL_START' && ['1L', '1R'].includes(e.runway)).length;
  g.check('at least 6 departures rolled on 1L/1R across the 28 arrival stream', rolls >= 6, String(rolls));
}
g.finish(`${count} crossing / occupancy scenarios + bot shift`);
