// Controller commands → aircraft state + pilot readback text (aviation English; the view adds bilingual labels).
import { MODES } from './aircraft.js';
import { wrap360, angDiff } from './geo.js';

const digits = (n, pad = 3) => String(n).padStart(pad, '0').split('').map((c) => ({ 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'niner' }[c])).join(' ');
const altWords = (a) => a >= 18000 ? `flight level ${digits(Math.round(a / 100))}` : a % 1000 === 0 ? `${digits(a / 1000, 1)} thousand` : `${digits(Math.floor(a / 1000), 1)} thousand ${digits((a % 1000) / 100, 1)} hundred`;
const rwyWords = (r) => r.replace(/(\d+)([LRC]?)/, (_, n, s) => digits(n, n.length) + (s === 'L' ? ' left' : s === 'R' ? ' right' : s === 'C' ? ' center' : ''));
const cs = (ac) => `${ac.telephony} ${ac.callsign.replace(/^[A-Z]{3}/, '')}`.trim();

export const COMMANDS = ['heading', 'altitude', 'speed', 'approach', 'land', 'luaw', 'takeoff', 'holdshort', 'goaround'];

/** Returns { ok, readback, error } and mutates the aircraft. */
export function applyCommand(shift, ac, cmd) {
  const t = shift.t, w = shift.weather.current, cfg = shift.config;
  const nope = (error) => ({ ok: false, readback: `${cs(ac)}, unable, ${error}.`, error });
  const ok = (readback) => { ac.lastReadback = readback; ac.note(t, readback); shift.events.push({ t, type: 'COMMAND', ac: ac.id, cmd }); return { ok: true, readback }; };
  if (ac.done) return nope('aircraft has left the frequency');
  switch (cmd.type) {
    case 'heading': {
      if (ac.onGround || ac.mode === MODES.TAKEOFF) return nope('on the ground');
      const h = wrap360(Math.round(cmd.hdg / 5) * 5) || 360;
      const turn = cmd.turn ?? (angDiff(h, ac.hdg) < 0 ? 'L' : 'R');
      if (ac.mode === MODES.FINAL || ac.mode === MODES.APPROACH) { ac.clearedApproach = false; ac.clearedLand = false; ac.established = false; }
      ac.mode = ac.mode === MODES.GOAROUND ? MODES.GOAROUND : MODES.VECTOR; ac.tgt.hdg = h; ac.tgt.turn = turn; ac.tgt.hdgAssigned = true; ac.route = []; ac.routeIdx = 0;
      return ok(`${turn === 'L' ? 'Left' : 'Right'} heading ${digits(h)}, ${cs(ac)}.`);
    }
    case 'altitude': {
      if (ac.onGround || ac.mode === MODES.TAKEOFF) return nope('on the ground');
      const a = Math.round(cmd.alt / 100) * 100; if (a < 1000 || a > 18000) return nope('altitude out of range');
      const climb = a > ac.alt;
      if (ac.mode === MODES.FINAL) return nope('established on the approach');
      ac.tgt.alt = a; ac.tgt.altAssigned = true;
      return ok(`${climb ? 'Climb and maintain' : 'Descend and maintain'} ${altWords(a)}, ${cs(ac)}.`);
    }
    case 'speed': {
      if (ac.onGround || ac.mode === MODES.TAKEOFF) return nope('on the ground');
      if (cmd.ias == null) { ac.tgt.iasAssigned = false; ac.tgt.ias = ac.kind === 'ARR' ? Math.min(ac.perf.vMax, 250) : ac.perf.vMax; return ok(`Resume normal speed, ${cs(ac)}.`); }
      const s = Math.round(cmd.ias / 10) * 10;
      if (s < ac.perf.vApp) return nope(`minimum speed ${ac.perf.vApp} knots`);
      if (s > ac.perf.vMax) return nope(`maximum ${ac.perf.vMax} knots`);
      ac.tgt.ias = s; ac.tgt.iasAssigned = true;
      return ok(`${s < ac.ias ? 'Reduce speed to' : 'Increase speed to'} ${digits(s)} knots, ${cs(ac)}.`);
    }
    case 'approach': {
      if (ac.kind !== 'ARR') return nope('we are a departure');
      if (ac.onGround) return nope('on the ground');
      const rw = shift.airport.ends[cmd.runway]; if (!rw) return nope('unknown runway');
      const kind = cmd.kind ?? (w.visualOK ? (rw.ils ? 'ILS' : 'RNAV') : rw.approachType);
      if (kind === 'VISUAL' && !w.visualOK) return nope('unable visual, field is IFR');
      if (kind === 'ILS' && !rw.ils) return nope(`no ILS for runway ${cmd.runway}`);
      ac.runway = cmd.runway; ac.approachKind = kind; ac.clearedApproach = true; ac.clearedLand = false;
      if (ac.mode === MODES.FINAL) { ac.established = false; }
      if (ac.mode !== MODES.STAR) { ac.route = []; ac.routeIdx = 0; }
      ac.mode = MODES.APPROACH;
      if (kind === 'VISUAL') { ac.tgt.hdgAssigned = true; ac.tgt.hdg = ac.hdg; ac.tgt.turn = null; }
      return ok(`Cleared ${kind === 'ILS' ? 'I-L-S' : kind === 'RNAV' ? 'R-NAV' : 'visual'} approach runway ${rwyWords(cmd.runway)}, ${cs(ac)}.`);
    }
    case 'land': {
      if (ac.kind !== 'ARR' || ac.onGround) return nope('not on approach');
      if (!ac.clearedApproach || ac.runway !== cmd.runway) return nope(`not cleared for the approach to runway ${cmd.runway}`);
      ac.clearedLand = true;
      return ok(`Cleared to land runway ${rwyWords(cmd.runway)}, ${cs(ac)}.`);
    }
    case 'luaw': {
      if (ac.kind !== 'DEP' || ac.mode !== MODES.QUEUE) return nope('not holding short');
      if (cmd.runway && cmd.runway !== ac.runway) return nope(`we are holding short of runway ${ac.runway}`);
      ac.mode = MODES.LUAW; ac.modeTimer = 0;
      return ok(`Runway ${rwyWords(ac.runway)}, line up and wait, ${cs(ac)}.`);
    }
    case 'takeoff': {
      if (ac.kind !== 'DEP' || !(ac.mode === MODES.QUEUE || ac.mode === MODES.LUAW)) return nope('not ready for departure');
      if (cmd.runway && cmd.runway !== ac.runway) return nope(`we are at runway ${ac.runway}`);
      ac.clearedTakeoff = true; if (ac.mode === MODES.QUEUE) { ac.mode = MODES.LUAW; ac.modeTimer = 5; }
      const wind = `wind ${digits(Math.round(w.wind.dir / 10) * 10 || 360)} at ${digits(w.wind.kt, 1)}`;
      return ok(`${wind}, runway ${rwyWords(ac.runway)}, cleared for takeoff, ${cs(ac)}.`);
    }
    case 'holdshort': {
      if (ac.kind !== 'DEP' || !(ac.mode === MODES.LUAW || ac.mode === MODES.QUEUE)) return nope('unable, rolling');
      ac.mode = MODES.QUEUE; ac.modeTimer = 0; ac.clearedTakeoff = false; if (ac.onRunway) { ac.onRunway = null; shift.events.push({ t, type: 'CLEAR_RUNWAY', ac: ac.id, runway: ac.runway, how: 'hold short' }); }
      return ok(`Hold short runway ${rwyWords(ac.runway)}, ${cs(ac)}.`);
    }
    case 'goaround': {
      if (ac.kind !== 'ARR' || !(ac.mode === MODES.FINAL || ac.mode === MODES.APPROACH) || ac.onGround) return nope('not on approach');
      ac.goAround(shift.env, 'controller instruction', true);
      return ok(`Going around, ${cs(ac)}.`);
    }
    default: return nope('say again');
  }
}
export { cs as spokenCallsign, altWords, digits, rwyWords };
