// T3 Flight model: per aircraft category, approach speed, glideslope, standard-rate / bank-limited turns and climb rates vs docs/FLIGHT-MODEL.md.
import { Gate, approx } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { buildAirport } from '../sim/airport.js';
import { buildProcedures } from '../sim/procedures.js';
import { buildPerf, turnRate } from '../sim/perf.js';
import { Aircraft, MODES } from '../sim/aircraft.js';
import { Weather } from '../sim/weather.js';
import { RNG } from '../sim/rng.js';
import { rad, NM_FT, trackOffsets } from '../sim/geo.js';

const g = new Gate('T3', 'Flight model');
const data = loadData();
const airport = buildAirport(data.airport, data.procedures);
const perfAll = buildPerf(data.aircraft);
const env = () => ({ t: 0, wind: { dir: null, kt: 0 }, airport, weather: { visualOK: true }, events: [] });
const TYPES = ['B738', 'A320', 'B77W', 'A388', 'E75L', 'CRJ9', 'DH8D', 'B752', 'C172', 'PC12'];

/** Fly an approach to `rwy` from 14 NM, established; returns samples { d, alt, ias } per second. */
function flyFinal(perf, rwyId, mutate) {
  const rw = airport.ends[rwyId]; const e = env();
  const p = airport.finalPoint(rwyId, 14);
  const ac = new Aircraft({ id: 'T', callsign: 'TST1', telephony: 'Test', type: perf.icao, perf, kind: 'ARR', mode: MODES.APPROACH, x: p.x, y: p.y, alt: rw.elevFt + rw.tchFt + 14 * NM_FT * Math.tan(rad(rw.gsDeg)), hdg: rw.finalCourse, ias: Math.min(180, perf.vMax), runway: rwyId, tgtAlt: 4000, tgtIas: Math.min(180, perf.vMax) });
  ac.clearedApproach = true; ac.clearedLand = true; ac.approachKind = 'ILS'; mutate?.(ac);
  const samples = [];
  for (let i = 0; i < 900 && !ac.done && ac.mode !== MODES.LANDED; i++) { e.t = i; ac.step(1, e); samples.push({ d: ac.finalDistNm, alt: ac.alt, ias: ac.ias, mode: ac.mode, alongFt: ac.alongRunwayFt, onGround: ac.onGround }); if (ac.onGround) break; }
  return { samples, events: e.events, ac };
}
function measureTurn(perf, ias, alt) {
  const e = env();
  const ac = new Aircraft({ id: 'T', callsign: 'TST2', telephony: 'Test', type: perf.icao, perf, kind: 'ARR', mode: MODES.VECTOR, x: 0, y: -20, alt, hdg: 0, ias, tgtAlt: alt, tgtIas: ias });
  for (let i = 0; i < 5; i++) ac.step(1, e); // settle tas/gs
  ac.tgt.hdg = 120; ac.tgt.turn = 'R'; ac.tgt.hdgAssigned = true;
  const h0 = ac.hdg; let t = 0; while (Math.abs(ac.hdg - 120) > 0.01 && t < 300) { ac.step(1, e); t++; }
  const turned = ((120 - h0) + 360) % 360; return { rate: turned / (t - 0.5), t, tas: ac.tas };
}
function measureClimb(perf, from, to) {
  const e = env(); const ac = new Aircraft({ id: 'T', callsign: 'TST3', telephony: 'Test', type: perf.icao, perf, kind: 'DEP', mode: MODES.VECTOR, x: 0, y: -20, alt: from, hdg: 0, ias: 200, tgtAlt: to, tgtIas: 200 });
  let t = 0, a1 = null, t1 = 0, a2 = null, t2 = 0;
  while (t < 1200 && Math.abs(ac.alt - to) > 5) { ac.step(1, e); t++; const frac = (ac.alt - from) / (to - from); if (a1 == null && frac >= 0.2) { a1 = ac.alt; t1 = t; } if (a2 == null && frac >= 0.8) { a2 = ac.alt; t2 = t; } }
  return a1 != null && a2 != null ? (a2 - a1) / ((t2 - t1) / 60) : 0;
}
const gsAlt = (rw, d) => rw.elevFt + rw.tchFt + d * NM_FT * Math.tan(rad(rw.gsDeg));
const sampleAt = (samples, d) => samples.reduce((best, s) => (Math.abs(s.d - d) < Math.abs(best.d - d) ? s : best));

// ---- negatives: a wrong parameter must be caught ----
const B738 = perfAll.B738, rw28R = airport.ends['28R'];
g.negative('approach speed 20 kt fast is caught', () => { const r = flyFinal({ ...B738, vApp: B738.vApp + 20 }, '28R'); return approx(sampleAt(r.samples, 3).ias, B738.vApp, 2); });
g.negative('glideslope flown 1° steep is caught', () => { const r = flyFinal(B738, '28R', (ac) => { ac.glideslopeAlt = (e) => { const rw = e.airport.ends[ac.runway]; return rw.elevFt + rw.tchFt + Math.max(0, ac.finalDistNm ?? 0) * NM_FT * Math.tan(rad(rw.gsDeg + 1)); }; }); return approx(sampleAt(r.samples, 5).alt, gsAlt(rw28R, 5), 60); });
g.negative('a 35° bank limit is caught by the bank-limited turn check', () => { const m = measureTurn({ ...B738, maxBank: 35 }, 250, 8000); const f = Math.min(3, 1091 * Math.tan(rad(25)) / m.tas); return Math.abs(m.rate - f) / f <= 0.05; });
g.negative('a 15° bank limit (≈2°/s) is caught by the standard-rate check', () => { const m = measureTurn({ ...B738, maxBank: 15 }, 140, 3000); return approx(m.rate, 3, 0.1); });
g.negative('a climb rate 30 % off the table is caught', () => { const r = measureClimb({ ...B738, climbFpm: B738.climbFpm * 1.3 }, 3000, 8000); return Math.abs(r - B738.climbFpm) / B738.climbFpm <= 0.05; });

// ---- real checks per type ----
for (const t of TYPES) {
  const perf = perfAll[t]; if (!perf) { g.check(`type ${t} present`, false); continue; }
  const rwy = perf.small ? '28R' : '28R';
  const r = flyFinal(perf, rwy);
  const s3 = sampleAt(r.samples, 3), s5 = sampleAt(r.samples, 5), s10 = sampleAt(r.samples, 10);
  const thr = r.events.find((e) => e.type === 'THRESHOLD');
  g.check(`${t}: IAS at 3 NM = ACD approach speed ${perf.vApp} kt (±2)`, approx(s3.ias, perf.vApp, 2), `${s3.ias.toFixed(1)} kt`);
  g.check(`${t}: on the ${rw28R.gsDeg}° glideslope at 10 NM and 5 NM (±60 ft)`, approx(s10.alt, gsAlt(rw28R, 10), 60) && approx(s5.alt, gsAlt(rw28R, 5), 60), `${(s10.alt - gsAlt(rw28R, 10)).toFixed(0)} / ${(s5.alt - gsAlt(rw28R, 5)).toFixed(0)} ft`);
  g.check(`${t}: crosses the threshold near TCH ${rw28R.tchFt} ft (±40) and touches down 500–2,500 ft in`, !!thr && approx(thr.altAgl, rw28R.tchFt, 40) && r.events.some((e) => e.type === 'TOUCHDOWN' && e.fromThrFt >= 500 && e.fromThrFt <= 2500), `${thr?.altAgl} ft AGL, td ${r.events.find((e) => e.type === 'TOUCHDOWN')?.fromThrFt} ft`);
  const stdKt = perf.small ? Math.min(perf.vMax, 100) : 140; const std = measureTurn(perf, stdKt, 3000);
  g.check(`${t}: standard rate turn 3°/s at ${stdKt} kt (±0.1; the 25° bank limit takes over above ~170 kt TAS)`, approx(std.rate, 3, 0.1), `${std.rate.toFixed(2)}°/s`);
  if (!perf.small) { const fast = measureTurn(perf, 250, 8000); const f = Math.min(3, 1091 * Math.tan(rad(perf.maxBank)) / fast.tas); g.check(`${t}: bank-limited rate at 250 kt within 5 % of 1091·tan(${perf.maxBank}°)/TAS = ${f.toFixed(2)}°/s`, Math.abs(fast.rate - f) / f <= 0.05, `${fast.rate.toFixed(2)}°/s`); }
  const climb = measureClimb(perf, 3000, 8000), desc = -measureClimb(perf, 8000, 3000);
  g.check(`${t}: climb ${perf.climbFpm} fpm and descent cap ${perf.descentFpm} fpm within 5 %`, Math.abs(climb - perf.climbFpm) / perf.climbFpm <= 0.05 && Math.abs(desc - perf.descentFpm) / perf.descentFpm <= 0.05, `${climb.toFixed(0)} / ${desc.toFixed(0)} fpm`);
}
// lateral tracking: established 0.6 NM off the centreline at 12 NM must converge to < 0.05 NM by 8 NM (and a wrong-sign law is caught)
{
  const perf = perfAll.B738, rw = airport.ends['28R'];
  const fly = (mutate) => { const e = env(); const p0 = airport.finalPoint('28R', 12); const p = { x: p0.x + Math.cos(rad(rw.finalCourse)) * 0.6, y: p0.y - Math.sin(rad(rw.finalCourse)) * 0.6 };
    const ac = new Aircraft({ id: 'L', callsign: 'TST5', telephony: 'Test', type: 'B738', perf, kind: 'ARR', mode: MODES.FINAL, x: p.x, y: p.y, alt: gsAlt(rw, 12), hdg: rw.finalCourse, ias: 170, runway: '28R', tgtAlt: 4000, tgtIas: 170 });
    ac.clearedApproach = true; ac.clearedLand = true; ac.established = true; ac.finalDistNm = 12; mutate?.(ac);
    let crossAt8 = null; for (let i = 0; i < 400 && ac.finalDistNm > 7.9; i++) { e.t = i; ac.step(1, e); const { cross } = trackOffsets(rw.thr, rw.finalCourse + 180, ac); if (ac.finalDistNm <= 8 && crossAt8 == null) crossAt8 = Math.abs(cross); }
    return crossAt8 ?? 99; };
  g.negative('a wrong-sign centreline correction is caught', () => { const orig = Aircraft.prototype.trackFinal; Aircraft.prototype.trackFinal = function (env) { const h = orig.call(this, env); const rwE = env.airport.ends[this.runway]; return ((rwE.finalCourse - (h - rwE.finalCourse)) + 360) % 360; }; try { return fly() < 0.05; } finally { Aircraft.prototype.trackFinal = orig; } });
  g.check('established 0.6 NM off the centreline at 12 NM, back within 0.05 NM by 8 NM', fly() < 0.05, `${fly().toFixed(3)} NM`);
}
// 250 kt below 10,000 ft on a departure; takeoff roll lengths
{
  const perf = perfAll.B738, rw = airport.ends['1R'], e = env();
  const ac = new Aircraft({ id: 'D', callsign: 'TST4', telephony: 'Test', type: 'B738', perf, kind: 'DEP', mode: MODES.LUAW, x: rw.thr.x, y: rw.thr.y, alt: rw.elevFt, hdg: rw.hdg, ias: 0, runway: '1R', sid: { id: 'TEST', initialClimbFt: 520, route: [{ fix: 'X', x: 5, y: 20 }], topAlt: 10000 } });
  ac.modeTimer = 30; ac.clearedTakeoff = true; let maxIasBelow10k = 0;
  for (let i = 0; i < 900 && ac.alt < 10000; i++) { e.t = i; ac.step(1, e); if (ac.alt < 10000) maxIasBelow10k = Math.max(maxIasBelow10k, ac.ias); }
  const lift = e.events.find((x) => x.type === 'LIFTOFF');
  g.check('departure never exceeds 250 kt IAS below 10,000 ft (14 CFR 91.117 / AIM 4-4-12)', maxIasBelow10k <= 250.5, `${maxIasBelow10k.toFixed(0)} kt`);
  g.check('B738 liftoff after a 3,000–8,000 ft roll at Vr', !!lift && lift.rollFt >= 3000 && lift.rollFt <= 8000, `${lift?.rollFt} ft`);
}
g.finish(`${TYPES.length} types × approach speed / glideslope / TCH / turns / climb`);
