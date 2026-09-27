// Trace one arrival under the bot: node test/trace-arrival.mjs <seed> <difficulty> <weather> <acId>
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
import { trackOffsets, dist } from '../sim/geo.js';
const [seed = 'bot', difficulty = 'easy', weather = 'clear', id = 'A1'] = process.argv.slice(2);
const s = new Shift(loadData(), { seed, difficulty, weather, durationMin: 60, demand: process.env.DEMAND ? { arr: +process.env.DEMAND, dep: +process.env.DEMAND } : null }); const bot = new Bot(s);
let last = ''; let seen = false;
for (let i = 0; i < 3600 && !s.finished; i++) {
  bot.tick(); const n = s.events.length; s.step(1);
  const a = s.aircraft.get(id) ?? [...s.aircraft.values()].find((x) => x.callsign === id); if (!a) { if (i > 5 && seen) { console.log('gone at', s.t); break; } continue; } seen = true;
  const rw = s.airport.ends[a.runway]; const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, a); const p = bot.plan.get(id) ?? {};
  const line = `${a.mode} st=${p.state} rw=${a.runway} routeIdx=${a.routeIdx}/${a.route.length}${a.route[a.routeIdx] ? '(' + a.route[a.routeIdx].fix + ' ' + dist(a, a.route[a.routeIdx]).toFixed(1) + 'nm)' : ''} hdg=${a.hdg.toFixed(0)}→${a.tgt.hdg.toFixed(0)}${a.tgt.hdgAssigned ? 'A' : ''} alt=${a.alt.toFixed(0)}→${a.tgt.alt} ias=${a.ias.toFixed(0)} along=${along.toFixed(1)} cross=${cross.toFixed(1)} clr=${a.clearedApproach ? 'A' : ''}${a.clearedLand ? 'L' : ''}`;
  const cmds = s.events.slice(n).filter((e) => e.type === 'COMMAND' && e.ac === id).map((e) => JSON.stringify(e.cmd));
  if (cmds.length || i % 30 === 0 || a.mode !== last) console.log(`t=${s.t} ${line}${cmds.length ? ' CMD ' + cmds.join(' ') : ''}`);
  last = a.mode;
  if (a.done) { console.log('done', a.mode); break; }
}
