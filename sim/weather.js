// METAR-driven weather: picks a historical KSFO window (by seed + setting), classifies conditions per the FAA capacity
// profile definitions, chooses the runway configuration from the wind, and exposes hourly-interpolated wind for the flight model.
import { CONFIGS } from './airport.js';
import { angDiff } from './geo.js';

export const CONDITIONS = { VISUAL: 'VISUAL', MARGINAL: 'MARGINAL', INSTRUMENT: 'INSTRUMENT' };
/** FAA SFO Airport Capacity Profile (2019): visual ≥ 3,500 ft ceiling and ≥ 8 mi; instrument < 1,000 ft or < 3 mi; marginal between. */
export function classify(obs) {
  const ceil = obs.ceil ?? 99999, vis = obs.vis ?? 10;
  if (ceil < 1000 || vis < 3) return CONDITIONS.INSTRUMENT;
  if (ceil >= 3500 && vis >= 8) return CONDITIONS.VISUAL;
  return CONDITIONS.MARGINAL;
}
export const headwind = (wind, rwyHdg) => wind.kt * Math.cos(angDiff(wind.dir, rwyHdg) * Math.PI / 180);
export const crosswind = (wind, rwyHdg) => Math.abs(wind.kt * Math.sin(angDiff(wind.dir, rwyHdg) * Math.PI / 180));
/** Runway configuration from wind (D18): SE plan when 28s have > 10 kt tailwind or 19/10 favoured by ≥ 10 kt; 28RT when the 1s have > 25 kt crosswind. */
export function chooseConfig(wind, airport) {
  if (wind.dir == null || wind.kt < 3) return CONFIGS.WEST;
  const hw28 = headwind(wind, airport.ends['28R'].hdg), hw19 = headwind(wind, airport.ends['19L'].hdg);
  if (hw28 < -10 || (hw19 - hw28 > 15 && hw19 > 8)) return CONFIGS.SOUTHEAST;
  if (crosswind(wind, airport.ends['1R'].hdg) > 25) return CONFIGS.WEST_28RT;
  return CONFIGS.WEST;
}
export class Weather {
  /** setting: 'auto' | 'clear' | 'fog' | 'storm'; picks a start index into the METAR history deterministically. */
  constructor(metarJson, rng, setting, airport, durationS) {
    this.recs = metarJson.records; this.airport = airport;
    const n = this.recs.length, need = Math.ceil(durationS / 3600) + 2;
    const candidates = [];
    for (let i = 0; i < n - need; i++) {
      const r = this.recs[i], c = classify(r);
      const fog = r.wx.some((w) => /FG|BR/.test(w)) && c !== CONDITIONS.VISUAL;
      const storm = r.wd != null && r.ws >= 12 && chooseConfig({ dir: r.wd, kt: r.ws }, airport).id === 'SOUTHEAST';
      const hourOk = ((r.t / 3600) % 24 + 24 - 8) % 24; // local-ish (UTC-8) hour
      if (hourOk < 6 && setting !== 'fog') continue; // shifts run in the operating day
      if (setting === 'clear' && !(c === CONDITIONS.VISUAL && r.ws <= 20)) continue;
      if (setting === 'fog' && !fog) continue;
      if (setting === 'storm' && !storm) continue;
      candidates.push(i);
    }
    this.startIdx = candidates.length ? candidates[Math.floor(rng.next() * candidates.length)] : 0;
    this.setting = setting; this.t0 = this.recs[this.startIdx].t;
    this.config = chooseConfig(this.obsAt(0).wind, airport);
    this.current = this.obsAt(0);
  }
  obsAt(simT) {
    const t = this.t0 + simT; let i = this.startIdx;
    while (i + 1 < this.recs.length && this.recs[i + 1].t <= t) i++;
    const a = this.recs[i], b = this.recs[Math.min(i + 1, this.recs.length - 1)];
    const f = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
    const dir = a.wd == null ? (b.wd ?? null) : b.wd == null ? a.wd : a.wd + angDiff(b.wd, a.wd) * f;
    const kt = a.ws + (b.ws - a.ws) * f;
    const cond = classify(a);
    return { raw: a.raw, obsTime: a.t, wind: { dir: dir == null ? null : ((Math.round(dir) % 360) + 360) % 360, kt: Math.round(kt), gust: a.gust }, vis: a.vis, ceil: a.ceil, wx: a.wx, temp: a.temp, dew: a.dew, altim: a.altim,
      cat: a.cat, conditions: cond, visualOK: cond === CONDITIONS.VISUAL, fog: a.wx.some((w) => /FG|BR/.test(w)) };
  }
  update(simT) { this.current = this.obsAt(simT); return this.current; }
  atis() {
    const c = this.current, w = c.wind;
    return `KSFO ${c.conditions} · wind ${w.dir == null ? 'VRB' : String(w.dir).padStart(3, '0')}/${w.kt}${w.gust ? 'G' + w.gust : ''} · vis ${c.vis ?? 10} SM · ceiling ${c.ceil ? c.ceil + ' ft' : 'none'}${c.wx.length ? ' · ' + c.wx.join(' ') : ''} · ${this.config.name} · ${c.visualOK ? 'visual approaches' : 'ILS approaches in use'}`;
  }
}
