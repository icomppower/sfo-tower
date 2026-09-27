// Separation and runway rules (FAA JO 7110.65BB; paragraphs quoted in docs/RULES.md). Produces events; never changes aircraft state.
import { MODES } from './aircraft.js';
import { dist, trackOffsets, angDiff, NM_FT } from './geo.js';
import { CONDITIONS } from './weather.js';

// TBL 5-5-1 (directly behind) and TBL 5-5-2 (on approach, at the threshold): leader row → follower column, NM; 0 = no wake minimum.
const CWT = 'ABCDEFGHI';
const T551 = { A: [0, 5, 6, 6, 7, 7, 7, 8, 8], B: [0, 3, 4, 4, 5, 5, 5, 5, 5], C: [0, 0, 0, 0, 3.5, 3.5, 3.5, 5, 5], D: [0, 3, 4, 4, 5, 5, 5, 5, 5], E: [0, 0, 0, 0, 0, 0, 0, 0, 4], F: [], G: [], H: [], I: [] };
const T552 = { A: [0, 5, 6, 6, 7, 7, 7, 8, 8], B: [0, 3, 4, 4, 5, 5, 5, 5, 6], C: [0, 0, 0, 0, 3.5, 3.5, 3.5, 5, 6], D: [0, 3, 4, 4, 5, 5, 5, 6, 6], E: [0, 0, 0, 0, 0, 0, 0, 0, 4], F: [0, 0, 0, 0, 0, 0, 0, 0, 4], G: [], H: [], I: [] };
export const wakeBehind = (leader, follower) => T551[leader]?.[CWT.indexOf(follower)] ?? 0;
export const wakeAtThreshold = (leader, follower) => T552[leader]?.[CWT.indexOf(follower)] ?? 0;
/** 3-9-6 / 3-9-8 departure time intervals (seconds) behind a leader on the same/close-parallel or crossing runway. */
export function wakeDepartureInterval(leader, follower) {
  const f = CWT.indexOf(follower);
  if (leader === 'A' && f >= 1) return 180;
  if ((leader === 'B' || leader === 'D') && f >= 1) return 120;
  if (leader === 'C' && f >= 4) return 120;
  if (leader === 'E' && follower === 'I') return 120;
  return 0;
}
/** 3-9-6 / 3-10-3 same-runway distance minima (ft) by SRS category of the pair. */
export function srsDistanceFt(leaderSrs, followerSrs) {
  if (leaderSrs === 'III' || followerSrs === 'III') return 6000;
  if (leaderSrs === 'II' || followerSrs === 'II') return 4500;
  return 3000;
}
export const RADAR_NM = 3, RADAR_FINAL_NM = 2.5, VERTICAL_FT = 1000, COLLISION_NM = 0.05, COLLISION_FT = 200;

export class Rules {
  constructor(airport, opts = {}) { this.airport = airport; this.active = new Map(); this.lastRoll = {}; this.lastThreshold = {}; this.protectionOff = !!opts.protectionOff; this.radarOff = !!opts.radarOff; }
  key(a, b, kind) { return a.id < b.id ? `${a.id}|${b.id}|${kind}` : `${b.id}|${a.id}|${kind}`; }
  raise(shift, kind, a, b, detail) {
    const k = this.key(a, b, kind); if (this.active.has(k)) return;
    this.active.set(k, shift.t);
    shift.events.push({ t: shift.t, type: kind, ac: a.id, other: b.id, ...detail });
  }
  clear(a, b, kind) { this.active.delete(this.key(a, b, kind)); }

  /** Required lateral separation between two airborne aircraft, or 0 if none applies (visual/tower separation). */
  requiredNm(a, b, weather) {
    const ap = this.airport;
    const bothFinal = a.mode === MODES.FINAL && b.mode === MODES.FINAL;
    const finalRelated = bothFinal && ap.sameOrCloseParallel(a.runway, b.runway);
    const near = (x) => Math.hypot(x.x, x.y) < 6 && x.alt < ap.elevFt + 3000;
    // tower-applied visual separation between a departure in the initial climb and other low traffic near the field (7-2-1); crossing protection covers 1s vs 28s.
    if ((a.kind === 'DEP' && (a.mode === MODES.CLIMB || a.mode === MODES.TAKEOFF || (a.mode === MODES.SID && near(a))) && near(b)) || (b.kind === 'DEP' && (b.mode === MODES.CLIMB || b.mode === MODES.TAKEOFF || (b.mode === MODES.SID && near(b))) && near(a))) return 0;
    // arrival within 1 NM of touchdown vs the departure that just rolled: runway rules apply, not radar
    if ((a.mode === MODES.FINAL && a.finalDistNm < 1.5 && near(b)) || (b.mode === MODES.FINAL && b.finalDistNm < 1.5 && near(a))) return 0;
    let req;
    if (finalRelated) {
      const same = a.runway === b.runway;
      const lead = a.finalDistNm < b.finalDistNm ? a : b, trail = lead === a ? b : a;
      if (weather.conditions === CONDITIONS.VISUAL) req = same ? RADAR_FINAL_NM : 0;            // visual approaches / side-by pairs visually separated
      else if (weather.conditions === CONDITIONS.MARGINAL) req = same ? RADAR_FINAL_NM : 1.5;   // paired instrument approaches, radar between pairs
      else req = Math.min(lead.finalDistNm, trail.finalDistNm) <= 10 ? RADAR_FINAL_NM : RADAR_NM; // in-trail on both runways
      const w = wakeBehind(lead.cwt, trail.cwt); if (w > req) req = w;                            // TBL 5-5-1 applies to the pair (parallels < 2,500 ft are one runway)
      return req;
    }
    req = RADAR_NM;
    // wake "directly behind" (5-5-4 g1): within 2,500 ft of the leader's track, behind, less than 1,000 ft below
    for (const [lead, trail] of [[a, b], [b, a]]) {
      const { cross, along } = trackOffsets(lead, lead.hdg, trail);
      if (along < 0 && Math.abs(cross) * NM_FT < 2500 && trail.alt < lead.alt + 1000 && trail.alt > lead.alt - 1000 && Math.abs(angDiff(trail.hdg, lead.hdg)) < 45) { const w = wakeBehind(lead.cwt, trail.cwt); if (w > req) req = w; }
    }
    return req;
  }

  check(shift) {
    const acs = [...shift.aircraft.values()].filter((a) => !a.done), weather = shift.weather.current, t = shift.t;
    // ---- pairwise airborne ----
    for (let i = 0; i < acs.length; i++) for (let j = i + 1; j < acs.length; j++) {
      const a = acs[i], b = acs[j];
      const d = dist(a, b), dv = Math.abs(a.alt - b.alt);
      if (d < COLLISION_NM && dv < COLLISION_FT && !(a.onGround && b.onGround && a.onRunway !== b.onRunway) && !(a.mode === MODES.QUEUE || b.mode === MODES.QUEUE)) { this.raise(shift, 'COLLISION', a, b, { nm: +d.toFixed(3) }); continue; }
      if (a.onGround || b.onGround || a.mode === MODES.TAKEOFF || b.mode === MODES.TAKEOFF) continue;
      if (this.radarOff) continue;
      const req = this.requiredNm(a, b, weather);
      const kind = req > RADAR_NM ? 'WAKE' : 'SEP_LOSS';
      if (req > 0 && dv < VERTICAL_FT && d < req - 0.02) this.raise(shift, kind, a, b, { nm: +d.toFixed(2), reqNm: req, ft: Math.round(dv) });
      else { this.clear(a, b, 'SEP_LOSS'); this.clear(a, b, 'WAKE'); }
    }
    // ---- runway events raised this step ----
    for (const ev of shift.events.filter((e) => e.t === t && (e.type === 'ROLL_START' || e.type === 'THRESHOLD'))) {
      const ac = shift.aircraft.get(ev.ac); if (!ac) continue;
      if (ev.type === 'ROLL_START') this.checkRollStart(shift, ac, acs);
      else this.checkThreshold(shift, ac, acs);
    }
    // ---- continuous: two aircraft rolling toward the same intersection (3-9-8 / 3-10-4) ----
    if (!this.protectionOff) for (let i = 0; i < acs.length; i++) for (let j = i + 1; j < acs.length; j++) {
      const a = acs[i], b = acs[j];
      if (!a.onRunway || !b.onRunway || a.onRunway === b.onRunway) continue;
      const sect = this.airport.intersecting(a.runway, b.runway); if (!sect) continue;
      const aBefore = a.alongRunwayFt < sect.fromThrFt[a.runway], bBefore = b.alongRunwayFt < sect.fromThrFt[b.runway];
      const aMoving = a.mode === MODES.TAKEOFF || a.mode === MODES.ROLLOUT, bMoving = b.mode === MODES.TAKEOFF || b.mode === MODES.ROLLOUT;
      if (aBefore && bBefore && aMoving && bMoving && a.liftoffAt == null && b.liftoffAt == null) this.raise(shift, 'CROSSING_CONFLICT', a, b, { how: 'both rolling toward the intersection' });
    }
    // ---- same runway occupancy: two on one physical runway where neither is legally separated (incursion) ----
    for (let i = 0; i < acs.length; i++) for (let j = i + 1; j < acs.length; j++) {
      const a = acs[i], b = acs[j];
      if (!a.onRunway || !b.onRunway || a.onRunway !== b.onRunway) continue;
      if (a.mode === MODES.LUAW && b.mode === MODES.LUAW) this.raise(shift, 'RUNWAY_INCURSION', a, b, { how: 'two aircraft lined up' });
    }
  }
  /** 3-9-6 same runway, 3-9-8 intersecting runway, wake intervals (3-9-6 f-h / 3-9-8 wake) at the moment a departure begins its roll. */
  checkRollStart(shift, dep, acs) {
    const ap = this.airport, rw = ap.ends[dep.runway];
    for (const o of acs) {
      if (o === dep) continue;
      // same physical runway
      if (o.onRunway === rw.physical || (o.kind === 'ARR' && o.mode === MODES.FINAL && o.runway === dep.runway && o.finalDistNm < 0.3)) {
        let okSep = false;
        if (o.kind === 'DEP' && o.liftoffAt != null) okSep = o.rolledFt - dep.rolledFt >= srsDistanceFt(o.srs, dep.srs) || o.onRunway == null;
        if (o.kind === 'ARR' && o.clearedRunwayAt != null) okSep = true;
        if (!okSep) this.raise(shift, 'RUNWAY_INCURSION', dep, o, { how: `takeoff roll with ${o.callsign} on runway ${o.runway}`, para: o.kind === 'DEP' ? '3-9-6a' : '3-9-6b' });
      }
      // intersecting runway (3-9-8): preceding arrival must be clear / past the intersection / holding short; preceding departure past the intersection or airborne turning
      const sect = ap.intersecting(dep.runway, o.runway);
      if (sect && !this.protectionOff) {
        if (o.onRunway && o.onRunway !== rw.physical) {
          const past = o.alongRunwayFt >= sect.fromThrFt[o.runway];
          const holdingShort = o.mode === MODES.ROLLOUT && o.ias < 5 && !past;
          if (!past && !holdingShort && o.mode !== MODES.LUAW && o.mode !== MODES.QUEUE) this.raise(shift, 'CROSSING_CONFLICT', dep, o, { how: `${o.callsign} on runway ${o.runway} not yet past the intersection`, para: '3-9-8' });
        }
        // arrival on short final to the intersecting runway will cross its threshold before this departure passes the intersection (3-10-4 anticipation)
        if (o.kind === 'ARR' && o.mode === MODES.FINAL && o.finalDistNm != null) {
          const tArrThr = o.finalDistNm / Math.max(100, o.gs) * 3600;
          const distToSect = sect.fromThrFt[dep.runway];
          const tDepSect = Math.sqrt(2 * distToSect / (dep.perf.accelGround * 1.6878)) ; // s to reach the intersection from a standing start (kt/s → ft/s²)
          if (tArrThr < tDepSect + 5 && !this.protectionOff) this.raise(shift, 'CROSSING_CONFLICT', dep, o, { how: `${o.callsign} crosses the ${o.runway} threshold in ${Math.round(tArrThr)} s, departure needs ${Math.round(tDepSect)} s to the intersection`, para: '3-10-4' });
        }
        // wake time intervals across intersecting runways (3-9-8 wake)
        const last = this.lastRoll[o.id] ?? this.lastThreshold[o.id];
        if (last && (o.mode === MODES.CLIMB || o.mode === MODES.SID || o.mode === MODES.ROLLOUT || o.mode === MODES.LANDED || o.mode === MODES.TAKEOFF)) {
          const need = wakeDepartureInterval(o.cwt, dep.cwt);
          if (need && shift.t - last < need) this.raise(shift, 'WAKE', dep, o, { how: `departure ${Math.round(shift.t - last)} s behind ${o.callsign} (${o.cwt}) across the intersection, ${need} s required`, para: '3-9-8' });
        }
      }
      // wake time intervals same / close-parallel runway (3-9-6 f-h)
      if (ap.sameOrCloseParallel(dep.runway, o.runway) && o.kind === 'DEP' && this.lastRoll[o.id] != null) {
        const need = wakeDepartureInterval(o.cwt, dep.cwt);
        if (need && shift.t - this.lastRoll[o.id] < need) this.raise(shift, 'WAKE', dep, o, { how: `departure ${Math.round(shift.t - this.lastRoll[o.id])} s behind ${o.callsign} (${o.cwt}), ${need} s required`, para: '3-9-6' });
      }
    }
    this.lastRoll[dep.id] = shift.t;
  }
  /** 3-10-3 same runway, 3-10-4 intersecting runway, TBL 5-5-2 wake at the threshold. */
  checkThreshold(shift, arr, acs) {
    const ap = this.airport, rw = ap.ends[arr.runway];
    this.lastThreshold[arr.id] = shift.t;
    for (const o of acs) {
      if (o === arr) continue;
      if (o.onRunway === rw.physical) { // 3-10-3
        let okSep = false;
        if (o.kind === 'ARR' && o.mode === MODES.ROLLOUT) okSep = o.alongRunwayFt >= srsDistanceFt(o.srs, arr.srs) && arr.srs !== 'III' && o.srs !== 'III';
        if (o.kind === 'DEP') okSep = o.liftoffAt != null && o.rolledFt >= srsDistanceFt(o.srs, arr.srs);
        if (!okSep) this.raise(shift, 'RUNWAY_INCURSION', arr, o, { how: `over the threshold with ${o.callsign} on runway ${o.runway}`, para: '3-10-3' });
      }
      const sect = ap.intersecting(arr.runway, o.runway);
      if (sect && !this.protectionOff && o.onRunway && o.onRunway !== rw.physical) { // 3-10-4
        const past = o.alongRunwayFt >= sect.fromThrFt[o.runway];
        const airborneTurning = o.liftoffAt != null && Math.abs(angDiff(o.hdg, ap.ends[o.runway].hdg)) > 15;
        const holding = (o.mode === MODES.LUAW || o.mode === MODES.QUEUE) || (o.mode === MODES.ROLLOUT && o.ias < 5 && !past);
        if (!past && !airborneTurning && !holding) this.raise(shift, 'CROSSING_CONFLICT', arr, o, { how: `${o.callsign} on runway ${o.runway} still short of the intersection`, para: '3-10-4' });
      }
      // wake at the threshold (TBL 5-5-2): the trailing arrival to the same / close-parallel runway must be at least the table distance behind now
      if (o.kind === 'ARR' && o.mode === MODES.FINAL && ap.sameOrCloseParallel(arr.runway, o.runway) && o.finalDistNm > 0) {
        const need = wakeAtThreshold(arr.cwt, o.cwt);
        if (need && o.finalDistNm < need - 0.02) this.raise(shift, 'WAKE', o, arr, { nm: +o.finalDistNm.toFixed(2), reqNm: need, para: '5-5-4h TBL 5-5-2' });
      }
    }
  }
}
