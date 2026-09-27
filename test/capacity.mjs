// Saturated-demand throughput: node test/capacity.mjs <weather> [minutes] [seed] — arrivals and departures offered at 90/h each.
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
const [weather = 'clear', minutes = '60', seed = 'cap'] = process.argv.slice(2);
const s = new Shift(loadData(), { seed, difficulty: 'normal', weather, durationMin: +minutes, startHour: 11, demand: { arr: 90, dep: 90 } });
const bot = new Bot(s); while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); }
const sc = s.scoring.summary(); const hrs = s.t / 3600;
const thr = s.events.filter((e) => e.type === 'THRESHOLD').map((e) => e.t); const gaps = thr.slice(1).map((t, i) => t - thr[i]).sort((x, y) => x - y); console.log('  threshold gaps: median', gaps[Math.floor(gaps.length / 2)], 's, ≤40 s', gaps.filter((g) => g <= 40).length, 'of', gaps.length, '| heavies landed', s.events.filter((e) => e.type === 'LANDED' && /^[A-D]$/.test(s.aircraft.get(e.ac)?.cwt ?? 'F')).length);
console.log(`${weather} ${s.config.id} ${s.weather.current.conditions} t=${s.t}s: arrivals ${(sc.LANDED / hrs).toFixed(1)}/h, departures ${(sc.DEPARTED / hrs).toFixed(1)}/h, ops ${((sc.LANDED + sc.DEPARTED) / hrs).toFixed(1)}/h | GA ${sc.GO_AROUND} sep ${sc.SEP_LOSS} wake ${sc.WAKE} incur ${sc.RUNWAY_INCURSION} cross ${sc.CROSSING_CONFLICT} coll ${sc.COLLISION} lost ${sc.LOST} | gating ${JSON.stringify(bot.why)}`);
const errs = s.events.filter((e) => e.type === 'BOT_SLOT').map((e) => e.err); if (errs.length) console.log('  slot timing error s: mean', (errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(1), 'abs mean', (errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length).toFixed(1), 'max', Math.max(...errs.map(Math.abs)));
const rem = [...s.aircraft.values()].filter((a) => !a.done); console.log('  remaining', rem.length, 'holding', rem.filter((a) => bot.plan.get(a.id)?.state === 'hold').length, 'stacks', JSON.stringify(Object.fromEntries(Object.entries(bot.stacks ?? {}).map(([k, v]) => [k, v.length]))));
