// Run a full shift with the bot controller. usage: node test/bot-run.mjs [seed] [difficulty] [weather] [minutes] [--verbose]
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
const [seed = 'bot', difficulty = 'easy', weather = 'clear', minutes = '60'] = process.argv.slice(2);
const verbose = process.argv.includes('--verbose');
const s = new Shift(loadData(), { seed, difficulty, weather, durationMin: +minutes });
const bot = new Bot(s);
const t0 = Date.now();
const snaps = new Map(); const VIOL = new Set(['SEP_LOSS', 'WAKE', 'RUNWAY_INCURSION', 'CROSSING_CONFLICT', 'COLLISION', 'GO_AROUND']);
const desc = (a) => a ? `${a.callsign}/${a.type}(${a.cwt}) ${a.mode}${a.mode === 'FINAL' ? '@' + a.finalDistNm.toFixed(1) : ''} alt=${a.alt.toFixed(0)}→${a.tgt.alt} ias=${a.ias.toFixed(0)}→${a.tgt.ias}${a.onRunway ? ' rwy=' + a.onRunway + ' along=' + Math.round(a.alongRunwayFt) : ''} r=${Math.hypot(a.x, a.y).toFixed(1)}` : '?';
while (!s.finished && !s.gameOver) { bot.tick(); const n = s.events.length; s.step(1); for (const e of s.events.slice(n)) if (VIOL.has(e.type)) snaps.set(e, [desc(s.aircraft.get(e.ac)), desc(s.aircraft.get(e.other))]); }
const c = {}; for (const e of s.events) c[e.type] = (c[e.type] ?? 0) + 1;
const byCs = (id) => s.aircraft.get(id)?.callsign ?? id;
console.log(`${seed}/${difficulty}/${weather} ${s.config.id} ${s.weather.current.conditions} h=${s.startHour} m=${s.month} dow=${s.dow} t=${s.t}s gameOver=${s.gameOver} (${Date.now() - t0} ms)`);
console.log('events', JSON.stringify(c)); console.log('join gating', JSON.stringify(bot.why ?? {}));
console.log('score', JSON.stringify(s.scoring.summary()));
const viol = s.events.filter((e) => ['SEP_LOSS', 'WAKE', 'RUNWAY_INCURSION', 'CROSSING_CONFLICT', 'COLLISION', 'GO_AROUND', 'LOST'].includes(e.type));
for (const e of viol.slice(0, verbose ? 60 : 12)) { console.log(`  ${e.t}s ${e.type} ${byCs(e.ac)}${e.other ? ' vs ' + byCs(e.other) : ''} ${e.nm != null ? e.nm + '/' + e.reqNm + 'nm' : ''} ${e.ft != null ? e.ft + 'ft' : ''} ${e.how ?? e.reason ?? ''} ${e.para ?? ''}`); if (verbose && snaps.has(e)) console.log('      ' + snaps.get(e).join('\n      ')); }
const thr = s.events.filter((e) => e.type === 'THRESHOLD').map((e) => e.altAgl); if (thr.length) console.log('threshold AGL ft: mean', Math.round(thr.reduce((a, b) => a + b, 0) / thr.length), 'max', Math.max(...thr));
const est = s.events.filter((e) => e.type === 'ESTABLISHED').map((e) => e.distNm); if (est.length) console.log('established at NM: mean', (est.reduce((a, b) => a + b, 0) / est.length).toFixed(1), 'min', Math.min(...est));
const rem = [...s.aircraft.values()].filter((a) => !a.done);
console.log('remaining', rem.length, rem.slice(0, 12).map((a) => `${a.callsign}:${a.mode}${a.mode === 'FINAL' ? '@' + a.finalDistNm.toFixed(1) : ''}`).join(' '));
const occ = s.events.filter((e) => e.type === 'CLEAR_RUNWAY' && e.occupancyS != null).map((e) => e.occupancyS);
if (occ.length) console.log('runway occupancy s: mean', (occ.reduce((a, b) => a + b, 0) / occ.length).toFixed(0), 'min', Math.min(...occ), 'max', Math.max(...occ));
const td = s.events.filter((e) => e.type === 'TOUCHDOWN').map((e) => e.fromThrFt); if (td.length) console.log('touchdown ft: mean', Math.round(td.reduce((a, b) => a + b, 0) / td.length));
const roll = s.events.filter((e) => e.type === 'LIFTOFF').map((e) => e.rollFt); if (roll.length) console.log('takeoff roll ft: mean', Math.round(roll.reduce((a, b) => a + b, 0) / roll.length), 'max', Math.max(...roll));
