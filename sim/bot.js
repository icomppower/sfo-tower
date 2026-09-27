// Rules-following bot controller (T6/T7 oracle and the in-game "autopilot" demo). Deterministic: no randomness.
// assist=true: uses time-to-threshold prediction for runway crossings and spacing; assist=false: reacts to positions only, slower cadence.
import { MODES } from './aircraft.js';
import { dist, trackOffsets, angDiff, wrap360, bearingTo, advance } from './geo.js';
import { wakeAtThreshold, wakeBehind, wakeDepartureInterval, srsDistanceFt } from './rules.js';
import { CONDITIONS } from './weather.js';

const BASE_NM = 13;        // where the bot turns arrivals onto the final (NM from threshold)
const ALONG_T = 16.5;      // join point on the final: both aircraft of a pair are established here before the higher one meets the glideslope
const INTERCEPT_DEG = 30;
export class Bot {
  constructor(shift, opts = {}) {
    this.shift = shift; this.assist = opts.assist ?? shift.assist; this.cadence = this.assist ? 2 : 6; this.lastTick = -99;
    this.plan = new Map(); // ac.id → { state, timer, side }
    shift.meter = () => Object.values(this.stacks ?? {}).reduce((n, st) => n + st.length, 0) >= 3; // en-route metering: hold new arrivals out while 3+ aircraft hold
    this.lastRoll = {}; // runway end → { t, cwt, id }
    this.lastClearedFinal = null;
  }
  tick() {
    const s = this.shift; if (s.t - this.lastTick < this.cadence) return; this.lastTick = s.t;
    const acs = [...s.aircraft.values()].filter((a) => !a.done);
    const arrivals = acs.filter((a) => a.kind === 'ARR' && !a.onGround).sort((a, b) => this.etaThreshold(a) - this.etaThreshold(b));
    for (const a of arrivals) this.handleArrival(a, arrivals, acs);
    for (const d of acs.filter((a) => a.kind === 'DEP')) this.handleDeparture(d, acs);
    this.resolveConflicts(acs);
  }
  /** Every tick: an aircraft climbing/descending toward its target stops at the next 1,000 ft level if traffic now sits in the band it would pass; resumes when clear. */
  guardVertical(a, acs) {
    if (a.onGround || a.mode === MODES.FINAL || a.mode === MODES.TAKEOFF || a.mode === MODES.GOAROUND || a.done) return;
    const p = this.plan.get(a.id) ?? { state: 'star', timer: 0 }; this.plan.set(a.id, p);
    const target = a.tgt.altAssigned || a.mode !== MODES.STAR ? a.tgt.alt : a.routeAltitude();
    if (p.wantAlt != null && Math.abs(target - p.wantAlt) > 50 && Math.abs(a.alt - target) < 150) { // we are parked at a guard level; resume when the way is clear
      if (this.pathClear(a, p.wantAlt, acs)) { this.cmd(a, { type: 'altitude', alt: p.wantAlt }); p.wantAlt = null; }
      return;
    }
    if (Math.abs(target - a.alt) < 150) return;
    if (this.pathClear(a, target, acs)) return;
    const down = target < a.alt;
    const park = down ? Math.ceil((a.alt - 50) / 1000) * 1000 : Math.floor((a.alt + 50) / 1000) * 1000;
    if (Math.abs(park - a.alt) > 600 || park === target) return;
    if (a.tgt.alt !== park) { this.cmd(a, { type: 'altitude', alt: park }); p.wantAlt = target; p.holdAltUntil = this.shift.t + 60; }
  }
  cmd(ac, c) { return this.shift.command(ac.id, c); }
  ga(ac, why) { this.shift.events.push({ t: this.shift.t, type: 'BOT_GA', ac: ac.id, why }); return this.cmd(ac, { type: 'goaround' }); }
  /** Radar-separation assist: with assist, predict closest approach over the next 90 s and split altitudes 1,000 ft; without, react to the current picture only.
   *  Aircraft on final / intercepting are obstacles, never moved. The new altitude must be reachable without passing through another aircraft's level. */
  resolveConflicts(acs) {
    const s = this.shift, horizon = this.assist ? 90 : 0;
    this.resolved ??= new Map();
    const eff = (x) => (x.mode === MODES.STAR && !x.tgt.altAssigned ? x.routeAltitude() : x.tgt.alt);
    const air = acs.filter((a) => !a.onGround && a.mode !== MODES.TAKEOFF && a.mode !== MODES.GOAROUND);
    const movable = (x) => x.mode !== MODES.FINAL && x.mode !== MODES.APPROACH && !(x.kind === 'DEP' && x.alt < 3000);
    for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) {
      const a = air[i], b = air[j];
      if (a.kind === 'DEP' && b.kind === 'DEP') continue; // 5-8-3 divergence handles simultaneous departures
      if (!movable(a) && !movable(b)) continue;
      const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
      const ta = eff(a), tb = eff(b);
      const dv = Math.abs(a.alt - b.alt), dvT = Math.abs(ta - tb);
      if (dv >= 1000 && dvT >= 1000 && ((a.alt - b.alt) * (ta - tb) > 0)) continue; // vertically separated now and staying so
      const va = { x: a.gs * Math.sin(a.hdg * Math.PI / 180) / 3600, y: a.gs * Math.cos(a.hdg * Math.PI / 180) / 3600 }, vb = { x: b.gs * Math.sin(b.hdg * Math.PI / 180) / 3600, y: b.gs * Math.cos(b.hdg * Math.PI / 180) / 3600 };
      const dx = b.x - a.x, dy = b.y - a.y, dvx = vb.x - va.x, dvy = vb.y - va.y;
      const v2 = dvx * dvx + dvy * dvy; let tc = v2 > 1e-9 ? -(dx * dvx + dy * dvy) / v2 : 0; tc = Math.max(0, Math.min(horizon, tc));
      const dmin = Math.hypot(dx + dvx * tc, dy + dvy * tc), dnow = Math.hypot(dx, dy);
      if (Math.min(dmin, dnow) > 3.6) continue;
      if ((this.resolved.get(key) ?? -999) > s.t - 60 && dnow > 2.6) continue;
      const m = movable(a) && movable(b) ? (a.kind === 'DEP' ? b : b.kind === 'DEP' ? a : a.alt >= b.alt ? a : b) : movable(a) ? a : b;
      const want = this.safeAltitude(m, air, eff);
      if (want == null) continue; // no vertical solution here: the per-aircraft flow (slots, guards) has to sort it out
      const pm = this.plan.get(m.id) ?? { state: 'inbound', timer: 0 }; this.plan.set(m.id, pm); pm.holdAltUntil = s.t + 75; this.resolved.set(key, s.t);
      if (m.tgt.alt !== want || (m.mode === MODES.STAR && !m.tgt.altAssigned)) { this.cmd(m, { type: 'altitude', alt: want }); s.events.push({ t: s.t, type: 'BOT_RESOLVE', ac: m.id, other: m === a ? b.id : a.id, alt: want, dmin: +dmin.toFixed(2) }); }
    }
  }
  /** Nearest altitude (3,000–10,000, 1,000 ft steps) that keeps ≥ 1,000 ft from every other aircraft within 7 NM, including the levels passed through on the way. */
  safeAltitude(m, air, eff) {
    const others = air.filter((o) => o !== m && dist(o, m) < 7).map((o) => ({ lo: Math.min(o.alt, eff(o)), hi: Math.max(o.alt, eff(o)) }));
    const cands = [3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000].filter((c) => m.kind === 'ARR' ? c >= 4000 : true).sort((x, y) => Math.abs(x - m.alt) - Math.abs(y - m.alt));
    for (const c of cands) {
      if (Math.abs(c - m.alt) < 50) continue;
      const down = c < m.alt; const lo = down ? c - 950 : m.alt + 950, hi = down ? m.alt - 950 : c + 950; // levels passed through (excluding the co-altitude zone)
      const destOk = others.every((o) => o.hi < c - 950 || o.lo > c + 950);
      const passOk = others.every((o) => o.hi < lo || o.lo > hi);
      if (destOk && passOk) return c;
    }
    return null;
  }
  /** Estimated seconds to the landing threshold for an arrival (on final: distance/speed; otherwise via the base point). */
  etaThreshold(a) {
    const rw = this.shift.airport.ends[a.runway];
    if (a.mode === MODES.FINAL) return a.finalDistNm / Math.max(120, a.gs) * 3600;
    const base = this.shift.airport.finalPoint(a.runway, BASE_NM);
    return (dist(a, base) + BASE_NM) / Math.max(150, a.gs || 200) * 3600 + 60;
  }
  /** Minimum spacing (NM) the bot wants behind `lead` for `trail` when both use the same / close-parallel finals. */
  spacing(lead, trail) {
    const ap = this.shift.airport, w = this.shift.weather.current;
    const same = lead.runway === trail.runway;
    let req;
    if (w.conditions === CONDITIONS.VISUAL) req = same ? 3.0 : 1.2;
    else if (w.conditions === CONDITIONS.MARGINAL) req = same ? 3.0 : 2.0;
    else req = 3.5;
    const wake = Math.max(wakeBehind(lead.cwt, trail.cwt), wakeAtThreshold(lead.cwt, trail.cwt));
    return Math.max(req, wake ? wake + 0.5 : 0) + (this.assist ? 0.3 : 0) + (same ? 1.0 : 0.5) + (wake ? 0.8 : 0); // compression allowance: the leader slows to Vapp inside 5 NM
  }
  /** Arrival flow v6 — landing slots. Every arrival is sequenced onto one stream for the (close-parallel) arrival runways: its slot time at the
   *  join point T (14 NM on the final) is the earliest time it can get there, pushed back by the wake/radar spacing behind the last slots (and by a
   *  departure gap when 1L/1R traffic is waiting). It holds in a stack at its STAR exit fix until the slot is within ~2.5 min of reach, then flies
   *  fix → (dogleg) → B (4 NM off the axis) → T on a 30° intercept, timed to hit the slot; final speed control keeps the spacing to touchdown. */
  handleArrival(a, arrivals, acs) {
    const s = this.shift, ap = s.airport;
    const p = this.plan.get(a.id) ?? { state: 'star', timer: 0 }; this.plan.set(a.id, p);
    const r = Math.hypot(a.x, a.y);
    if (!p.fix) {
      p.fix = this.exitFix(a); p.side = this.sideOf(a.runway, p.fix); p.stackBase = this.stackBase(a, p.fix);
      const rwF = ap.ends[a.runway]; const { along } = trackOffsets(rwF.thr, rwF.finalCourse + 180, p.fix);
      if (along < 12) { // exit fix behind / over the field (BDEGA → CORKK): merge into the farthest same-side exit fix of the other STARs (ARCHI)
        let best = null;
        for (const st of this.shift.procedures.starsFor(a.runway)) { const l = st.route[st.route.length - 1]; if (Math.hypot(l.x, l.y) < 6) continue; const o = trackOffsets(rwF.thr, rwF.finalCourse + 180, l); if (o.along < 15 || o.along > 30 || (Math.sign(o.cross || 1) !== p.side && Math.abs(o.cross) > 0.5)) continue; if (!best || o.along < best.along) best = { fix: l.fix, x: l.x, y: l.y, alt: l.alt1 ?? null, along: o.along }; }
        if (best) { p.fix = { fix: best.fix, x: best.x, y: best.y, alt: best.alt }; p.stackBase = this.stackBase(a, p.fix); p.rerouted = true; this.cmd(a, { type: 'direct', points: [p.fix] }); }
      }
    }
    const rw = ap.ends[a.runway];
    if (a.mode === MODES.GOAROUND) { p.state = 'goaround'; return; }
    if (a.mode === MODES.FINAL) {
      if (p.state !== 'final' && p.slot) s.events.push({ t: s.t, type: 'BOT_SLOT', ac: a.id, err: Math.round(s.t + (a.finalDistNm - ALONG_T) / 180 * 3600 - p.slot) }); // timing error at the join
      p.state = 'final'; this.leaveStack(a, p);
      this.finalSpeedControl(a, arrivals);
      const free = this.runwayFreeForLanding(a, acs);
      if (!a.clearedLand && a.finalDistNm <= 3.5 && free) this.cmd(a, { type: 'land', runway: a.runway });
      if (!a.clearedLand && a.finalDistNm <= 1.6 && !free) { this.ga(a, 'runway not free at 1.6 NM'); }
      if (a.clearedLand && a.finalDistNm <= 1.0 && a.finalDistNm > 0 && !this.runwayFreeForLanding(a, acs, true)) { this.ga(a, 'runway not free at 1 NM'); }
      return;
    }
    const altHeld = (p.holdAltUntil ?? 0) > s.t;
    const setAlt = (alt) => { if (!altHeld && a.tgt.alt !== alt && this.pathClear(a, alt, acs)) { this.cmd(a, { type: 'altitude', alt }); return true; } return false; };
    const setSpeed = (v) => { if (!(a.tgt.iasAssigned && a.tgt.ias === v)) this.cmd(a, { type: 'speed', ias: v }); };
    if (p.state === 'released') { // fix → (dogleg) → B → T: altitude follows the remaining path (300 ft/NM above 4,000 at the join), approach clearance near B, speed flies the slot
      const lastIdx = a.route.length - 1;
      let rem = 0; if (a.routeIdx <= lastIdx) { rem = dist(a, a.route[a.routeIdx]); for (let i = a.routeIdx + 1; i <= lastIdx; i++) rem += dist(a.route[i - 1], a.route[i]); }
      // continuous profile (100 ft steps): 28L 4,000 + 300 ft/NM beyond 8 NM from the join; 28R the same + 1,000 ft, so paired aircraft stay 1,000 ft apart all the way in
      const profile = Math.max(p.joinAlt, Math.min(p.stackBase, Math.round((p.joinAlt + 300 * Math.max(0, rem - 8)) / 100) * 100));
      if ((a.tgt.alt > profile + 150 || (profile === p.joinAlt && a.tgt.alt !== p.joinAlt)) && dist(a, p.fix) > 1.5) { this.cmd(a, { type: 'altitude', alt: profile }); }
      if (!a.clearedApproach && (a.routeIdx >= lastIdx || dist(a, p.B) < 2.5)) this.cmd(a, { type: 'approach', runway: a.runway, kind: rw.ils ? 'ILS' : rw.approachType });
      if (a.mode !== MODES.FINAL && a.routeIdx <= lastIdx) {
        // in-trail guard: another aircraft heading for the same runway with less distance to go, closer than 3.5 NM → slow, and S-turn away when inside 2.8 NM
        const ahead = arrivals.find((o) => { const po = this.plan.get(o.id); if (o === a || o.runway !== a.runway) return false; const oRem = o.mode === MODES.FINAL ? o.finalDistNm - ALONG_T : (po?.state === 'released' ? this.remaining(o) : null); return oRem != null && oRem < rem - 0.3 && dist(o, a) < 3.5; });
        if (ahead) {
          setSpeed(Math.max(160, a.perf.vApp + 20));
          if (dist(ahead, a) < 2.8 && (p.sturnUntil ?? 0) < s.t - 30) { p.sturnUntil = s.t + 20; const away = wrap360(bearingTo(ahead, a)); this.cmd(a, { type: 'heading', hdg: Math.round(wrap360(a.hdg + (angDiff(away, a.hdg) >= 0 ? 30 : -30)) / 5) * 5 || 360 }); s.events.push({ t: s.t, type: 'BOT_STURN', ac: a.id, other: ahead.id }); }
          else if ((p.sturnUntil ?? 0) < s.t && a.tgt.hdgAssigned) this.cmd(a, { type: 'direct', points: a.route.slice(a.routeIdx) }); // S-turn done: back on the route
          return;
        }
        if ((p.sturnUntil ?? 0) >= s.t) return;
        if (a.tgt.hdgAssigned) this.cmd(a, { type: 'direct', points: a.route.slice(a.routeIdx) });
        // fly the slot: speed = remaining path / time left (160–vMax), 180 kt inside 6 NM of the join; more than 25 s early with room → add a dogleg
        const left = p.slot - s.t; const T = a.route[lastIdx];
        const early = left - rem / 190 * 3600;
        if (early > 25 && rem > 9 && (p.replanAt ?? -999) < s.t - 60 && a.routeIdx < lastIdx) {
          const first = a.route[a.routeIdx]; const L = dist(a, first); const E = early * 190 / 3600;
          if (L > 2) { const h = Math.sqrt(Math.max(0, ((L + E) / 2) ** 2 - (L / 2) ** 2)); const mid = { x: (a.x + first.x) / 2, y: (a.y + first.y) / 2 }; const D = advance(mid, bearingTo(a, first) + p.side * 90, Math.min(h, 4)); this.cmd(a, { type: 'direct', points: [{ ...D, fix: 'DELAY' }, ...a.route.slice(a.routeIdx)] }); p.replanAt = s.t; s.events.push({ t: s.t, type: 'BOT_DELAY', ac: a.id, early: Math.round(early) }); return; }
        }
        const want = dist(a, T) < 6 ? 180 : Math.round(Math.max(160, Math.min(Math.min(250, a.perf.vMax), left > 5 ? rem / left * 3600 : 250)) / 10) * 10;
        if (Math.abs((a.tgt.ias ?? 0) - want) >= 10) setSpeed(want);
      }
      if (a.routeIdx > lastIdx && !p.slotErrLogged) { p.slotErrLogged = true; s.events.push({ t: s.t, type: 'BOT_SLOT', ac: a.id, err: s.t - p.slot }); }
      if (a.routeIdx > lastIdx && (!a.clearedApproach || s.t - p.timer > 45)) { s.events.push({ t: s.t, type: 'BOT_RESEQ', ac: a.id, why: `flew through the join (cleared=${a.clearedApproach}, alt ${Math.round(a.alt)}, mode ${a.mode})` }); this.cmd(a, { type: 'heading', hdg: Math.round(a.hdg / 5) * 5 || 360 }); this.dropSlot(a); p.state = 'goaround'; return; } // flew through the join: re-sequence
      return;
    }
    if (a.mode === MODES.APPROACH) return;
    if (r < 32 && !a.tgt.iasAssigned && a.ias > 215) setSpeed(210);
    if (p.state === 'goaround' || p.state === 'return') { // back to the exit fix via a point 7 NM abeam the airport on our side (never back across the field low), climbing to 5,000 then the stack level
      if (p.state === 'goaround') {
        p.state = 'return'; this.leaveStack(a, p); this.dropSlot(a);
        const W = advance({ x: 0, y: 0 }, rw.finalCourse + 180 + p.side * 90, 7);
        this.cmd(a, { type: 'direct', points: [{ ...W, fix: 'ABEAM' }, p.fix] }); setSpeed(190);
      }
      if (a.routeIdx === 0 && a.route.length === 2) { if (a.tgt.alt < 5000) setAlt(5000); } else setAlt(this.stackLevelFor(a, p));
      if (dist(a, p.fix) > 2.5) return;
      p.state = 'star';
    }
    // ---- STAR → fix: descend early toward the stack level (never through traffic)
    if (p.state === 'star') {
      const level = this.stackLevelFor(a, p);
      if (r < 42 && Math.abs(a.alt - level) > 50) setAlt(level); else this.descentGuard(a, acs);
      const atFix = dist(a, p.fix) < 2.5 || a.mode !== MODES.STAR;
      if (!atFix && dist(a, p.fix) > 6) return;
      if (atFix) { p.state = 'hold'; p.leg = 'to'; p.timer = s.t; this.enterStack(a, p); this.cmd(a, { type: 'direct', points: [p.fix] }); setSpeed(190); }
    }
    // ---- at / near the fix: take a slot when we are the lowest in the stack (or inbound with an empty stack)
    const holders = this.stacks?.[this.stackKey(p.fix)] ?? [];
    const eligible = p.state === 'hold' ? this.lowestInStack(a, p) : holders.length === 0;
    if (eligible) {
      const plan = this.slotPlan(a, p, arrivals, acs);
      if (plan) {
        this.leaveStack(a, p); a.runway = plan.runway;
        this.cmd(a, { type: 'direct', points: plan.route }); setSpeed(190);
        p.state = 'released'; p.timer = s.t; p.joinAlt = plan.joinAlt; p.B = plan.B; p.slot = plan.slot; this.note('ok'); return;
      }
    } else this.note(p.state === 'hold' ? 'stack' : 'stackWait');
    if ((p.nudgedUntil ?? 0) > s.t) return; // the resolver turned us away; wait it out
    if (p.nudgedUntil != null) { p.nudgedUntil = null; if (p.state === 'hold') { p.leg = 'to'; p.timer = s.t; this.cmd(a, { type: 'direct', points: [p.fix] }); } }
    if (p.state !== 'hold') return;
    // ---- holding: racetrack at the fix (60 s legs), stepping down the stack as levels free up
    setAlt(this.stackLevelFor(a, p));
    const d = dist(a, p.fix), away = bearingTo({ x: 0, y: 0 }, p.fix);
    if (p.leg === 'to' && d < 1.2) { p.leg = 'out'; p.timer = s.t; this.cmd(a, { type: 'heading', hdg: away }); }
    else if (p.leg === 'out' && s.t - p.timer > 60) { p.leg = 'to'; p.timer = s.t; this.cmd(a, { type: 'direct', points: [p.fix] }); }
    else if (p.leg === 'to' && s.t - p.timer > 15 && a.route.length === 0) this.cmd(a, { type: 'direct', points: [p.fix] });
  }
  remaining(o) { let rem = 0; if (o.routeIdx < o.route.length) { rem = dist(o, o.route[o.routeIdx]); for (let i = o.routeIdx + 1; i < o.route.length; i++) rem += dist(o.route[i - 1], o.route[i]); } return rem; }
  basePoint(runway, side) { const rw = this.shift.airport.ends[runway]; return advance(this.shift.airport.finalPoint(runway, ALONG_T + 4 / Math.tan(30 * Math.PI / 180)), rw.finalCourse + 180 + side * 90, 4); }
  sideOf(runway, fix) { const rw = this.shift.airport.ends[runway]; const { cross } = trackOffsets(rw.thr, rw.finalCourse + 180, fix); return cross >= -0.5 ? 1 : -1; }
  dropSlot(a) { this.slots = (this.slots ?? []).filter((x) => x.ac !== a.id); }
  /** Slot: earliest feasible join time inserted among the existing slots (spacing from the neighbours before and after, departure gaps when
   *  crossing-runway departures wait); release when within reach, with a dogleg absorbing the residual. Inside the base area the join is direct. */
  slotPlan(a, p, arrivals, acs) {
    const s = this.shift, ap = s.airport, cfg = s.config;
    this.slots ??= []; this.slots = this.slots.filter((x) => { const o = s.aircraft.get(x.ac); return o && !o.done && !o.onGround && x.t > s.t - 900; }).sort((x, y) => x.t - y.t);
    const GS_JOIN = Math.min(170, a.perf.vApp + 30), GS_TRANSIT = Math.min(190, a.perf.vMax);
    const depsWaiting = [...s.aircraft.values()].some((o) => o.kind === 'DEP' && (o.mode === MODES.QUEUE || o.mode === MODES.LUAW) && cfg.arrivals.some((r) => ap.intersecting(o.runway, r)));
    // departure gaps: with crossing-runway departures waiting, at most two arrivals per 95 s window (a pair), then ≥ 95 s for a pair of departures
    const paired = (x) => this.slots.some((y) => y !== x && y.t < x.t && x.t - y.t < 95);
    const gapS = (lead, leadRwy, trail, rwy, leadSlot) => Math.max(this.spacingFor(lead, leadRwy, trail, rwy) / Math.min(170, trail.perf.vApp + 30, lead.perf.vApp + 30) * 3600, depsWaiting && leadSlot && paired(leadSlot) ? 95 : 0);
    let best = null;
    for (const runway of cfg.arrivals) {
      const rw = ap.ends[runway]; const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, a);
      let route, pathLen, alongT;
      const direct = along < 26 && along > 12 && Math.abs(cross) <= 8 && along - Math.abs(cross) / Math.tan(30 * Math.PI / 180) >= 12;
      if (direct) { alongT = Math.min(ALONG_T, along - Math.abs(cross) / Math.tan(30 * Math.PI / 180)); const T = ap.finalPoint(runway, alongT); route = [{ ...T, fix: 'JOIN' }]; pathLen = dist(a, T); }
      else { alongT = ALONG_T; const B = this.basePoint(runway, p.side), T = ap.finalPoint(runway, alongT); route = [{ ...B, fix: 'BASE' }, { ...T, fix: 'JOIN' }]; pathLen = dist(a, B) + dist(B, T); }
      const v0 = Math.max(GS_TRANSIT, a.gs || GS_TRANSIT);
      const tE = s.t + (Math.min(pathLen, 3) / v0 + Math.max(0, pathLen - 3) / GS_TRANSIT) * 3600;
      // earliest t ≥ tE that fits between existing slots
      let tSlot = tE;
      for (let guard = 0; guard < 12; guard++) {
        let moved = false;
        for (const x of this.slots) {
          const o = s.aircraft.get(x.ac); if (!o) continue;
          if (x.t <= tSlot) { const need = gapS(o, x.runway, a, runway, x); if (tSlot - x.t < need) { tSlot = x.t + need; moved = true; } }
          else { const need = gapS(a, runway, o, x.runway, null); if (x.t - tSlot < need) { tSlot = x.t + gapS(o, x.runway, a, runway, x); moved = true; } } // cannot fit before x: go behind it
        }
        if (!moved) break;
      }
      if (!best || tSlot < best.tSlot) best = { runway, route, pathLen, tE, tSlot, alongT, direct };
    }
    const wait = best.tSlot - best.tE;
    if (wait > 60) { this.note('slotWait'); return null; } // more than a minute early: hold at the fix rather than fly a wide dogleg
    const joinAlt = cfg.arrivals.indexOf(best.runway) <= 0 ? 4000 : 5000; // stagger the parallels: first arrival runway 4,000, second 5,000 until established (visual pairs)
    // dogleg: extra path E = wait × 190 kt as a lateral offset at the midpoint of the first leg (outward, away from the final axis)
    const E = wait * GS_TRANSIT / 3600; const route = [...best.route];
    const first = route[0]; const L = dist(a, first);
    if (E > 0.4 && L > 2) {
      const h = Math.sqrt(Math.max(0, ((L + E) / 2) ** 2 - (L / 2) ** 2));
      const mid = { x: (a.x + first.x) / 2, y: (a.y + first.y) / 2 }; const brg = bearingTo(a, first);
      route.unshift({ ...advance(mid, brg + p.side * 90, h), fix: 'DELAY' });
    }
    this.slots.push({ t: best.tSlot, ac: a.id, runway: best.runway, cwt: a.cwt, joinAlt }); this.slotCount = (this.slotCount ?? 0) + 1;
    return { runway: best.runway, route, B: route[route.length - 2] ?? { x: a.x, y: a.y }, joinAlt, slot: best.tSlot };
  }
  /** Spacing (NM) required behind `lead` (landing `leadRwy`) for `trail` landing `rwy`, measured on the shared final stream. */
  spacingFor(lead, leadRwy, trail, rwy) {
    const w = this.shift.weather.current, same = leadRwy === rwy;
    let req; if (w.conditions === CONDITIONS.VISUAL) req = same ? 3.0 : 1.0; else if (w.conditions === CONDITIONS.MARGINAL) req = same ? 3.0 : 2.0; else req = 3.5;
    // wake in both orders when a heavy is involved (a close pair can swap order on the way to the join)
    const wakeFwd = Math.max(wakeBehind(lead.cwt, trail.cwt), wakeAtThreshold(lead.cwt, trail.cwt));
    const wakeRev = Math.max(wakeBehind(trail.cwt, lead.cwt), wakeAtThreshold(trail.cwt, lead.cwt));
    const wake = Math.max(wakeFwd, /^[A-D]$/.test(trail.cwt) ? wakeRev : 0);
    // compression: the trailer closes on a slower leader over the last ~5 NM at Vapp and the 5 NM before at ≤ 180 kt
    const comp = 5 * Math.max(0, trail.perf.vApp / lead.perf.vApp - 1) + 5 * Math.max(0, Math.min(180, trail.perf.vMax) / Math.min(180, lead.perf.vMax) - 1);
    return Math.max(req, wake ? wake + 0.5 : 0) + 0.3 + (same ? 1.0 : 0.3) + (wake ? 0.8 : 0) + comp; // buffer + compression allowance
  }
  exitFix(a) {
    const legs = a.route ?? [];
    for (let i = legs.length - 1; i >= 0; i--) { const l = legs[i]; if (Math.hypot(l.x, l.y) >= 6) return { fix: l.fix, x: l.x, y: l.y, alt: l.alt1 ?? null, altDesc: l.altDesc }; }
    return { fix: a.callsign + '-HOLD', x: a.x, y: a.y, alt: null };
  }
  stackBase(a, fix) { let base = Math.max(8000, fix.alt ? Math.ceil(fix.alt / 1000) * 1000 : 8000); return Math.min(base, 12000); }
  stackKey(fix) { this.stackFixes ??= []; let k = this.stackFixes.find((f) => dist(f, fix) < 9); if (!k) { k = { fix: fix.fix, x: fix.x, y: fix.y }; this.stackFixes.push(k); } return k.fix; }
  enterStack(a, p) { this.stacks ??= {}; const st = (this.stacks[this.stackKey(p.fix)] ??= []); if (!st.includes(a.id)) st.push(a.id); }
  leaveStack(a, p) { if (!p.fix) return; const st = this.stacks?.[this.stackKey(p.fix)]; if (st) { const i = st.indexOf(a.id); if (i >= 0) st.splice(i, 1); } }
  stackLevelFor(a, p) {
    const key = this.stackKey(p.fix); const st = this.stacks?.[key] ?? []; const i = st.indexOf(a.id);
    this.stackBaseByKey ??= {}; this.stackBaseByKey[key] = Math.max(this.stackBaseByKey[key] ?? 0, p.stackBase); p.stackBase = this.stackBaseByKey[key];
    if (i >= 0) { // holder: its level, but step down only once the holder below has settled at its own level
      const level = Math.min(13000, p.stackBase + 1000 * i);
      if (i > 0) { const below = this.shift.aircraft.get(st[i - 1]); const belowLevel = Math.min(13000, p.stackBase + 1000 * (i - 1)); if (below && Math.abs(below.alt - belowLevel) > 150 && level < a.tgt.alt) return a.tgt.alt; }
      return level;
    }
    // inbound: above the highest holder (actual altitude or level) and above every other inbound closer to this fix
    let top = p.stackBase - 1000;
    for (let k = 0; k < st.length; k++) { const o = this.shift.aircraft.get(st[k]); top = Math.max(top, p.stackBase + 1000 * k, o ? Math.ceil((o.alt - 100) / 1000) * 1000 : 0); }
    const d = dist(a, p.fix); let extra = 0;
    for (const o of this.shift.aircraft.values()) { if (o === a || o.done || o.kind !== 'ARR') continue; const po = this.plan.get(o.id); if (!po?.fix || po.state !== 'star' || this.stackKey(po.fix) !== key) continue; if (dist(o, po.fix) < d) extra++; }
    return Math.min(13000, st.length === 0 ? p.stackBase + 1000 * extra : top + 1000 * (1 + extra));
  }
  lowestInStack(a, p) { const st = this.stacks?.[this.stackKey(p.fix)] ?? []; return st.length === 0 || st[0] === a.id; }
  note(k) { this.why ??= {}; this.why[k] = (this.why[k] ?? 0) + 1; }
  /** Is the altitude band between the aircraft's current level (exclusive of ±950) and `alt` free of other traffic within 4 NM? Co-altitude traffic never blocks a move away. */
  pathClear(a, alt, acs) {
    if (Math.abs(alt - a.alt) < 50) return true;
    const down = alt < a.alt;
    // everything between the target (±950) and our level counts, plus co-altitude traffic on the side we move toward; traffic on the far side (above us when descending) does not
    const lo = down ? alt - 950 : a.alt, hi = down ? a.alt : alt + 950;
    return !acs.some((o) => o !== a && !o.onGround && !o.done && o.mode !== MODES.TAKEOFF && dist(o, a) < 4 && o.alt > lo && o.alt < hi);
  }
  /** A STAR arrival descending via its procedure stops at its current level while traffic sits in the band below it. */
  descentGuard(a, acs) {
    const target = a.tgt.altAssigned ? a.tgt.alt : a.routeAltitude();
    if (target >= a.alt - 50) { if (a.tgt.altAssigned && a.flags.guarded && this.pathClear(a, a.flags.guarded, acs)) { this.cmd(a, { type: 'altitude', alt: a.flags.guarded }); a.flags.guarded = null; } return; }
    if (!this.pathClear(a, target, acs)) { const hold = Math.max(target + 1000, Math.ceil((a.alt - 100) / 1000) * 1000); if (a.tgt.alt !== hold || !a.tgt.altAssigned) { this.cmd(a, { type: 'altitude', alt: hold }); a.flags.guarded = target; } }
  }
  layerAltitude(a, arrivals) {
    const taken = new Set();
    for (const o of arrivals) { if (o === a || o.mode === MODES.FINAL || o.onGround) continue; if (dist(o, a) < 7) taken.add(Math.round(o.tgt.alt / 1000) * 1000); }
    const cur = Math.round(a.tgt.alt / 1000) * 1000;
    if (cur >= 6000 && cur <= 9000 && !taken.has(cur)) return cur;
    for (const alt of [6000, 7000, 8000, 9000]) if (!taken.has(alt)) return alt;
    return 6000;
  }
  /** On final: if the leader on the same/close-parallel final is inside our spacing, slow to Vapp+10 early (speed control in lieu of a go-around). */
  /** On final: keep the legal gap to the leader on the same / close-parallel final to touchdown by speed; if it cannot be kept, go around early. */
  finalSpeedControl(a, arrivals) {
    const lead = this.aheadOnFinal(a, arrivals); if (!lead) return;
    const w = this.shift.weather.current, same = lead.runway === a.runway;
    const base = w.conditions === CONDITIONS.VISUAL ? (same ? (a.finalDistNm <= 10 ? 2.5 : 3.0) : 0) : w.conditions === CONDITIONS.MARGINAL ? (same ? 2.5 : 1.5) : (a.finalDistNm <= 10 ? 2.5 : 3.0);
    const wake = Math.max(wakeBehind(lead.cwt, a.cwt), wakeAtThreshold(lead.cwt, a.cwt));
    const need = Math.max(base, wake ? wake + 0.2 : 0);
    const gap = a.finalDistNm - lead.finalDistNm;
    if (need === 0) return;
    const slow = Math.max(a.perf.vApp, 130);
    const match = Math.max(a.perf.vApp, Math.min(180, Math.round((lead.ias - 5) / 10) * 10)); // a little slower than the leader
    const want = gap < need + 0.8 ? slow : gap < need + 1.8 ? Math.min(match, 170) : null;
    if (want != null && a.finalDistNm > 4 && !(a.tgt.iasAssigned && a.tgt.ias <= want)) this.cmd(a, { type: 'speed', ias: want });
    else if (gap > need + 3 && a.finalDistNm > 8 && a.tgt.iasAssigned && a.tgt.ias < 180) this.cmd(a, { type: 'speed', ias: 180 });
    if (gap < need - 0.2 && lead.finalDistNm > 0 && a.finalDistNm > 1.2) { // the minimum cannot be kept: go around (inside 8 NM) or break out and re-sequence
      if (a.finalDistNm < 8) this.ga(a, `gap ${gap.toFixed(1)} < need ${need.toFixed(1)} behind ${lead.callsign} at ${a.finalDistNm.toFixed(1)} NM`);
      else { const rw = this.shift.airport.ends[a.runway]; const { cross } = trackOffsets(rw.thr, rw.finalCourse + 180, a); this.shift.events.push({ t: this.shift.t, type: 'BOT_RESEQ', ac: a.id, why: `breakout: gap ${gap.toFixed(1)} < need ${need.toFixed(1)} behind ${lead.callsign} at ${a.finalDistNm.toFixed(1)} NM` }); this.cmd(a, { type: 'heading', hdg: wrap360(rw.finalCourse + (cross >= 0 ? 40 : -40)) }); const p = this.plan.get(a.id); if (p) p.state = 'goaround'; }
    }
  }
  bestRunway(a, arrivals) {
    const ap = this.shift.airport, cfg = this.shift.config;
    if (!cfg.pairedArrivals) return a.runway;
    let best = a.runway, bestGap = -99;
    for (const rwy of cfg.arrivals) {
      const lead = arrivals.filter((o) => o !== a && (o.mode === MODES.FINAL || this.plan.get(o.id)?.state === 'released') && o.runway === rwy).sort((x, y) => y.finalDistNm - x.finalDistNm)[0];
      let gap = lead ? BASE_NM - (lead.mode === MODES.FINAL ? lead.finalDistNm : BASE_NM + 8) : 99;
      if ([...this.shift.aircraft.values()].some((o) => o.kind === 'DEP' && (o.mode === MODES.LUAW || o.mode === MODES.TAKEOFF) && o.runway === rwy)) gap -= 20; // a departure is using it
      if (gap > bestGap) { bestGap = gap; best = rwy; }
    }
    return best;
  }
  /** Where an arrival is (or will be) along the final axis, NM from the threshold. */
  projectedFinalNm(o) {
    if (o.mode === MODES.FINAL) return o.finalDistNm;
    const rw = this.shift.airport.ends[o.runway]; const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, o);
    return along + 0.27 * Math.abs(cross);
  }
  /** Nearest aircraft ahead of `a` (closer to the threshold) established on the same / close-parallel final. */
  aheadOnFinal(a, arrivals) {
    const ap = this.shift.airport; let best = null;
    for (const o of arrivals) { if (o === a || o.mode !== MODES.FINAL || !ap.sameOrCloseParallel(o.runway, a.runway) || o.finalDistNm >= a.finalDistNm) continue; if (!best || o.finalDistNm > best.finalDistNm) best = o; }
    return best;
  }
  leadOnFinal(a, arrivals) {
    const ap = this.shift.airport;
    return arrivals.filter((o) => o !== a && (o.mode === MODES.FINAL || o.mode === MODES.APPROACH) && ap.sameOrCloseParallel(o.runway, a.runway))
      .map((o) => ({ o, d: this.projectedFinalNm(o) })).sort((x, y) => y.d - x.d)[0]?.o ?? null;
  }
  runwayFreeForLanding(a, acs, atThreshold = false) {
    const ap = this.shift.airport, rw = ap.ends[a.runway];
    for (const o of acs) {
      if (o === a) continue;
      if (o.onRunway === rw.physical) {
        if (o.kind === 'DEP' && o.liftoffAt != null && o.rolledFt > srsDistanceFt(o.srs, a.srs) + 500) continue;
        if (o.kind === 'ARR' && o.clearedRunwayAt != null) continue;
        if (atThreshold && o.kind === 'ARR' && o.mode === MODES.ROLLOUT && o.ias < 60 && o.alongRunwayFt > 6000 && a.srs !== 'III') continue;
        return false;
      }
      if (o.kind === 'DEP' && (o.mode === MODES.LUAW || o.mode === MODES.TAKEOFF) && o.runway === a.runway) return false;
      if (!atThreshold && o.kind === 'ARR' && o.mode === MODES.FINAL && o.runway === a.runway && o.finalDistNm < a.finalDistNm && a.finalDistNm - o.finalDistNm < 1.5) return false;
    }
    return true;
  }
  handleDeparture(d, acs) {
    const s = this.shift, ap = s.airport, rw = ap.ends[d.runway];
    if (d.mode === MODES.CLIMB || d.mode === MODES.SID || (d.mode === MODES.VECTOR && d.kind === 'DEP')) return this.capDeparture(d, acs);
    if (d.mode !== MODES.QUEUE && d.mode !== MODES.LUAW) return;
    const occupied = acs.some((o) => o !== d && o.onRunway === rw.physical && !(o.kind === 'DEP' && o.liftoffAt != null && o.rolledFt > 6500));
    const luawOthers = acs.some((o) => o !== d && o.kind === 'DEP' && o.mode === MODES.LUAW && o.runway === d.runway);
    const arrivalRunway = s.config.arrivals.includes(d.runway);
    if (d.mode === MODES.QUEUE) {
      // line up when the runway is free of other departures lining up and no arrival is inside 2.5 NM (8 NM on a runway arrivals use)
      const shortFinal = acs.some((o) => o.kind === 'ARR' && o.runway === d.runway && !o.onGround && (arrivalRunway || (o.mode === MODES.FINAL && o.finalDistNm < 2.5)));
      if (!luawOthers && !occupied && !shortFinal) this.cmd(d, { type: 'luaw' });
      return;
    }
    if (!d.clearedTakeoff && d.mode === MODES.LUAW && d.modeTimer > 150 && arrivalRunway) { this.cmd(d, { type: 'holdshort' }); return; } // give the runway back to the arrivals
    if (d.clearedTakeoff || !d.onRunway) return; // clear for takeoff only once lined up (the 20 s line-up would spoil the timing)
    // 1) same / close-parallel wake interval + SRS behind the previous departure; parallel release only on diverging courses (5-8-3)
    for (const o of acs) {
      if (o === d || o.kind !== 'DEP') continue;
      if (ap.sameOrCloseParallel(o.runway, d.runway) && o.rollStartAt != null && o.mode !== MODES.QUEUE) {
        const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return;
        if (o.runway === d.runway && !(o.liftoffAt != null && (o.rolledFt >= srsDistanceFt(o.srs, d.srs) + 300 || o.onRunway == null))) return;
        if (o.runway === d.runway && o.perf.small && !d.perf.small && Math.hypot(o.x, o.y) < 5) return; // a jet would overtake a small aircraft ahead: wait until it is 5 NM out
        if (o.runway !== d.runway && s.t - o.rollStartAt < 75 && Math.abs(angDiff(this.initialCourse(o), this.initialCourse(d))) < 15) return;
        if (o.runway !== d.runway && s.t - o.rollStartAt < 30) return; // even diverging courses: 30 s between parallel rolls (1 NM by the turn)
      }
      // crossing runways wake (3-9-8)
      if (ap.intersecting(o.runway, d.runway) && o.rollStartAt != null && (o.mode === MODES.TAKEOFF || o.mode === MODES.CLIMB || o.mode === MODES.SID || o.mode === MODES.VECTOR)) { const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return; }
    }
    // 2) crossing-runway departures still rolling short of the intersection (3-9-8 a)
    for (const o of acs) {
      if (o === d || o.kind !== 'DEP' || !o.onRunway) continue;
      const sect = ap.intersecting(o.runway, d.runway); if (!sect) continue;
      const turning = o.liftoffAt != null && Math.abs(angDiff(o.hdg, ap.ends[o.runway].hdg)) >= 15;
      if (o.alongRunwayFt < sect.fromThrFt[o.runway] && !turning && (o.mode === MODES.TAKEOFF || o.mode === MODES.LUAW)) return;
    }
    // 3) arrivals on the same runway: none inside 6 NM (SRS: the arrival must not cross the threshold before we are past 6,000 ft / airborne)
    for (const o of acs) {
      if (o.kind !== 'ARR') continue;
      if (o.runway === d.runway && o.mode === MODES.FINAL && o.finalDistNm < (this.assist ? 5 : 3)) return;
      if (o.onRunway === rw.physical && o.clearedRunwayAt == null) return;
      // 3) crossing protection (3-9-8 / 3-10-4): 1L/1R departures vs 28L/28R arrivals
      const sect = ap.intersecting(o.runway, d.runway);
      if (!sect) continue;
      const past = o.onRunway ? o.alongRunwayFt >= sect.fromThrFt[o.runway] : true;
      if (o.onRunway && !past && o.clearedRunwayAt == null) return;            // rolling toward the intersection
      if (o.mode === MODES.FINAL) {
        if (this.assist) {
          const tArr = o.finalDistNm / Math.max(110, o.gs) * 3600;          // s to its threshold
          const tCross = Math.sqrt(2 * sect.fromThrFt[d.runway] / (d.perf.accelGround * 1.6878)) + 12; // s to pass the intersection + margin
          if (tArr < tCross) return;
        } else if (o.finalDistNm < 2.5) return;                              // no prediction: only refuse when the arrival is close
      }
    }
    if (occupied) return;
    this.cmd(d, { type: 'takeoff' }); this.lastRoll[d.runway] = { t: s.t, cwt: d.cwt, id: d.id };
  }
  initialCourse(d) { const rw = this.shift.airport.ends[d.runway]; const f = d.sid?.route?.[0]; return f ? bearingTo(rw.thr, f) : rw.hdg; }
  /** Keep a climbing departure 1,000 ft under any arrival within 6 NM (then let it climb). */
  capDeparture(d, acs) {
    const r = Math.hypot(d.x, d.y); if (r > 14) { if (d.tgt.altAssigned && d.tgt.alt < 10000) this.cmd(d, { type: 'altitude', alt: 10000 }); return; }
    let cap = 10000;
    for (const o of acs) { if (o.kind !== 'ARR' || o.onGround) continue; if (dist(o, d) < 6 && o.alt > d.alt - 500) cap = Math.min(cap, Math.max(3000, Math.floor((o.alt - 1000) / 1000) * 1000)); }
    if (cap < d.tgt.alt && (cap < d.alt + 300 || cap <= 4000)) this.cmd(d, { type: 'altitude', alt: cap });
    else if (cap === 10000 && d.tgt.alt < 10000) this.cmd(d, { type: 'altitude', alt: 10000 });
  }
}
