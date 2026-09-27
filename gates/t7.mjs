// T7 Bot shift: the rules-following bot works a full seeded 60-min shift at each difficulty; zero collisions and zero separation losses
// on easy (6 seeds); measurable separation losses without assists on hard; normal in between.
import { Gate } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';

const g = new Gate('T7', 'Bot shift');
const data = loadData();
const run = (seed, difficulty, weather, opts = {}) => { const s = new Shift(data, { seed, difficulty, weather, durationMin: 60, ...opts }); const bot = new Bot(s, opts.assist === false ? { assist: false } : {}); while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); } const sc = s.scoring.summary(); const arr = s.events.filter((e) => e.type === 'SPAWN' && e.kind === 'ARR').length; return { sc, arr, t: s.t, cond: s.weather.current.conditions, cfg: s.config.id }; };
const losses = (r) => r.sc.SEP_LOSS + r.sc.WAKE + r.sc.RUNWAY_INCURSION + r.sc.CROSSING_CONFLICT + r.sc.COLLISION;

// ---- negatives ----
g.negative('a bot that never clears anyone to land is caught (nothing lands, everything is lost)', () => { const s = new Shift(data, { seed: 't7-neg', difficulty: 'easy', weather: 'clear', durationMin: 60 }); while (!s.finished) s.step(60); return s.scoring.summary().LANDED >= 5; });
g.negative('a bot with the crossing check removed is caught by the rules', () => { const s = new Shift(data, { seed: 't7-neg2', difficulty: 'normal', weather: 'clear', durationMin: 40 }); const bot = new Bot(s); bot.handleDeparture = function (d) { if (d.mode === 'QUEUE') this.cmd(d, { type: 'luaw' }); else if (d.mode === 'LUAW' && d.onRunway) this.cmd(d, { type: 'takeoff' }); }; while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); } const sc = s.scoring.summary(); return sc.CROSSING_CONFLICT + sc.RUNWAY_INCURSION + sc.COLLISION === 0; });
g.negative('a bot that releases without spacing is caught', () => { const s = new Shift(data, { seed: 't7-neg3', difficulty: 'normal', weather: 'clear', durationMin: 40 }); const bot = new Bot(s); bot.spacingFor = () => 0.5; while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); } const sc = s.scoring.summary(); return sc.SEP_LOSS + sc.WAKE + sc.COLLISION === 0; });

// ---- easy: six seeds, clean and productive ----
for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
  const r = run(seed, 'easy', 'clear');
  g.check(`easy/${seed} (${r.cfg} ${r.cond}, ${r.arr} arrivals): 0 losses, 0 collisions, ≥ 70 % landed, full 60 min`, losses(r) === 0 && r.sc.COLLISION === 0 && r.t === 3600 && r.sc.LANDED >= Math.floor(r.arr * 0.7) - 2, `landed ${r.sc.LANDED}/${r.arr}, dep ${r.sc.DEPARTED}, sep ${r.sc.SEP_LOSS}, wake ${r.sc.WAKE}, incur ${r.sc.RUNWAY_INCURSION}, cross ${r.sc.CROSSING_CONFLICT}, GA ${r.sc.GO_AROUND}, delay ${r.sc.delayMin} min`);
}
for (const [seed, weather] of [['a', 'fog'], ['b', 'fog'], ['c', 'storm']]) {
  const r = run(seed, 'easy', weather);
  g.check(`easy/${seed}/${weather} (${r.cfg} ${r.cond}): 0 losses, 0 collisions`, losses(r) === 0 && r.t === 3600, `landed ${r.sc.LANDED}/${r.arr}, sep ${r.sc.SEP_LOSS}, wake ${r.sc.WAKE}, cross ${r.sc.CROSSING_CONFLICT}`);
}
// ---- normal: no collisions, few losses
for (const seed of ['a', 'b', 'c']) { const r = run(seed, 'normal', 'clear'); g.check(`normal/${seed}: no collision, ≤ 3 separation losses, ≥ 45 % landed (busy hours run at runway capacity with a full pipeline at the end)`, r.sc.COLLISION === 0 && losses(r) <= 3 && r.sc.LANDED >= Math.floor(r.arr * 0.45) - 1, `landed ${r.sc.LANDED}/${r.arr}, losses ${losses(r)}, GA ${r.sc.GO_AROUND}, delay ${r.sc.delayMin} min`); }
// ---- hard without assist: measurable losses (the bot reacts to positions only)
{ const rs = ['a', 'b', 'c'].map((seed) => run(seed, 'hard', 'clear', { assist: false })); const tot = rs.reduce((n, r) => n + r.sc.SEP_LOSS + r.sc.WAKE, 0); g.check('hard / no assist (3 seeds): measurable separation losses, no shift ends in a collision before 30 min', tot >= 3 && rs.every((r) => r.t >= 1800), rs.map((r) => `${r.arr} arr, sep ${r.sc.SEP_LOSS}, wake ${r.sc.WAKE}, coll ${r.sc.COLLISION}, t ${r.t}`).join(' | ')); }
g.finish('easy ×9 clean, normal ×3 bounded, hard ×3 measurable losses');
