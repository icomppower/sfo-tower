// Summarize bot shifts over several seeds: node test/multi.mjs <difficulty> <weather> <seeds...>
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
const [difficulty = 'easy', weather = 'clear', ...seeds] = process.argv.slice(2);
const data = loadData();
for (const seed of seeds.length ? seeds : ['a', 'b', 'c', 'd', 'e', 'f']) {
  const s = new Shift(data, { seed, difficulty, weather, durationMin: 60 }); const bot = new Bot(s);
  while (!s.finished && !s.gameOver) { bot.tick(); s.step(1); }
  const sc = s.scoring.summary(); const arr = s.events.filter((e) => e.type === 'SPAWN' && e.kind === 'ARR').length;
  console.log(`${seed.padEnd(6)} ${s.config.id.padEnd(9)} ${s.weather.current.conditions.padEnd(10)} h=${String(s.startHour).padStart(2)} arrivals=${String(arr).padStart(2)} landed=${String(sc.LANDED).padStart(2)} dep=${String(sc.DEPARTED).padStart(2)} GA=${sc.GO_AROUND} sep=${sc.SEP_LOSS} wake=${sc.WAKE} incur=${sc.RUNWAY_INCURSION} cross=${sc.CROSSING_CONFLICT} coll=${sc.COLLISION} lost=${sc.LOST} delay=${sc.delayMin}m score=${sc.score}`);
}
