// The world: one controller shift at KSFO. Zero DOM, seeded, fixed 1 s steps; replays are byte-identical for the same options.
import { RNG, hashString } from './rng.js';
import { buildAirport } from './airport.js';
import { buildProcedures } from './procedures.js';
import { buildPerf } from './perf.js';
import { Weather } from './weather.js';
import { Traffic, DIFFICULTY } from './traffic.js';
import { Rules } from './rules.js';
import { Scoring } from './scoring.js';
import { applyCommand } from './commands.js';

export const DEFAULTS = { seed: 'sfo', difficulty: 'normal', weather: 'auto', durationMin: 60, month: null, dow: null, startHour: null, rules: {} };

export class Shift {
  /** data: { airport, procedures, metar, traffic, aircraft } = the derived JSON files. */
  constructor(data, options = {}) {
    this.options = { ...DEFAULTS, ...options };
    const o = this.options;
    this.rng = new RNG(`${o.seed}|${o.difficulty}|${o.weather}|${o.durationMin}`);
    this.airport = buildAirport(data.airport, data.procedures);
    this.procedures = buildProcedures(data.procedures, this.airport.proj);
    this.perf = buildPerf(data.aircraft);
    this.durationS = o.durationMin * 60;
    this.weather = new Weather(data.metar, this.rng.fork('weather'), o.weather, this.airport, this.durationS);
    this.config = this.weather.config;
    const wxDate = new Date(this.weather.t0 * 1000);
    this.month = o.month ?? (wxDate.getUTCMonth() + 1);
    // BTS DayOfWeek: 1 = Monday … 7 = Sunday; local = UTC-8 (PST) approximation for the hour of day
    const localH = ((this.weather.t0 - 8 * 3600) / 3600) % 24;
    this.dow = o.dow ?? ((wxDate.getUTCDay() + 6) % 7) + 1;
    this.startHour = o.startHour ?? Math.floor(((localH % 24) + 24) % 24);
    this.traffic = new Traffic({ rng: this.rng.fork('traffic'), trafficJson: data.traffic, perf: this.perf, procedures: this.procedures, airport: this.airport, config: this.config, difficulty: o.difficulty, month: this.month, dow: this.dow, startHour: this.startHour, durationS: this.durationS, demand: o.demand ?? null });
    this.rules = new Rules(this.airport, o.rules);
    this.scoring = new Scoring();
    this.assist = DIFFICULTY[o.difficulty].assist && o.assist !== false;
    this.aircraft = new Map(); this.events = []; this.t = 0; this.stepCount = 0; this._hash = 2166136261 >>> 0; this.finished = false;
    this.env = { t: 0, wind: this.weather.current.wind, airport: this.airport, weather: this.weather.current, events: this.events };
    this.traffic.spawn(this);
  }
  get gameOver() { return this.scoring.gameOver; }
  /** Advance the world by `seconds` (integer ≥ 1) in 1 s steps. */
  step(seconds = 1) {
    for (let i = 0; i < seconds; i++) {
      if (this.finished || this.scoring.gameOver) return;
      this.t += 1; this.stepCount++;
      const before = this.scoredIdx ?? 0; // score everything since the last step, including commands issued between steps
      this.env.t = this.t; this.env.weather = this.weather.update(this.t); this.env.wind = this.env.weather.wind;
      this.traffic.spawn(this);
      for (const a of this.aircraft.values()) if (!a.done) a.step(1, this.env);
      this.rules.check(this);
      this.scoring.apply(this.events.slice(before), this); this.scoredIdx = this.events.length;
      for (const [id, a] of this.aircraft) if (a.done && this.t - (a.doneAt ?? (a.doneAt = this.t)) > 30) this.aircraft.delete(id);
      this.mix();
      if (this.t >= this.durationS) this.finished = true;
    }
  }
  command(acId, cmd) { const ac = this.aircraft.get(acId); if (!ac) return { ok: false, readback: 'no such aircraft', error: 'no such aircraft' }; return applyCommand(this, ac, cmd); }
  /** FNV-1a over the compact state each step — the replay fingerprint. */
  mix() {
    let h = this._hash;
    const mixStr = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
    for (const a of this.aircraft.values()) mixStr(`${a.id}${a.mode}${a.x.toFixed(4)}${a.y.toFixed(4)}${a.alt.toFixed(1)}${a.hdg.toFixed(2)}${a.ias.toFixed(2)}`);
    mixStr(String(this.events.length) + this.scoring.score);
    this._hash = h >>> 0;
  }
  get hash() { return this._hash.toString(16).padStart(8, '0'); }
  snapshot() {
    return { t: this.t, hash: this.hash, config: this.config.id, weather: this.weather.current.conditions, atis: this.weather.atis(), score: this.scoring.summary(),
      aircraft: [...this.aircraft.values()].filter((a) => !a.done).map((a) => ({ id: a.id, cs: a.callsign, type: a.type, kind: a.kind, mode: a.mode, x: +a.x.toFixed(3), y: +a.y.toFixed(3), alt: Math.round(a.alt), hdg: Math.round(a.hdg), ias: Math.round(a.ias), rwy: a.runway, cwt: a.cwt })) };
  }
}
export { hashString };
