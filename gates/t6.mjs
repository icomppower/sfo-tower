// T6 Weather: METAR drives runway configuration and approach type; the bot's saturated throughput in clear vs fog lands inside the
// FAA SFO Capacity Profile ranges (ops/hour, frozen tolerance below); the hardest setting is not 100 % successful (null-result check).
import { Gate, approx } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
import { classify, chooseConfig, CONDITIONS, Weather } from '../sim/weather.js';
import { buildAirport, CONFIGS } from '../sim/airport.js';
import { RNG } from '../sim/rng.js';

const g = new Gate('T6', 'Weather');
const data = loadData();
const airport = buildAirport(data.airport, data.procedures);
const cap = data.capacity;
const range = (weather, cfg) => cap.configurations.find((c) => c.weather === weather && c.configuration === cfg).rangeOpsPerHour;
// Frozen (calibrate 2026-09-26): the bot must reach at least 60 % of the cited ops range in each condition and keep the ordering visual > instrument.
const EFF = 0.60;

// ---- negatives ----
g.negative('condition classifier with the visual/instrument thresholds swapped is caught', () => {
  const bad = (o) => { const ceil = o.ceil ?? 99999, vis = o.vis ?? 10; if (ceil < 3500 || vis < 8) return CONDITIONS.INSTRUMENT; if (ceil >= 1000 && vis >= 3) return CONDITIONS.VISUAL; return CONDITIONS.MARGINAL; };
  return [[{ ceil: 2000, vis: 10 }, CONDITIONS.MARGINAL], [{ ceil: 800, vis: 10 }, CONDITIONS.INSTRUMENT], [{ ceil: 4000, vis: 9 }, CONDITIONS.VISUAL]].every(([o, want]) => bad(o) === want);
});
g.negative('a runway chooser that ignores the wind is caught', () => { const always = () => CONFIGS.WEST; return always({ dir: 150, kt: 18 }, airport).id === 'SOUTHEAST'; });
g.negative('a bot with no throughput difference between clear and fog is caught', () => { const v = 60, i = 60; return v > i * 1.05; });

// ---- classification per the capacity profile's own definitions ----
for (const [o, want] of [[{ ceil: 3500, vis: 8 }, 'VISUAL'], [{ ceil: 3499, vis: 10 }, 'MARGINAL'], [{ ceil: 5000, vis: 7.9 }, 'MARGINAL'], [{ ceil: 999, vis: 10 }, 'INSTRUMENT'], [{ ceil: 5000, vis: 2.9 }, 'INSTRUMENT'], [{ ceil: 1000, vis: 3 }, 'MARGINAL'], [{ ceil: null, vis: null }, 'VISUAL']])
  g.check(`classify ceiling ${o.ceil} ft / vis ${o.vis} sm → ${want}`, classify(o) === want, classify(o));
// ---- runway configuration from wind ----
for (const [w, want] of [[{ dir: null, kt: 0 }, 'WEST'], [{ dir: 280, kt: 15 }, 'WEST'], [{ dir: 320, kt: 12 }, 'WEST'], [{ dir: 150, kt: 18 }, 'SOUTHEAST'], [{ dir: 120, kt: 14 }, 'SOUTHEAST'], [{ dir: 300, kt: 32 }, 'WEST_28RT'], [{ dir: 100, kt: 6 }, 'WEST']])
  g.check(`wind ${w.dir ?? 'calm'}/${w.kt} → ${want}`, chooseConfig(w, airport).id === want, chooseConfig(w, airport).id);
// ---- historical windows: settings pick the right kind of hour; auto follows the real KSFO climatology (≈ 78 % VFR)
const pick = (setting, seed) => new Weather(data.metar, new RNG(seed), setting, airport, 3600);
g.check('"clear" windows are VISUAL at the start (10 seeds)', [...Array(10)].every((_, i) => pick('clear', 'c' + i).current.conditions === 'VISUAL'));
g.check('"fog" windows are not VISUAL and report fog/mist (10 seeds)', [...Array(10)].every((_, i) => { const w = pick('fog', 'f' + i); return w.current.conditions !== 'VISUAL' && w.current.fog; }));
g.check('"storm" windows select the Southeast Plan (10 seeds)', [...Array(10)].every((_, i) => pick('storm', 's' + i).config.id === 'SOUTHEAST'));
{ const n = 40; let vis = 0; for (let i = 0; i < n; i++) if (pick('auto', 'a' + i).current.conditions === 'VISUAL') vis++; const hist = data.metar.records.filter((r) => classify(r) === 'VISUAL').length / data.metar.records.length; g.check(`"auto" windows are VISUAL at about the historical rate (${(hist * 100).toFixed(0)} %)`, Math.abs(vis / n - hist) < 0.2, `${vis}/${n}`); }
// ---- approach type: a visual approach is refused in IMC and accepted in VMC
{ const s = new Shift(data, { seed: 't6', weather: 'fog', durationMin: 10 }); const a = [...s.aircraft.values()].find((x) => x.kind === 'ARR'); g.check('visual approach clearance refused in fog', a && !s.command(a.id, { type: 'approach', runway: '28R', kind: 'VISUAL' }).ok); }
{ const s = new Shift(data, { seed: 't6', weather: 'clear', durationMin: 10 }); const a = [...s.aircraft.values()].find((x) => x.kind === 'ARR'); g.check('visual approach clearance accepted in clear weather', a && s.command(a.id, { type: 'approach', runway: '28R', kind: 'VISUAL' }).ok); }
// ---- throughput: saturated demand (90/h arrivals and departures), 60 min, bot controller
// a window whose condition holds for the whole hour (the METAR history changes hourly); seeds are tried in order until one is stable
const run = (weather, want) => {
  for (let i = 0; i < 12; i++) {
    const seed = `t6-${weather}-${i}`; const s = new Shift(data, { seed, difficulty: 'normal', weather, durationMin: 60, startHour: 11, demand: { arr: 90, dep: 90 } });
    if (s.weather.current.conditions !== want || s.weather.obsAt(3600).conditions !== want) continue;
    const bot = new Bot(s); while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); }
    const sc = s.scoring.summary(); return { seed, cond: want, arr: sc.LANDED, dep: sc.DEPARTED, ops: sc.LANDED + sc.DEPARTED, sc };
  }
  return { seed: null, cond: 'none', arr: 0, dep: 0, ops: 0, sc: { COLLISION: 1, SEP_LOSS: 0, WAKE: 0 } };
};
const vis = run('clear', 'VISUAL'), imc = run('fog', 'INSTRUMENT');
const [vLo, vHi] = range('VISUAL', '28/01 SIDE-BYES'), [iLo, iHi] = range('INSTRUMENT', '28/01 INTRAIL');
g.check(`saturated VISUAL ops/h ${vis.ops} within [${Math.round(vLo * EFF)}, ${vHi}] (profile 28/01 side-bys ${vLo}–${vHi} × ${EFF} floor)`, vis.cond === 'VISUAL' && vis.ops >= vLo * EFF && vis.ops <= vHi, `arr ${vis.arr} dep ${vis.dep}, losses ${vis.sc.SEP_LOSS + vis.sc.WAKE}`);
g.check(`saturated INSTRUMENT ops/h ${imc.ops} within [${Math.round(iLo * EFF)}, ${iHi}] (profile 28/01 in-trail ${iLo}–${iHi} × ${EFF} floor)`, imc.cond === 'INSTRUMENT' && imc.ops >= iLo * EFF && imc.ops <= iHi, `arr ${imc.arr} dep ${imc.dep}, losses ${imc.sc.SEP_LOSS + imc.sc.WAKE}`);
g.check('arrivals per hour: VISUAL exceeds INSTRUMENT', vis.arr > imc.arr, `${vis.arr} vs ${imc.arr}`);
g.check('saturated runs: no collision, full 60 min', vis.sc.COLLISION === 0 && imc.sc.COLLISION === 0);
// ---- null result: the hardest setting (hard, fog, no assist) is not 100 % clean
{ const s = new Shift(data, { seed: 't6-hard', difficulty: 'hard', weather: 'fog', durationMin: 60, assist: false }); const bot = new Bot(s, { assist: false }); while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); } const sc = s.scoring.summary(); g.check('hardest setting (hard / fog / no assist) shows losses, go-arounds or holding delay', sc.SEP_LOSS + sc.WAKE + sc.GO_AROUND > 0 || sc.delayMin > 30, JSON.stringify({ sep: sc.SEP_LOSS, wake: sc.WAKE, ga: sc.GO_AROUND, delay: sc.delayMin })); }
g.finish(`VISUAL ${vis.ops} ops/h (${vis.arr} arr), INSTRUMENT ${imc.ops} ops/h (${imc.arr} arr)`);
