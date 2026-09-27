// Rules-following bot controller (T6/T7 oracle and the in-game "autopilot" demo). Deterministic: no randomness.
// assist=true: uses time-to-threshold prediction for runway crossings and spacing; assist=false: reacts to positions only, slower cadence.
import { MODES } from './aircraft.js';
import { dist, trackOffsets, angDiff, wrap360, bearingTo, advance } from './geo.js';
import { wakeAtThreshold, wakeBehind, wakeDepartureInterval, srsDistanceFt } from './rules.js';
import { CONDITIONS } from './weather.js';

const BASE_NM = 13;        // where the bot turns arrivals onto the final (NM from threshold)
const INTERCEPT_DEG = 30;
export class Bot {
  constructor(shift, opts = {}) {
    this.shift = shift; this.assist = opts.assist ?? shift.assist; this.cadence = this.assist ? 2 : 6; this.lastTick = -99;
    this.plan = new Map(); // ac.id → { state, timer, side }
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
  cmd(ac, c) { return this.shift.command(ac.id, c); }
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
      if (want == null) continue;
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
    return Math.max(req, wake ? wake + 0.5 : 0) + (this.assist ? 0.3 : 0) + 1.0 + (wake ? 0.8 : 0); // compression allowance: the leader slows to Vapp inside 5 NM
  }
  /** Arrival flow v4 — hold at the STAR exit fix (one altitude stack per fix, lowest released first), release via a base point B
   *  (4 NM off the axis) to a 30° intercept of the final at T (14 NM), sequencing releases by predicted join time. */
  handleArrival(a, arrivals, acs) {
    const s = this.shift, ap = s.airport;
    const p = this.plan.get(a.id) ?? { state: 'star', timer: 0 }; this.plan.set(a.id, p);
    const r = Math.hypot(a.x, a.y);
    if (a.mode === MODES.GOAROUND) { p.state = 'goaround'; return; }
    if (a.mode === MODES.FINAL) {
      p.state = 'final'; this.leaveStack(a, p);
      this.finalSpeedControl(a, arrivals);
      const free = this.runwayFreeForLanding(a, acs);
      if (!a.clearedLand && a.finalDistNm <= 3.5 && free) this.cmd(a, { type: 'land', runway: a.runway });
      if (!a.clearedLand && a.finalDistNm <= 1.6 && !free) this.cmd(a, { type: 'goaround' });
      if (a.clearedLand && a.finalDistNm <= 1.0 && a.finalDistNm > 0 && !this.runwayFreeForLanding(a, acs, true)) this.cmd(a, { type: 'goaround' });
      return;
    }
    if (p.state === 'released' && (a.mode === MODES.VECTOR || a.mode === MODES.APPROACH)) { // on the way to B → T
      if (!a.clearedApproach && (a.routeIdx >= 1 || dist(a, p.B) < 2.5)) this.cmd(a, { type: 'approach', runway: a.runway, kind: ap.ends[a.runway].ils ? 'ILS' : ap.ends[a.runway].approachType });
      if (a.routeIdx >= 1 && a.tgt.alt > p.joinAlt && this.pathClear(a, p.joinAlt, acs)) this.cmd(a, { type: 'altitude', alt: p.joinAlt });
      if (a.routeIdx >= 2 && s.t - p.timer > 90) { this.cmd(a, { type: 'heading', hdg: Math.round(a.hdg / 5) * 5 || 360 }); p.state = 'goaround'; } // flew through: re-sequence via the fix
      return;
    }
    if (a.mode === MODES.APPROACH) return;
    const altHeld = (p.holdAltUntil ?? 0) > s.t;
    const setAlt = (alt) => { if (!altHeld && a.tgt.alt !== alt && this.pathClear(a, alt, acs)) { this.cmd(a, { type: 'altitude', alt }); return true; } return false; };
    if (r < 30 && !a.tgt.iasAssigned && a.ias > 215) this.cmd(a, { type: 'speed', ias: 210 });
    // ---- which fix does this arrival hold at?
    if (!p.fix) { p.fix = this.exitFix(a); p.stackBase = this.stackBase(a, p.fix); }
    if (p.state === 'goaround' || p.state === 'return') { // after a go-around: fly to the fix on the missed-approach side and re-enter its stack
      if (p.state === 'goaround') { p.state = 'return'; this.leaveStack(a, p); this.cmd(a, { type: 'direct', points: [p.fix] }); }
      if (dist(a, p.fix) > 2.5) { setAlt(this.stackLevelFor(a, p)); return; }
      p.state = 'star';
    }
    const level = this.stackLevelFor(a, p);
    // ---- release check (lowest in its stack, or still inbound on the STAR): does the final have room for us?
    const rel = this.releasePlan(a, p, arrivals);
    if (rel && this.pathClear(a, Math.min(level, rel.relAlt), acs)) {
      this.leaveStack(a, p);
      a.runway = rel.runway;
      this.cmd(a, { type: 'direct', points: [rel.B, rel.T] });
      this.cmd(a, { type: 'altitude', alt: rel.relAlt });
      if (!(a.tgt.iasAssigned && a.tgt.ias <= 190)) this.cmd(a, { type: 'speed', ias: 190 });
      p.state = 'released'; p.timer = s.t; p.joinAlt = rel.joinAlt; p.relAlt = rel.relAlt; p.joinT = rel.tJoin; p.pathLen = rel.pathLen; p.alongT = rel.alongT; p.B = rel.B;
      this.why ??= {}; this.why.ok = (this.why.ok ?? 0) + 1;
      return;
    }
    // ---- not released: on the STAR keep flying it toward the fix (descending to the stack level early); at the fix, hold
    if (a.mode === MODES.STAR && dist(a, p.fix) > 2) { if (r < 40 && Math.abs(a.alt - level) > 50 && (this.stacks?.[this.stackKey(p.fix)]?.length ?? 0) > 0) setAlt(level); else if (r < 40 && a.alt > level + 50) setAlt(level); this.descentGuard(a, acs); return; }
    if (p.state !== 'hold') { p.state = 'hold'; p.leg = 'to'; p.timer = s.t; this.enterStack(a, p); this.cmd(a, { type: 'direct', points: [p.fix] }); if (!(a.tgt.iasAssigned && a.tgt.ias <= 190)) this.cmd(a, { type: 'speed', ias: 190 }); }
    setAlt(this.stackLevelFor(a, p));
    // racetrack at the fix: outbound away from the airport for 60 s, then back to the fix
    const d = dist(a, p.fix), away = bearingTo({ x: 0, y: 0 }, p.fix);
    if (p.leg === 'to' && d < 1.2) { p.leg = 'out'; p.timer = s.t; this.cmd(a, { type: 'heading', hdg: away }); }
    else if (p.leg === 'out' && s.t - p.timer > 60) { p.leg = 'to'; p.timer = s.t; this.cmd(a, { type: 'direct', points: [p.fix] }); }
    else if (p.leg === 'to' && s.t - p.timer > 15 && (a.route.length === 0 || a.tgt.hdgAssigned)) this.cmd(a, { type: 'direct', points: [p.fix] });
  }
  /** The STAR's exit fix (last fix ≥ 6 NM from the airport), or the aircraft's position if it has none. */
  exitFix(a) {
    const legs = a.route ?? [];
    for (let i = legs.length - 1; i >= 0; i--) { const l = legs[i]; if (Math.hypot(l.x, l.y) >= 6) return { fix: l.fix, x: l.x, y: l.y, alt: l.alt1 ?? null, altDesc: l.altDesc }; }
    return { fix: a.callsign + '-HOLD', x: a.x, y: a.y, alt: null };
  }
  stackBase(a, fix) {
    const rw = this.shift.airport.ends[a.runway];
    let base = Math.max(7000, fix.alt ? Math.ceil(fix.alt / 1000) * 1000 : 7000);
    for (const side of [1, -1]) if (dist(fix, this.basePoint(a.runway, side)) < 5) base = Math.max(base, 8000); // fix next to a base point: stay above released traffic
    return Math.min(base, 12000);
  }
  basePoint(runway, side) { const rw = this.shift.airport.ends[runway]; return advance(this.shift.airport.finalPoint(runway, 14 + 4 * 1.73), rw.finalCourse + 180 + side * 90, 4); }
  // ---- stacks: one FIFO list per fix name
  stackKey(fix) { this.stackFixes ??= []; let k = this.stackFixes.find((f) => dist(f, fix) < 9); if (!k) { k = { fix: fix.fix, x: fix.x, y: fix.y }; this.stackFixes.push(k); } return k.fix; }
  enterStack(a, p) { this.stacks ??= {}; const st = (this.stacks[this.stackKey(p.fix)] ??= []); if (!st.includes(a.id)) st.push(a.id); }
  leaveStack(a, p) { if (!p.fix) return; const st = this.stacks?.[this.stackKey(p.fix)]; if (st) { const i = st.indexOf(a.id); if (i >= 0) st.splice(i, 1); } }
  stackLevelFor(a, p) { const st = this.stacks?.[this.stackKey(p.fix)] ?? []; const i = st.indexOf(a.id); const idx = i >= 0 ? i : st.length; return Math.min(13000, p.stackBase + 1000 * idx); }
  lowestInStack(a, p) { const st = this.stacks?.[this.stackKey(p.fix)] ?? []; return st.length === 0 || st[0] === a.id; }
  /** If this arrival can be released now, the plan: runway, B, T, join altitude, predicted join time; else null. */
  releasePlan(a, p, arrivals) {
    const s = this.shift, ap = s.airport;
    if (p.state === 'hold' && !this.lowestInStack(a, p)) { this.note('stack'); return null; }
    if (p.state !== 'hold' && (this.stacks?.[this.stackKey(p.fix)]?.length ?? 0) > 0) { this.note('stackWait'); return null; } // holders at our fix go first
    const rw0 = ap.ends[a.runway]; const { cross } = trackOffsets(rw0.thr, rw0.finalCourse + 180, a); const side = cross >= 0 ? 1 : -1;
    const runway = this.bestRunway(a, arrivals); const rw = ap.ends[runway];
    const alongT = 14, T = ap.finalPoint(runway, alongT), B = this.basePoint(runway, side);
    const pathLen = dist(a, B) + dist(B, T);
    const gs = 190; const tJoin = pathLen / gs * 3600;
    // spacing at the join against everyone already committed to the same / close-parallel finals
    for (const o of arrivals) {
      const po = this.plan.get(o.id);
      if (o === a || !(o.mode === MODES.FINAL || o.mode === MODES.APPROACH || po?.state === 'released') || !ap.sameOrCloseParallel(o.runway, runway)) continue;
      const oNmAtJoin = o.mode === MODES.FINAL ? o.finalDistNm - Math.max(140, o.gs) * tJoin / 3600 : (po?.alongT ?? 14) + Math.max(0, (po?.pathLen ?? 0) - (s.t - (po?.timer ?? s.t)) * gs / 3600) - gs * tJoin / 3600;
      const need = this.spacing(o, a);
      if (Math.abs(alongT - oNmAtJoin) < need) { this.note('gap'); return null; } // we would join too close behind (or ahead of) o
    }
    // altitudes: each released aircraft not yet established gets its own level (6,000 / 7,000 / 8,000); join altitudes alternate 4,000 / 5,000
    const released = arrivals.filter((o) => o !== a && this.plan.get(o.id)?.state === 'released' && o.mode !== MODES.FINAL);
    const usedRel = new Set(released.map((o) => this.plan.get(o.id).relAlt));
    const relAlt = [6000, 7000, 8000].find((l) => !usedRel.has(l)) ?? 8000;
    const lastJoin = released.length ? this.plan.get(released[released.length - 1].id).joinAlt : (this.lastJoinAlt ?? 5000);
    const joinAlt = lastJoin === 4000 ? 5000 : 4000; this.lastJoinAlt = joinAlt;
    if (a.mode === MODES.STAR && dist(a, B) > 22) { this.note('far'); return null; } // too early to release: keep flying the STAR
    this.note('ok');
    return { runway, B: { ...B, fix: 'BASE' }, T: { ...T, fix: 'JOIN' }, alongT, pathLen, tJoin, joinAlt, relAlt };
  }
  note(k) { this.why ??= {}; this.why[k] = (this.why[k] ?? 0) + 1; }
  /** Is the altitude band between the aircraft's current level (exclusive of ±950) and `alt` free of other traffic within 4 NM? Co-altitude traffic never blocks a move away. */
  pathClear(a, alt, acs) {
    if (Math.abs(alt - a.alt) < 50) return true;
    const down = alt < a.alt;
    const lo = down ? alt - 950 : a.alt + 950, hi = down ? a.alt - 950 : alt + 950;
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
  finalSpeedControl(a, arrivals) {
    const lead = this.leadOnFinal(a, arrivals); if (!lead || lead.mode !== MODES.FINAL) return;
    const gap = a.finalDistNm - lead.finalDistNm, need = this.spacing(lead, a) - 1.0;
    const slow = Math.max(a.perf.vApp + 10, 150);
    const match = Math.max(a.perf.vApp, Math.min(180, Math.round((lead.ias + 5) / 10) * 10)); // never faster than the leader + 5
    const want = gap < need + 0.5 ? slow : gap < need + 1.5 ? Math.min(match, 170) : null;
    if (want != null && a.finalDistNm > 5 && !(a.tgt.iasAssigned && a.tgt.ias <= want)) this.cmd(a, { type: 'speed', ias: want });
    else if (gap > need + 2.5 && a.finalDistNm > 8 && a.tgt.iasAssigned && a.tgt.ias < 180) this.cmd(a, { type: 'speed', ias: 180 });
  }
  bestRunway(a, arrivals) {
    const ap = this.shift.airport, cfg = this.shift.config;
    if (!cfg.pairedArrivals) return a.runway;
    let best = a.runway, bestGap = -99;
    for (const rwy of cfg.arrivals) {
      const lead = arrivals.filter((o) => o !== a && o.mode === MODES.FINAL && o.runway === rwy).sort((x, y) => y.finalDistNm - x.finalDistNm)[0];
      const gap = lead ? BASE_NM - lead.finalDistNm : 99;
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
    if (d.mode === MODES.QUEUE) {
      // line up when the runway is free of other departures lining up and no arrival is inside 2 NM to this runway
      const shortFinal = acs.some((o) => o.kind === 'ARR' && o.mode === MODES.FINAL && o.runway === d.runway && o.finalDistNm < 2.5);
      if (!luawOthers && !occupied && !shortFinal) this.cmd(d, { type: 'luaw' });
      return;
    }
    if (d.clearedTakeoff || !d.onRunway) return; // clear for takeoff only once lined up (the 20 s line-up would spoil the timing)
    // 1) same / close-parallel wake interval + SRS behind the previous departure; parallel release only on diverging courses (5-8-3)
    for (const o of acs) {
      if (o === d || o.kind !== 'DEP') continue;
      if (ap.sameOrCloseParallel(o.runway, d.runway) && o.rollStartAt != null && o.mode !== MODES.QUEUE) {
        const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return;
        if (o.runway === d.runway && !(o.liftoffAt != null && (o.rolledFt >= srsDistanceFt(o.srs, d.srs) + 300 || o.onRunway == null))) return;
        if (o.runway !== d.runway && s.t - o.rollStartAt < 75 && Math.abs(angDiff(this.initialCourse(o), this.initialCourse(d))) < 15) return;
      }
      // crossing runways wake (3-9-8)
      if (ap.intersecting(o.runway, d.runway) && o.rollStartAt != null && (o.mode === MODES.TAKEOFF || o.mode === MODES.CLIMB || o.mode === MODES.SID || o.mode === MODES.VECTOR)) { const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return; }
    }
    // 2) crossing-runway departures still rolling short of the intersection (3-9-8 a)
    for (const o of acs) {
      if (o === d || o.kind !== 'DEP' || !o.onRunway) continue;
      const sect = ap.intersecting(o.runway, d.runway); if (!sect) continue;
      if (o.liftoffAt == null && o.alongRunwayFt < sect.fromThrFt[o.runway] && (o.mode === MODES.TAKEOFF || o.mode === MODES.LUAW)) return;
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
