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
  }
  cmd(ac, c) { return this.shift.command(ac.id, c); }
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
    return Math.max(req, wake ? wake + 0.5 : 0) + (this.assist ? 0.3 : 0);
  }
  handleArrival(a, arrivals, acs) {
    const s = this.shift, ap = s.airport, rw = ap.ends[a.runway];
    const p = this.plan.get(a.id) ?? { state: 'inbound', timer: 0 }; this.plan.set(a.id, p);
    const r = Math.hypot(a.x, a.y);
    // descend early enough: 6,000 by 25 NM, 4,000 by the base
    if (a.mode !== MODES.FINAL && a.mode !== MODES.GOAROUND && p.state !== 'intercept') {
      if (r < 28 && a.tgt.alt > 6000 && a.mode !== MODES.STAR) this.cmd(a, { type: 'altitude', alt: 6000 });
      if (r < 28 && (a.mode === MODES.STAR ? a.tgt.alt > 7000 : false)) this.cmd(a, { type: 'altitude', alt: 6000 });
      if (r < 30 && !a.tgt.iasAssigned && a.ias > 215) this.cmd(a, { type: 'speed', ias: 210 });
    }
    if (a.mode === MODES.GOAROUND) { p.state = 'inbound'; return; }
    if (a.mode === MODES.FINAL) {
      p.state = 'final';
      if (!a.clearedLand && a.finalDistNm <= 6 && this.runwayFreeForLanding(a, acs)) this.cmd(a, { type: 'land', runway: a.runway });
      if (!a.clearedLand && a.finalDistNm <= 1.6 && !this.runwayFreeForLanding(a, acs)) this.cmd(a, { type: 'goaround' });
      return;
    }
    if (a.mode === MODES.APPROACH) return; // intercepting, leave it alone
    // still on the STAR beyond the base area: leave it alone
    const base = ap.finalPoint(a.runway, BASE_NM);
    const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, a); // along = NM out along the final
    if (a.mode === MODES.STAR && dist(a, base) > 9 && r > 14) return;
    // decide: can this aircraft be next onto the final?
    const lead = this.leadOnFinal(a, arrivals);
    const ourFinalNm = Math.max(BASE_NM, along) + (Math.abs(cross) > 1 ? dist(a, base) * 0.5 : 0);
    const gap = lead ? (ourFinalNm - lead.finalDistNm) : 99;
    const need = lead ? this.spacing(lead, a) : 0;
    if (p.state !== 'intercept' && gap >= need && Math.abs(cross) < 12 && along > 8 && along < 24) {
      // side-by pairing in VMC: alternate runways to whichever parallel gives more spacing
      const alt = this.bestRunway(a, arrivals);
      if (alt !== a.runway) a.runway = alt;
      const rwy = ap.ends[a.runway]; const side = trackOffsets(rwy.thr, rwy.finalCourse + 180, a).cross > 0 ? 1 : -1;
      const h = wrap360(rwy.finalCourse + side * INTERCEPT_DEG);
      this.cmd(a, { type: 'heading', hdg: h }); this.cmd(a, { type: 'altitude', alt: along > 16 ? 5000 : 4000 });
      this.cmd(a, { type: 'approach', runway: a.runway, kind: this.shift.weather.current.visualOK && rwy.ils ? 'ILS' : rwy.approachType });
      p.state = 'intercept'; this.lastClearedFinal = a.id; return;
    }
    if (p.state === 'intercept') return;
    // otherwise: delay — fly a downwind parallel to the final (outbound) away from the field, then turn base when spacing allows
    if (p.state !== 'delay' || s.t - p.timer > 45) {
      p.state = 'delay'; p.timer = s.t;
      const side = cross > 0 ? 1 : -1;
      // fly outbound (reciprocal of the final course) offset ≥ 4 NM from the centreline, or turn away if too close
      const targetCross = 5 * side;
      let h;
      if (Math.abs(cross) < 3.5) h = wrap360(rw.finalCourse + 180 + side * 60);          // move away from the centreline
      else if (along < 14) h = wrap360(rw.finalCourse + 180);                              // outbound downwind
      else h = wrap360(rw.finalCourse + side * 20);                                         // far enough: drift back toward the base area
      if (Math.abs(angDiff(h, a.tgt.hdg)) > 8 || a.mode === MODES.STAR) this.cmd(a, { type: 'heading', hdg: h });
      if (a.tgt.alt > 5000) this.cmd(a, { type: 'altitude', alt: 5000 });
      if (!(a.tgt.iasAssigned && a.tgt.ias <= 190)) this.cmd(a, { type: 'speed', ias: 190 });
    }
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
  leadOnFinal(a, arrivals) {
    const ap = this.shift.airport;
    return arrivals.filter((o) => o !== a && (o.mode === MODES.FINAL || o.mode === MODES.APPROACH) && ap.sameOrCloseParallel(o.runway, a.runway))
      .map((o) => ({ o, d: o.mode === MODES.FINAL ? o.finalDistNm : BASE_NM })).sort((x, y) => y.d - x.d)[0]?.o ?? null;
  }
  runwayFreeForLanding(a, acs) {
    const ap = this.shift.airport, rw = ap.ends[a.runway];
    for (const o of acs) {
      if (o === a) continue;
      if (o.onRunway === rw.physical) {
        if (o.kind === 'DEP' && o.liftoffAt != null && o.rolledFt > srsDistanceFt(o.srs, a.srs) + 500) continue;
        if (o.kind === 'ARR' && o.clearedRunwayAt != null) continue;
        return false;
      }
      if (o.kind === 'DEP' && (o.mode === MODES.LUAW || o.mode === MODES.TAKEOFF) && o.runway === a.runway) return false;
    }
    return true;
  }
  handleDeparture(d, acs) {
    const s = this.shift, ap = s.airport, rw = ap.ends[d.runway];
    if (d.mode !== MODES.QUEUE && d.mode !== MODES.LUAW) return;
    const occupied = acs.some((o) => o !== d && o.onRunway === rw.physical && !(o.kind === 'DEP' && o.liftoffAt != null && o.rolledFt > 6500));
    const luawOthers = acs.some((o) => o !== d && o.kind === 'DEP' && o.mode === MODES.LUAW && o.runway === d.runway);
    if (d.mode === MODES.QUEUE) {
      // line up when the runway is free of other departures lining up and no arrival is inside 2 NM to this runway
      const shortFinal = acs.some((o) => o.kind === 'ARR' && o.mode === MODES.FINAL && o.runway === d.runway && o.finalDistNm < 2.5);
      if (!luawOthers && !occupied && !shortFinal) this.cmd(d, { type: 'luaw' });
      return;
    }
    if (d.clearedTakeoff) return;
    // 1) same / close-parallel wake interval + SRS behind the previous departure
    for (const o of acs) {
      if (o === d || o.kind !== 'DEP') continue;
      if (ap.sameOrCloseParallel(o.runway, d.runway) && o.rollStartAt != null && o.mode !== MODES.QUEUE) {
        const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return;
        if (o.runway === d.runway && !(o.liftoffAt != null && (o.rolledFt >= srsDistanceFt(o.srs, d.srs) + 300 || o.onRunway == null))) return;
      }
      // crossing runways wake (3-9-8)
      if (ap.intersecting(o.runway, d.runway) && o.rollStartAt != null && (o.mode === MODES.TAKEOFF || o.mode === MODES.CLIMB || o.mode === MODES.SID)) { const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.rollStartAt < need + 5) return; }
    }
    // 2) arrivals on the same runway: none inside 6 NM (SRS: the arrival must not cross the threshold before we are past 6,000 ft / airborne)
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
          // wake across the intersection behind a landing heavy: 3-9-8 wake interval measured from its threshold crossing
          const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && tArr < 30) return;
        } else if (o.finalDistNm < 2.5) return;                              // no prediction: only refuse when the arrival is close
      }
      if (o.thresholdCrossedAt != null && o.clearedRunwayAt == null) { const need = wakeDepartureInterval(o.cwt, d.cwt); if (need && s.t - o.thresholdCrossedAt < need + 5) return; }
    }
    if (occupied) return;
    this.cmd(d, { type: 'takeoff' }); this.lastRoll[d.runway] = { t: s.t, cwt: d.cwt, id: d.id };
  }
}
