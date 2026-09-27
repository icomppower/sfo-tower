// Traffic generator: BTS hourly shape (real SFO wheels-on/off counts) × difficulty, carrier shares from BTS, an international
// heavy share on top (D15), types per carrier from a fleet table restricted to data/derived/aircraft.json, STAR/SID assignment.
import { Aircraft, MODES } from './aircraft.js';
import { advance, dist, bearingTo, FT_NM } from './geo.js';
import { legAltitude } from './procedures.js';

export const CARRIERS = {
  UA: { icao: 'UAL', name: 'United', fleet: [['B738', 4], ['B739', 6], ['B38M', 3], ['B39M', 3], ['A320', 3], ['A319', 2], ['B752', 1], ['B763', 1], ['B772', 1], ['B77W', 1], ['B788', 1], ['B789', 2], ['B78X', 1]] },
  OO: { icao: 'SKW', name: 'SkyWest', fleet: [['E75L', 6], ['CRJ2', 1], ['CRJ7', 1], ['E170', 1]] },
  DL: { icao: 'DAL', name: 'Delta', fleet: [['A321', 3], ['A21N', 2], ['B739', 3], ['B738', 1], ['A320', 1], ['B752', 1], ['B763', 1], ['A333', 1], ['BCS1', 1]] },
  AA: { icao: 'AAL', name: 'American', fleet: [['A321', 4], ['A21N', 2], ['B738', 3], ['B38M', 2], ['A319', 1], ['E75L', 1]] },
  AS: { icao: 'ASA', name: 'Alaska', fleet: [['B739', 4], ['B738', 2], ['B39M', 2], ['B38M', 1], ['E75L', 3]] },
  WN: { icao: 'SWA', name: 'Southwest', fleet: [['B738', 4], ['B38M', 3], ['B737', 3]] },
  B6: { icao: 'JBU', name: 'JetBlue', fleet: [['A320', 2], ['A321', 2], ['A21N', 2], ['BCS1', 1]] },
  F9: { icao: 'FFT', name: 'Frontier', fleet: [['A320', 1], ['A20N', 3], ['A21N', 2]] },
  HA: { icao: 'HAL', name: 'Hawaiian', fleet: [['A332', 3], ['A21N', 2]] },
};
export const INTL = [
  ['CPA', 'Cathay', [['B77W', 3], ['A35K', 1], ['A359', 1]]], ['SIA', 'Singapore', [['A359', 2], ['B78X', 1]]], ['JAL', 'Japan Air', [['B789', 1], ['B77W', 1]]], ['ANA', 'All Nippon', [['B789', 1], ['B77W', 1]]],
  ['KAL', 'Korean Air', [['B77W', 1], ['A359', 1], ['B789', 1]]], ['EVA', 'Eva', [['B77W', 2], ['B789', 1]]], ['CAL', 'Dynasty', [['A359', 1], ['B77W', 1]]], ['BAW', 'Speedbird', [['B789', 1], ['A388', 1], ['B77W', 1]]],
  ['DLH', 'Lufthansa', [['A388', 1], ['B748', 1], ['A359', 1]]], ['AFR', 'Air France', [['B789', 1], ['B77W', 1]]], ['UAE', 'Emirates', [['A388', 2]]], ['QFA', 'Qantas', [['B789', 1], ['A388', 1]]],
  ['ANZ', 'New Zealand', [['B789', 1], ['B77W', 1]]], ['VIR', 'Virgin', [['A35K', 1], ['B789', 1]]], ['ACA', 'Air Canada', [['A21N', 2], ['A320', 1], ['B38M', 1], ['A333', 1]]], ['AMX', 'Aeromexico', [['B738', 1], ['B38M', 1]]],
  ['KLM', 'KLM', [['B789', 1], ['B77W', 1]]], ['SWR', 'Swiss', [['B77W', 1]]], ['THY', 'Turkish', [['A359', 1], ['B789', 1]]], ['QTR', 'Qatari', [['A35K', 1], ['B77W', 1]]],
];
const GA = [['C172', 3], ['PC12', 2], ['C56X', 2], ['GLF5', 1], ['CL60', 1]];
// STAR weights by origin direction (BTS top origins: LAX/SAN/SNA/LAS/PHX south-east, SEA/PDX north, DEN/ORD/JFK east, HNL/Asia west).
const STAR_WEIGHTS = { WEST: [['SERFR4', 34], ['DYAMD5', 26], ['BDEGA4', 18], ['PIRAT3', 12], ['YOSEM3', 10]], SOUTHEAST: [['WWAVS2', 34], ['ALWYS3', 30], ['STLER4', 24], ['PIRAT3', 6], ['MOD9', 6]] };
const SID_BY_RUNWAY = { '1L': [['SSTIK5', 4], ['SEGUL1', 3], ['GAPP7', 1]], '1R': [['TRUKN2', 4], ['NIITE4', 3], ['GAPP7', 1]], '28L': [['WESLA5', 3], ['GNNRR3', 2], ['SNTNA2', 2], ['TRUKN2', 1]], '28R': [['WESLA5', 3], ['GNNRR3', 2], ['TRUKN2', 2], ['NIITE4', 1]], '10L': [['CIITY3', 3], ['SAHEY4', 2], ['MOLEN9', 1]], '10R': [['CIITY3', 3], ['SAHEY4', 2], ['MOLEN9', 1]], '19L': [['CIITY3', 2], ['SAHEY4', 2], ['MOLEN9', 2]], '19R': [['CIITY3', 2], ['SAHEY4', 2], ['MOLEN9', 2]] };
export const DIFFICULTY = { easy: { rate: 0.45, intl: 0.08, assist: true, capArr: 22, capDep: 24 }, normal: { rate: 0.8, intl: 0.12, assist: true, capArr: 40, capDep: 44 }, hard: { rate: 1.15, intl: 0.16, assist: false, capArr: 99, capDep: 99 } };

export class Traffic {
  constructor({ rng, trafficJson, perf, procedures, airport, config, difficulty, month, dow, startHour, durationS, demand = null }) {
    Object.assign(this, { rng, perf, procedures, airport, config, difficulty: DIFFICULTY[difficulty], startHour, durationS, nextId: 1, demand });
    const prof = trafficJson.months[String(month)][String(dow)];
    this.arrPerHour = prof.arrPerHour; this.depPerHour = prof.depPerHour;
    this.carrierShares = Object.entries(trafficJson.carriers).filter(([c]) => CARRIERS[c]).map(([c, n]) => [c, n]);
    this.schedule = []; // { t, kind }
    this.buildSchedule();
  }
  rateAt(kind, simT) { // flights per hour (BTS shape × difficulty, + international share, + GA); `demand` overrides for capacity tests
    if (this.demand) return kind === 'ARR' ? this.demand.arr : this.demand.dep;
    const h = Math.floor((this.startHour * 3600 + simT) / 3600) % 24;
    const base = (kind === 'ARR' ? this.arrPerHour : this.depPerHour)[h];
    const intl = 1 + this.difficulty.intl * (h >= 16 || h <= 1 ? 1.6 : 0.6);
    return Math.min(kind === 'ARR' ? this.difficulty.capArr : this.difficulty.capDep, Math.max(2, base * intl * this.difficulty.rate + 1.2));
  }
  buildSchedule() {
    for (const kind of ['ARR', 'DEP']) {
      let t = kind === 'ARR' ? -900 : -60; // arrivals already inbound at shift start
      while (t < this.durationS) { const rate = this.rateAt(kind, Math.max(0, t)); t += this.rng.exp(3600 / rate); if (t < this.durationS) this.schedule.push({ t, kind }); }
    }
    this.schedule.sort((a, b) => a.t - b.t || (a.kind < b.kind ? -1 : 1));
  }
  pickFlight(hour) {
    const r = this.rng;
    const intlP = this.difficulty.intl * (hour >= 16 || hour <= 1 ? 1.6 : 0.6);
    const roll = r.next();
    if (roll < intlP) { const [icao, tel, fleet] = r.pick(INTL); return { icao, tel, type: r.weighted(fleet), number: r.int(1, 999) }; }
    if (roll < intlP + 0.03) { const type = r.weighted(GA); return { icao: 'N', tel: type.startsWith('C1') ? 'Skyhawk' : type === 'PC12' ? 'Pilatus' : type === 'GLF5' ? 'Gulfstream' : type === 'CL60' ? 'Challenger' : 'Citation', type, number: `${r.int(10, 999)}${r.pick(['AB', 'KT', 'SF', 'JL', 'PA', 'MC'])}` }; }
    const code = r.weighted(this.carrierShares); const c = CARRIERS[code];
    return { icao: c.icao, tel: c.name, type: r.weighted(c.fleet), number: r.int(1, 2999) };
  }
  /** Spawns everything scheduled up to simT into shift.aircraft. */
  spawn(shift) {
    while (this.schedule.length && this.schedule[0].t <= shift.t) {
      const s = this.schedule[0];
      // en-route metering (D22, TBFM-style): no new arrival while ≥ 9 arrivals are airborne and not yet on the approach
      if (s.kind === 'ARR' && shift.t > 0 && ([...shift.aircraft.values()].filter((o) => o.kind === 'ARR' && !o.done && !o.onGround && o.mode !== 'FINAL' && o.mode !== 'APPROACH').length >= 9 || shift.meter?.())) { s.t = shift.t + 30; this.schedule.sort((a, b) => a.t - b.t); break; }
      const ac = s.kind === 'ARR' ? this.makeArrival(shift, s.t) : this.makeDeparture(shift, s.t);
      // keep new arrivals 3 NM / 1,000 ft from everyone and ≥ 7 NM behind the previous arrival on the same STAR (wake behind heavies, 5-5-4 TBL 5-5-1)
      if (ac.kind === 'ARR' && [...shift.aircraft.values()].some((o) => !o.done && !o.onGround && ((dist(o, ac) < 3 && Math.abs(o.alt - ac.alt) < 1000) || (o.kind === 'ARR' && o.star === ac.star && dist(o, ac) < 7)))) { s.t = shift.t + 45; this.nextId--; this.schedule.sort((a, b) => a.t - b.t); continue; }
      this.schedule.shift();
      if (ac) { shift.aircraft.set(ac.id, ac); shift.events.push({ t: shift.t, type: 'SPAWN', ac: ac.id, kind: ac.kind, callsign: ac.callsign, acType: ac.type }); }
    }
  }
  makeArrival(shift, t) {
    const r = this.rng, hour = Math.floor((this.startHour * 3600 + Math.max(0, t)) / 3600) % 24;
    const f = this.pickFlight(hour); const perf = this.perf[f.type];
    const cfgKey = this.config.id === 'SOUTHEAST' ? 'SOUTHEAST' : 'WEST';
    const starId = r.weighted(STAR_WEIGHTS[cfgKey]);
    const runway = perf.heavy && this.config.arrivals.includes('28R') ? r.pick(this.config.arrivals) : r.pick(this.config.arrivals);
    const cands = this.procedures.starsFor(runway).filter((s) => s.id === starId);
    const star = cands[0] ?? this.procedures.starsFor(runway)[0];
    const route = star.route.map((l) => ({ ...l }));
    const entry = route[0];
    const ac = new Aircraft({ id: `A${this.nextId++}`, callsign: `${f.icao}${f.number}`, telephony: f.tel, type: f.type, perf, kind: 'ARR', mode: MODES.STAR, x: entry.x, y: entry.y, alt: star.entryAlt, hdg: bearingTo(entry, route[1]), ias: Math.min(perf.vMax, star.entryAlt > 10000 ? 280 : 250), route, star: star.id, runway, t: shift.t, tgtAlt: star.entryAlt });
    ac.tgt.ias = ac.ias;
    if (t < 0) this.advanceAlongRoute(ac, -t); // already inbound at shift start
    return ac;
  }
  /** Move an arrival along its STAR by `seconds` of flight (deterministic, kinematic approximation at 250 kt / descending).
   *  Never consumes the whole route: the aircraft is left ≥ 1 NM before its last fix, on the last leg's course. */
  advanceAlongRoute(ac, seconds) {
    let remainingNm = seconds * 250 / 3600;
    const last = ac.route[ac.route.length - 1];
    while (remainingNm > 0 && ac.routeIdx < ac.route.length) {
      const leg = ac.route[ac.routeIdx], d = dist(ac, leg);
      if (leg === last) { const cap = Math.max(0, d - 1); const p = advance(ac, bearingTo(ac, leg), Math.min(cap, remainingNm)); ac.x = p.x; ac.y = p.y; remainingNm = 0; break; }
      if (d <= remainingNm) { ac.x = leg.x; ac.y = leg.y; remainingNm -= d; const a = legAltitude(leg, null); if (a != null) ac.alt = Math.min(ac.alt, a); ac.routeIdx++; }
      else { const p = advance(ac, bearingTo(ac, leg), remainingNm); ac.x = p.x; ac.y = p.y; remainingNm = 0; }
    }
    const nxt = ac.route[ac.routeIdx]; if (nxt && dist(ac, nxt) > 0.01) { ac.hdg = bearingTo(ac, nxt); ac.tgt.hdg = ac.hdg; }
    ac.ias = ac.alt > 10000 ? 280 : Math.min(ac.perf.vMax, 250); ac.tgt.ias = ac.ias; ac.tgt.alt = ac.alt;
  }
  makeDeparture(shift, t) {
    const r = this.rng, hour = Math.floor((this.startHour * 3600 + Math.max(0, t)) / 3600) % 24;
    const f = this.pickFlight(hour); const perf = this.perf[f.type];
    const runway = perf.heavy ? r.pick(this.config.heavyDepartures) : r.pick(this.config.departures);
    const sidId = r.weighted(SID_BY_RUNWAY[runway]);
    const sid = this.procedures.sidsFor(runway).find((s) => s.id === sidId) ?? this.procedures.sidsFor(runway)[0];
    const rw = this.airport.ends[runway];
    // holding short: 350 ft to the side of the threshold, on the terminal side
    const side = runway.startsWith('1') ? -90 : 90;
    const p = advance(rw.thr, rw.hdg + side, 350 * FT_NM);
    const ac = new Aircraft({ id: `D${this.nextId++}`, callsign: `${f.icao}${f.number}`, telephony: f.tel, type: f.type, perf, kind: 'DEP', mode: MODES.QUEUE, x: p.x, y: p.y, alt: rw.elevFt, hdg: rw.hdg, ias: 0, sid: sid ?? null, runway, t: shift.t });
    return ac;
  }
}
