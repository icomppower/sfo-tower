// Aircraft state + kinematic flight model. One instance per flight; step(dt, env) advances it by dt seconds.
import { wrap360, angDiff, hdgVec, dist, trackOffsets, advance, NM_FT, FT_NM, rad, bearingTo } from './geo.js';
import { turnRate, iasToTas } from './perf.js';
import { legAltitude } from './procedures.js';

export const MODES = {
  STAR: 'STAR', VECTOR: 'VECTOR', APPROACH: 'APPROACH', FINAL: 'FINAL', ROLLOUT: 'ROLLOUT', LANDED: 'LANDED', GOAROUND: 'GOAROUND', LOST: 'LOST',
  QUEUE: 'QUEUE', LUAW: 'LUAW', TAKEOFF: 'TAKEOFF', CLIMB: 'CLIMB', SID: 'SID', DEPARTED: 'DEPARTED',
};
const GROUND_MODES = new Set([MODES.QUEUE, MODES.LUAW, MODES.TAKEOFF, MODES.ROLLOUT, MODES.LANDED]);
const LUAW_SECONDS = 25, QUEUE_TO_ROLL_SECONDS = 20, GA_ALT_FT = 3000, NO_CLEARANCE_GA_NM = 1.0;

export class Aircraft {
  constructor(o) {
    Object.assign(this, { id: o.id, callsign: o.callsign, telephony: o.telephony, type: o.type, perf: o.perf, kind: o.kind, cwt: o.perf.cwt, srs: o.perf.srs, heavy: o.perf.heavy,
      x: o.x ?? 0, y: o.y ?? 0, alt: o.alt ?? 0, hdg: o.hdg ?? 0, ias: o.ias ?? 0, vs: 0, tas: 0, gs: 0,
      tgt: { hdg: o.hdg ?? 0, turn: null, alt: o.alt ?? 0, ias: o.ias ?? 0, iasAssigned: false, altAssigned: false },
      mode: o.mode, route: o.route ?? [], routeIdx: 0, star: o.star ?? null, sid: o.sid ?? null, runway: o.runway ?? null, approachKind: null,
      clearedApproach: false, clearedLand: false, clearedTakeoff: false, onGround: GROUND_MODES.has(o.mode), onRunway: null,
      alongRunwayFt: 0, rolledFt: 0, thresholdCrossedAt: null, touchdownAt: null, clearedRunwayAt: null, rollStartAt: null, liftoffAt: null,
      spawnedAt: o.t ?? 0, readyAt: o.t ?? 0, modeTimer: 0, goArounds: 0, lastReadback: '', flags: {}, established: false, finalDistNm: null, log: [],
    });
    this.tgt.alt = o.tgtAlt ?? this.alt; this.tgt.ias = o.tgtIas ?? this.ias;
  }
  get airborne() { return !this.onGround; }
  get done() { return this.mode === MODES.LANDED || this.mode === MODES.DEPARTED || this.mode === MODES.LOST; }
  note(t, msg) { this.log.push([t, msg]); if (this.log.length > 30) this.log.shift(); }

  /** Called every dt seconds. env: { t, wind:{dir,kt}, airport, weather, events(push) } */
  step(dt, env) {
    const { airport } = env;
    this.modeTimer += dt;
    switch (this.mode) {
      case MODES.QUEUE: return;
      case MODES.LUAW: {
        const rw = airport.ends[this.runway];
        if (this.modeTimer >= LUAW_SECONDS && !this.onRunway) { this.enterRunway(rw, env); }
        if (this.clearedTakeoff && this.onRunway) { this.beginRoll(env); }
        return;
      }
      case MODES.TAKEOFF: return this.stepTakeoff(dt, env);
      case MODES.ROLLOUT: return this.stepRollout(dt, env);
      default: return this.stepAirborne(dt, env);
    }
  }
  enterRunway(rw, env) {
    this.x = rw.thr.x; this.y = rw.thr.y; this.hdg = rw.hdg; this.tgt.hdg = rw.hdg; this.onRunway = rw.physical; this.alongRunwayFt = 0; this.ias = 0;
    env.events.push({ t: env.t, type: 'ENTER_RUNWAY', ac: this.id, runway: this.runway });
  }
  beginRoll(env) {
    this.mode = MODES.TAKEOFF; this.modeTimer = 0; this.rollStartAt = env.t; this.rolledFt = 0;
    env.events.push({ t: env.t, type: 'ROLL_START', ac: this.id, runway: this.runway });
  }
  stepTakeoff(dt, env) {
    const rw = env.airport.ends[this.runway];
    const p = this.perf;
    if (this.liftoffAt == null) {
      if (!this.onRunway) this.enterRunway(rw, env);
      this.ias = Math.min(p.vR + 5, this.ias + p.accelGround * dt);
      const v = this.ias / 3600; // NM/s ground speed (ignore wind on the roll)
      const step = advance({ x: this.x, y: this.y }, rw.hdg, v * dt); this.x = step.x; this.y = step.y; this.rolledFt += v * dt * NM_FT; this.alongRunwayFt = this.rolledFt;
      this.alt = rw.elevFt;
      if (this.ias >= p.vR) { this.liftoffAt = env.t; this.vs = p.climbFpm * 0.8; env.events.push({ t: env.t, type: 'LIFTOFF', ac: this.id, runway: this.runway, rollFt: Math.round(this.rolledFt) }); }
      return;
    }
    // airborne but still over the runway: runway heading, accelerate to vR+20, climb
    this.onGround = false;
    this.ias = Math.min(p.vR + 20, this.ias + p.accelKts * dt);
    this.vs = Math.min(p.climbFpm, this.vs + 400 * dt);
    this.alt += this.vs * dt / 60;
    const v = iasToTas(this.ias, this.alt) / 3600; const step = advance({ x: this.x, y: this.y }, rw.hdg, v * dt); this.x = step.x; this.y = step.y; this.rolledFt += v * dt * NM_FT; this.alongRunwayFt = this.rolledFt;
    const agl = this.alt - rw.elevFt;
    if (this.onRunway && (agl > 400 || this.rolledFt > rw.toraFt)) { this.onRunway = null; env.events.push({ t: env.t, type: 'CLEAR_RUNWAY', ac: this.id, runway: this.runway, how: 'airborne' }); }
    if (agl >= (this.sid?.initialClimbFt ?? 520) - rw.elevFt || agl >= 500) {
      this.mode = this.tgt.hdgAssigned ? MODES.VECTOR : MODES.SID; this.modeTimer = 0; this.route = this.sid?.route ?? []; this.routeIdx = 0;
      if (!this.tgt.altAssigned) this.tgt.alt = this.sid?.topAlt ?? 10000;
      if (!this.tgt.iasAssigned) this.tgt.ias = p.vMax;
      if (!this.tgt.hdgAssigned) this.tgt.hdg = rw.hdg;
    }
  }
  stepRollout(dt, env) {
    const rw = env.airport.ends[this.runway], p = this.perf;
    this.ias = Math.max(0, this.ias - p.brakeKts * dt);
    const v = this.ias / 3600; const step = advance({ x: this.x, y: this.y }, rw.hdg, v * dt); this.x = step.x; this.y = step.y;
    this.alongRunwayFt = trackOffsets(rw.thr, rw.hdg, this).along * NM_FT;
    // exit at the first high-speed exit once slow enough (exits assumed every ~1,500 ft beyond the type's rollout footprint)
    if (this.ias <= 45 && this.alongRunwayFt >= p.rolloutFt * 0.8 && this.clearedRunwayAt == null) {
      this.clearedRunwayAt = env.t; env.events.push({ t: env.t, type: 'CLEAR_RUNWAY', ac: this.id, runway: this.runway, how: 'exit', occupancyS: env.t - this.thresholdCrossedAt, rolloutFt: Math.round(this.alongRunwayFt) });
    }
    if (this.clearedRunwayAt != null && env.t - this.clearedRunwayAt >= 6) {
      // taxi clear: side-step off the runway edge, then leave the sim
      const side = advance({ x: this.x, y: this.y }, rw.hdg + 90, 300 * FT_NM); this.x = side.x; this.y = side.y; this.onRunway = null;
      this.mode = MODES.LANDED; env.events.push({ t: env.t, type: 'LANDED', ac: this.id, runway: this.runway });
    }
  }
  stepAirborne(dt, env) {
    const p = this.perf, { airport, wind } = env;
    // ---- lateral guidance ----
    let desiredHdg = this.tgt.hdg, turn = this.tgt.turn;
    if (this.mode === MODES.STAR || this.mode === MODES.SID) desiredHdg = this.navigateRoute(env);
    if (this.mode === MODES.APPROACH) { if (this.route.length && this.routeIdx < this.route.length && !this.tgt.hdgAssigned) desiredHdg = this.navigateRoute(env); this.tryCapture(env); }
    if (this.mode === MODES.FINAL) desiredHdg = this.trackFinal(env);
    if (this.mode === MODES.GOAROUND) { desiredHdg = this.tgt.hdg; if (this.alt >= GA_ALT_FT - 50 || this.modeTimer > 90) { this.mode = MODES.VECTOR; } }
    const rate = turnRate(p, Math.max(this.tas, 100)) * dt;
    let d = angDiff(desiredHdg, this.hdg);
    if (turn === 'L' && d > 0) d -= 360; else if (turn === 'R' && d < 0) d += 360;
    if (Math.abs(d) <= rate) { this.hdg = desiredHdg; if (this.mode === MODES.VECTOR || this.mode === MODES.GOAROUND) this.tgt.turn = null; } else this.hdg = wrap360(this.hdg + Math.sign(d) * rate);
    // ---- speed ----
    let tgtIas = this.tgt.ias;
    if (this.mode === MODES.FINAL) tgtIas = this.finalSpeed();
    else if ((this.mode === MODES.STAR || this.mode === MODES.SID) && !this.tgt.iasAssigned) tgtIas = this.routeSpeed();
    if (this.mode === MODES.GOAROUND) tgtIas = Math.max(this.tgt.ias, p.vApp + 20);
    if (this.alt < 10000) tgtIas = Math.min(tgtIas, p.vMax);
    if (this.ias < tgtIas) this.ias = Math.min(tgtIas, this.ias + p.accelKts * dt); else if (this.ias > tgtIas) this.ias = Math.max(tgtIas, this.ias - p.decelKts * dt);
    this.tas = iasToTas(this.ias, this.alt);
    // ---- vertical ----
    let tgtAlt = this.tgt.alt, vsCap = null;
    if (this.mode === MODES.STAR && !this.tgt.altAssigned) tgtAlt = this.routeAltitude();
    if (this.mode === MODES.FINAL) {
      const rwE = airport.ends[this.runway];
      if ((this.finalDistNm ?? 1) <= 0) { tgtAlt = rwE.elevFt; vsCap = -650; } // over the runway: flare and touch down ~1,000–1,500 ft in
      else { const gsAlt = this.glideslopeAlt(env); if (this.alt <= gsAlt + 30) { tgtAlt = gsAlt; vsCap = -this.gs * Math.tan(rad(rwE.gsDeg)) * 101.27; } else tgtAlt = Math.min(this.tgt.alt, gsAlt); }
    }
    if (this.mode === MODES.GOAROUND) tgtAlt = Math.max(GA_ALT_FT, this.tgt.alt);
    const dAlt = tgtAlt - this.alt;
    let vs = dAlt > 0 ? Math.min(p.climbFpm, dAlt * 6) : Math.max(-p.descentFpm, dAlt * 6);
    if (vsCap != null && this.mode === MODES.FINAL && dAlt <= 30) vs = (this.finalDistNm ?? 1) <= 0 ? vsCap : Math.max(vsCap - 100, Math.min(vs, vsCap + 50));
    if (Math.abs(dAlt) < 1) vs = 0;
    this.vs = vs; this.alt += vs * dt / 60;
    if (this.mode === MODES.FINAL && this.alt < tgtAlt && vs < 0 && this.alt < airport.ends[this.runway].elevFt + 60) this.alt = Math.max(this.alt, airport.ends[this.runway].elevFt);
    // ---- position (air velocity + wind) ----
    const hv = hdgVec(this.hdg), wv = wind.kt ? hdgVec(wind.dir + 180) : { x: 0, y: 0 };
    const vx = this.tas * hv.x + wind.kt * wv.x, vy = this.tas * hv.y + wind.kt * wv.y; this.gs = Math.hypot(vx, vy);
    this.x += vx * dt / 3600; this.y += vy * dt / 3600;
    // ---- final approach bookkeeping: threshold, go-around, touchdown ----
    if (this.mode === MODES.FINAL) this.finalBookkeeping(env);
    // ---- exits ----
    const r = Math.hypot(this.x, this.y);
    if (this.kind === 'DEP' && (r > 30 || (this.alt >= 9500 && r > 12))) { this.mode = MODES.DEPARTED; env.events.push({ t: env.t, type: 'DEPARTED', ac: this.id }); }
    if (this.kind === 'ARR' && r > 55) { this.mode = MODES.LOST; env.events.push({ t: env.t, type: 'LOST', ac: this.id }); }
  }
  navigateRoute(env) {
    const leg = this.route[this.routeIdx];
    if (!leg) { return this.tgt.hdg; }
    const dNext = dist(this, leg), brg = bearingTo(this, leg);
    // fly-by turn anticipation: turn radius r = tas/(rate·2π/360)/3600 … approximated
    const nxt = this.route[this.routeIdx + 1];
    let anticipate = 0.3;
    if (nxt) { const turnDeg = Math.abs(angDiff(bearingTo(leg, nxt), brg)); const rNm = (this.tas / 3600) / rad(turnRate(this.perf, this.tas)); anticipate = Math.max(0.3, rNm * Math.tan(rad(Math.min(turnDeg, 120) / 2))); }
    if (dNext <= anticipate || (dNext < 2 && Math.abs(angDiff(brg, this.hdg)) > 100)) {
      this.routeIdx++; env.events.push({ t: env.t, type: 'FIX', ac: this.id, fix: leg.fix });
      if (this.routeIdx >= this.route.length) { // end of route: continue on the last course
        this.tgt.hdg = this.hdg; if (this.mode === MODES.STAR) { this.mode = MODES.VECTOR; if (!this.tgt.altAssigned) this.tgt.alt = legAltitude(leg, this.alt); if (!this.tgt.iasAssigned) this.tgt.ias = Math.min(this.perf.vClean, 210); env.events.push({ t: env.t, type: 'STAR_END', ac: this.id }); }
        else if (this.mode === MODES.SID) { this.tgt.hdg = this.hdg; }
        return this.hdg;
      }
      return bearingTo(this, this.route[this.routeIdx]);
    }
    this.tgt.hdg = brg; return brg;
  }
  routeAltitude() {
    const leg = this.route[this.routeIdx]; if (!leg) return this.tgt.alt;
    const a = legAltitude(leg, null); if (a == null) return this.tgt.alt;
    if (leg.altDesc === '+' ) return Math.min(this.alt, Math.max(a, this.tgt.alt === this.alt ? a : this.tgt.alt)); // at-or-above: descend no lower than a
    return a;
  }
  routeSpeed() { const leg = this.route[this.routeIdx]; const s = leg?.speed; const base = this.kind === 'ARR' ? Math.min(this.perf.vMax, 250) : this.perf.vMax; return s ? Math.min(s, base) : base; }
  finalSpeed() {
    const d = this.finalDistNm ?? 10, p = this.perf;
    if (d <= 5) return p.vApp;
    if (this.tgt.iasAssigned) return Math.min(this.tgt.ias, 210);
    if (d <= 10) return Math.max(p.vApp, Math.min(180, p.vClean));
    return Math.min(210, this.tgt.ias || 210);
  }
  glideslopeAlt(env) { const rw = env.airport.ends[this.runway]; const d = Math.max(0, this.finalDistNm ?? 0); return rw.elevFt + rw.tchFt + d * NM_FT * Math.tan(rad(rw.gsDeg)); }
  tryCapture(env) {
    const rw = env.airport.ends[this.runway]; if (!rw) return;
    const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, this); // along: NM before the threshold along the reciprocal
    const dThr = along; if (dThr < 0.5 || dThr > 28) return;
    const intercept = Math.abs(angDiff(this.hdg, rw.finalCourse));
    const width = 0.15 + dThr * Math.tan(rad(2.5));
    const closing = Math.sign(cross) !== Math.sign(angDiff(this.hdg, rw.finalCourse)) || Math.abs(cross) < 0.1; // turning toward the course
    if (Math.abs(cross) <= width && intercept <= 45 && (closing || Math.abs(cross) < width / 2)) {
      this.mode = MODES.FINAL; this.established = true; this.finalDistNm = dThr; this.tgt.turn = null; this.tgt.hdgAssigned = false;
      env.events.push({ t: env.t, type: 'ESTABLISHED', ac: this.id, runway: this.runway, distNm: +dThr.toFixed(1), kind: this.approachKind });
    }
  }
  trackFinal(env) {
    const rw = env.airport.ends[this.runway];
    const { cross, along } = trackOffsets(rw.thr, rw.finalCourse + 180, this);
    this.finalDistNm = along;
    const corr = Math.max(-30, Math.min(30, -Math.atan2(cross, 0.6) * 180 / Math.PI));
    return wrap360(rw.finalCourse + corr);
  }
  finalBookkeeping(env) {
    const rw = env.airport.ends[this.runway], d = this.finalDistNm;
    if (d <= NO_CLEARANCE_GA_NM && !this.clearedLand && this.thresholdCrossedAt == null) return this.goAround(env, 'no landing clearance');
    if (d <= 0 && this.thresholdCrossedAt == null) { this.thresholdCrossedAt = env.t; this.onRunway = rw.physical; env.events.push({ t: env.t, type: 'THRESHOLD', ac: this.id, runway: this.runway, altAgl: Math.round(this.alt - rw.elevFt) }); }
    if (this.thresholdCrossedAt != null && this.alt <= rw.elevFt + 3) {
      this.alt = rw.elevFt; this.onGround = true; this.mode = MODES.ROLLOUT; this.modeTimer = 0; this.touchdownAt = env.t; this.vs = 0; this.hdg = rw.hdg;
      const { cross } = trackOffsets(rw.thr, rw.hdg, this); const c = advance(this, rw.hdg - 90 * Math.sign(cross) , Math.abs(cross)); this.x = c.x; this.y = c.y; // snap to centreline
      this.touchdownFromThrFt = Math.round(trackOffsets(rw.thr, rw.hdg, this).along * NM_FT);
      env.events.push({ t: env.t, type: 'TOUCHDOWN', ac: this.id, runway: this.runway, fromThrFt: this.touchdownFromThrFt });
    }
  }
  goAround(env, reason, commanded = false) {
    const rw = env.airport.ends[this.runway];
    this.mode = MODES.GOAROUND; this.modeTimer = 0; this.goArounds++; this.established = false; this.clearedApproach = false; this.clearedLand = false; this.onRunway = null; this.onGround = false; this.thresholdCrossedAt = null;
    this.tgt.hdg = rw ? rw.hdg : this.hdg; this.tgt.turn = null; this.tgt.alt = GA_ALT_FT; this.tgt.altAssigned = false; this.tgt.iasAssigned = false; this.tgt.ias = this.perf.vApp + 20; this.tgt.hdgAssigned = false;
    env.events.push({ t: env.t, type: 'GO_AROUND', ac: this.id, runway: this.runway, reason, commanded });
  }
}
