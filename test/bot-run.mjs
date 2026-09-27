// Run a full shift with the bot controller. usage: node test/bot-run.mjs [seed] [difficulty] [weather] [minutes] [--verbose]
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
const [seed = 'bot', difficulty = 'easy', weather = 'clear', minutes = '60'] = process.argv.slice(2);
const verbose = process.argv.includes('--verbose');
const s = new Shift(loadData(), { seed, difficulty, weather, durationMin: +minutes });
const bot = new Bot(s);
const t0 = Date.now();
while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); }
const c = {}; for (const e of s.events) c[e.type] = (c[e.type] ?? 0) + 1;
const byCs = (id) => s.aircraft.get(id)?.callsign ?? id;
console.log(`${seed}/${difficulty}/${weather} ${s.config.id} ${s.weather.current.conditions} h=${s.startHour} m=${s.month} dow=${s.dow} t=${s.t}s gameOver=${s.gameOver} (${Date.now() - t0} ms)`);
console.log('events', JSON.stringify(c));
console.log('score', JSON.stringify(s.scoring.summary()));
const viol = s.events.filter((e) => ['SEP_LOSS', 'WAKE', 'RUNWAY_INCURSION', 'CROSSING_CONFLICT', 'COLLISION', 'GO_AROUND', 'LOST'].includes(e.type));
for (const e of viol.slice(0, verbose ? 60 : 12)) console.log(`  ${e.t}s ${e.type} ${byCs(e.ac)}${e.other ? ' vs ' + byCs(e.other) : ''} ${e.nm != null ? e.nm + '/' + e.reqNm + 'nm' : ''} ${e.ft != null ? e.ft + 'ft' : ''} ${e.how ?? e.reason ?? ''} ${e.para ?? ''}`);
const rem = [...s.aircraft.values()].filter((a) => !a.done);
console.log('remaining', rem.length, rem.slice(0, 12).map((a) => `${a.callsign}:${a.mode}${a.mode === 'FINAL' ? '@' + a.finalDistNm.toFixed(1) : ''}`).join(' '));
const occ = s.events.filter((e) => e.type === 'CLEAR_RUNWAY' && e.occupancyS != null).map((e) => e.occupancyS);
if (occ.length) console.log('runway occupancy s: mean', (occ.reduce((a, b) => a + b, 0) / occ.length).toFixed(0), 'min', Math.min(...occ), 'max', Math.max(...occ));
const td = s.events.filter((e) => e.type === 'TOUCHDOWN').map((e) => e.fromThrFt); if (td.length) console.log('touchdown ft: mean', Math.round(td.reduce((a, b) => a + b, 0) / td.length));
const roll = s.events.filter((e) => e.type === 'LIFTOFF').map((e) => e.rollFt); if (roll.length) console.log('takeoff roll ft: mean', Math.round(roll.reduce((a, b) => a + b, 0) / roll.length), 'max', Math.max(...roll));
