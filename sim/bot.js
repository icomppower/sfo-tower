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
    const others = air.filter((o) => o !== m && dist(o, m) < 7).map((o) => ({ lo: Math.min(o.alt, eff(o)) - 950, hi: Math.max(o.alt, eff(o)) + 950 }));
    const cands = [3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000].filter((c) => m.kind === 'ARR' ? c >= 4000 : true).sort((x, y) => Math.abs(x - m.alt) - Math.abs(y - m.alt));
    for (const c of cands) {
      const lo = Math.min(m.alt, c), hi = Math.max(m.alt, c);
      if (others.every((o) => o.hi < lo || o.lo > hi)) return c;
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
    return Math.max(req, wake ? wake + 0.5 : 0) + (this.assist ? 0.3 : 0) + 1.0; // +1 NM compression allowance (the leader slows to Vapp inside 5 NM)
  }
  handleArrival(a, arrivals, acs) {
    const s = this.shift, ap = s.airport, rw = ap.ends[a.runway];
    const p = this.plan.get(a.id) ?? { state: 'inbound', timer: 0 }; this.plan.set(a.id, p);
    const r = Math.hypot(a.x, a.y);
    if (a.mode === MODES.GOAROUND) { p.state = 'inbound'; return; }
    if (a.mode === MODES.FINAL) {
      p.state = 'final';
      this.finalSpeedControl(a, arrivals);
      const free = this.runwayFreeForLanding(a, acs);
      if (!a.clearedLand && a.finalDistNm <= 3.5 && free) this.cmd(a, { type: 'land', runway: a.runway });
      if (!a.clearedLand && a.finalDistNm <= 1.6 && !free) this.cmd(a, { type: 'goaround' });
      if (a.clearedLand && a.finalDistNm <= 1.0 && a.finalDistNm > 0 && !this.runwayFreeForLanding(a, acs, true)) this.cmd(a, { type: 'goaround' });
      return;
    }
    if (a.mode === MODES.APPROACH) { if (s.t - p.timer > 300) p.state = 'inbound'; else return; } // intercepting; give up after 5 min without capture
    const altHeld = (p.holdAltUntil ?? 0) > s.t; // the conflict resolver owns this aircraft's altitude for a while
    const setAlt = (alt) => { if (!altHeld && a.tgt.alt !== alt) this.cmd(a, { type: 'altitude', alt }); };
    // speed / altitude management inbound
    if (r < 30 && !a.tgt.iasAssigned && a.ias > 215) this.cmd(a, { type: 'speed', ias: 210 });
    if (a.mode === MODES.STAR) { const base = ap.finalPoint(a.runway, BASE_NM); if (dist(a, base) > 10 && r > 15) { if (r < 28 && a.tgt.alt > 7000 && a.alt <= 9000) setAlt(6000); return; } }
    const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, a); // along = NM out along the final axis
    const side = Math.abs(cross) < 0.3 ? (p.side ?? 1) : Math.sign(cross); p.side = side;
    // never let an arrival leave the scope: turn back toward the base area
    if (r > 27 && a.mode !== MODES.STAR) { const base = ap.finalPoint(a.runway, BASE_NM + 4); const h = bearingTo(a, base); if (Math.abs(angDiff(h, a.tgt.hdg)) > 5 || a.mode !== MODES.VECTOR) this.cmd(a, { type: 'heading', hdg: h }); if (a.tgt.alt > 7000) setAlt(7000); p.state = 'return'; p.timer = s.t; return; }
    // spacing decision: where would we join the final if we turned now?
    // a 30° intercept from |cross| off the axis joins at along − 1.73·|cross|; meanwhile the leader closes ~2·|cross| toward the runway
    const joinAlong = along - 1.73 * Math.abs(cross);
    const ourNm = along + 0.27 * Math.abs(cross);
    const lead = this.leadOnFinal(a, arrivals);
    const leadNm = lead ? this.projectedFinalNm(lead) : -99;
    const gap = ourNm - leadNm;
    const need = lead ? this.spacing(lead, a) : 0;
    // another arrival still intercepting (not established) nearby → we join 1,000 ft higher (paired approaches are stacked until established)
    const other = arrivals.find((o) => o !== a && o.mode === MODES.APPROACH && dist(o, a) < 6);
    const joinAlt = other ? (other.tgt.alt <= 4000 ? 5000 : 4000) : 4000;
    const minJoin = joinAlt >= 5000 ? 14 : 10; // stay below the glideslope at the join (GS ≈ 4,100 ft at 13 NM)
    this.why ??= {}; const why = gap < need ? 'gap' : joinAlong < minJoin ? 'joinAlong' : along > 27 ? 'far' : Math.abs(cross) > 8 ? 'cross' : 'ok'; this.why[why] = (this.why[why] ?? 0) + 1;
    if (why === 'ok') {
      const best = this.bestRunway(a, arrivals); if (best !== a.runway) a.runway = best;
      const rwy = ap.ends[a.runway]; const sd = trackOffsets(rwy.thr, rwy.finalCourse + 180, a).cross > 0 ? 1 : -1;
      this.cmd(a, { type: 'heading', hdg: wrap360(rwy.finalCourse + sd * INTERCEPT_DEG) });
      this.cmd(a, { type: 'altitude', alt: joinAlt });
      this.cmd(a, { type: 'approach', runway: a.runway, kind: rwy.ils ? 'ILS' : rwy.approachType });
      p.state = 'intercept'; p.timer = s.t; return;
    }
    // delay: trombone on our side of the final — move ≥ 4 NM off the centreline, run downwind (outbound) between 12 and 22 NM out
    let h;
    if (Math.abs(cross) < 4) h = wrap360(rw.finalCourse + 180 + side * 50);
    else if (along < 12) h = wrap360(rw.finalCourse + 180);
    else if (along > 22 || (p.state === 'inbound-leg' && along > 13)) { h = wrap360(rw.finalCourse); p.state = 'inbound-leg'; }
    else h = wrap360(rw.finalCourse + 180);
    if (p.state !== 'inbound-leg') p.state = 'delay';
    if (Math.abs(angDiff(h, a.tgt.hdg)) > 8 || a.mode === MODES.STAR) this.cmd(a, { type: 'heading', hdg: h });
    // altitude layering: delaying arrivals within 6 NM of each other sit 1,000 ft apart (5,000 / 6,000 / 7,000)
    setAlt(this.layerAltitude(a, arrivals));
    if (!(a.tgt.iasAssigned && a.tgt.ias <= 190)) this.cmd(a, { type: 'speed', ias: 190 });
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
    if (gap < need + 0.5 && a.finalDistNm > 5 && !(a.tgt.iasAssigned && a.tgt.ias <= slow)) this.cmd(a, { type: 'speed', ias: slow });
    else if (gap > need + 2 && a.finalDistNm > 8 && a.tgt.iasAssigned && a.tgt.ias < 180) this.cmd(a, { type: 'speed', ias: 180 });
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
