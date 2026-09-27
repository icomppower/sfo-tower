// Scripted single-flight flows: vector an arrival onto the ILS 28R and land it; LUAW + takeoff a departure on 1R.
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { bearingTo, trackOffsets } from '../sim/geo.js';
const data = loadData();
const s = new Shift(data, { seed: 'scripted', difficulty: 'easy', weather: 'clear', durationMin: 60 });
s.traffic.schedule = []; // no more spawns
const arr = [...s.aircraft.values()].find((a) => a.kind === 'ARR' && a.star === 'SERFR4') ?? [...s.aircraft.values()].find((a) => a.kind === 'ARR');
let dep = [...s.aircraft.values()].find((a) => a.kind === 'DEP');
if (!dep) { dep = s.traffic.makeDeparture(s, 0); s.aircraft.set(dep.id, dep); }
for (const a of s.aircraft.values()) if (a !== arr && a !== dep) a.mode = 'LOST';
console.log('config', s.config.id, s.weather.current.conditions, 'wind', s.weather.current.wind);
console.log('ARR', arr.callsign, arr.type, arr.star, `r=${Math.hypot(arr.x, arr.y).toFixed(1)} alt=${arr.alt} hdg=${arr.hdg.toFixed(0)} routeIdx=${arr.routeIdx}/${arr.route.length}`);
console.log('DEP', dep.callsign, dep.type, dep.sid?.id, dep.runway);
const rw = s.airport.ends['28R'];
const log = (msg) => console.log(`t=${s.t} ${msg}`);
// Phase 1: descend the arrival and vector it to a 30° intercept of the 28R final at ~12 NM
log(s.command(arr.id, { type: 'altitude', alt: 6000 }).readback);
log(s.command(arr.id, { type: 'speed', ias: 210 }).readback);
let phase = 0;
for (let i = 0; i < 1500 && !arr.done; i++) {
  s.step(1);
  const fp = s.airport.finalPoint('28R', 12);
  const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, arr);
  if (phase === 0 && Math.hypot(arr.x - fp.x, arr.y - fp.y) < 8) { phase = 2; const h = (rw.finalCourse + (cross > 0 ? 30 : -30) + 360) % 360; log(`side=${cross > 0 ? 'south/right' : 'north/left'} cross=${cross.toFixed(2)} along=${along.toFixed(1)}`); log(s.command(arr.id, { type: 'heading', hdg: h }).readback); log(s.command(arr.id, { type: 'altitude', alt: 4000 }).readback); log(s.command(arr.id, { type: 'approach', runway: '28R', kind: 'ILS' }).readback); }
  if (phase === 2 && arr.mode === 'FINAL') { phase = 3; log(`ESTABLISHED at ${arr.finalDistNm.toFixed(1)} NM alt ${arr.alt.toFixed(0)} ias ${arr.ias.toFixed(0)}`); }
  if (phase === 3 && arr.finalDistNm < 6) { phase = 4; log(s.command(arr.id, { type: 'land', runway: '28R' }).readback); log(s.command(dep.id, { type: 'luaw' }).readback); }
  if (phase === 4 && arr.finalDistNm < 2.5) { phase = 5; log(`short final: ${arr.finalDistNm.toFixed(2)} NM alt ${arr.alt.toFixed(0)} (gs alt ${arr.glideslopeAlt(s.env).toFixed(0)}) ias ${arr.ias.toFixed(0)} vs ${arr.vs.toFixed(0)}`); }
  if (arr.mode === 'LANDED' && phase < 6) { phase = 6; log(s.command(dep.id, { type: 'takeoff' }).readback); }
  if (phase === 6 && dep.mode === 'SID' && !dep.flags.said) { dep.flags.said = 1; log(`DEP airborne: alt ${dep.alt.toFixed(0)} ias ${dep.ias.toFixed(0)} hdg ${dep.hdg.toFixed(0)} route ${dep.route.map((l) => l.fix).join('>')}`); }
  if (i % 120 === 0) log(`${arr.callsign} ${arr.mode} r=${Math.hypot(arr.x, arr.y).toFixed(1)} alt=${arr.alt.toFixed(0)} ias=${arr.ias.toFixed(0)} hdg=${arr.hdg.toFixed(0)} cross=${cross.toFixed(2)} along=${along.toFixed(1)} | ${dep.callsign} ${dep.mode} alt=${dep.alt.toFixed(0)} ias=${dep.ias.toFixed(0)}`);
  if (dep.done && arr.done) break;
}
const ev = s.events.filter((e) => e.type !== 'FIX' && e.type !== 'SPAWN' && e.type !== 'COMMAND');
console.log(ev.map((e) => `${e.t}:${e.type}${e.runway ? '/' + e.runway : ''}${e.occupancyS != null ? ' occ=' + e.occupancyS + 's' : ''}${e.rollFt != null ? ' roll=' + e.rollFt + 'ft' : ''}${e.fromThrFt != null ? ' td=' + e.fromThrFt + 'ft' : ''}${e.rolloutFt ? ' exit=' + e.rolloutFt + 'ft' : ''}${e.altAgl != null ? ' agl=' + e.altAgl : ''}${e.reason ? ' ' + e.reason : ''}`).join('\n'));
console.log('score', s.scoring.summary());
