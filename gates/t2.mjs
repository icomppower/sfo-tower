// T2 Airport geometry: every runway threshold within 1 m and heading within 0.5° of FAA (NASR) data, cross-checked with OurAirports and CIFP. Shifted dataset fails.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Gate, ROOT, angDiff } from './_lib.mjs';
import { csvObjects, unzipText, haversine, bearing } from '../tools/_util.mjs';
import { buildAirport } from '../sim/airport.js';
import { loadData } from '../sim/load-node.js';

const g = new Gate('T2', 'Airport geometry');
const data = loadData();
const THR_M = 1, HDG_DEG = 0.5, OA_M = 15 /* calibrate: OurAirports vs NASR, measured 2026-09-26 */, CIFP_M = 3 /* calibrate: CIFP threshold vs NASR displaced threshold */;

// Independent re-parse of the raw NASR CSV (not the derived JSON).
const nasrZip = join(ROOT, 'data/raw/nasr', readdirSync(join(ROOT, 'data/raw/nasr')).find((f) => f.endsWith('_APT_CSV.zip')));
const rawEnds = csvObjects(unzipText(nasrZip, 'APT_RWY_END.csv')).filter((r) => r.ARPT_ID === 'SFO' && r.SITE_TYPE_CODE === 'A');
const raw = Object.fromEntries(rawEnds.map((e) => [e.RWY_END_ID.replace(/^0/, ''), { lat: +(e.LAT_DISPLACED_THR_DECIMAL || e.LAT_DECIMAL), lon: +(e.LONG_DISPLACED_THR_DECIMAL || e.LONG_DECIMAL), endLat: +e.LAT_DECIMAL, endLon: +e.LONG_DECIMAL, hdg: +e.TRUE_ALIGNMENT }]));

function evaluate(aptJson) {
  const ap = buildAirport(aptJson, data.procedures);
  const res = { thrErrM: 0, hdgErr: 0, roundTripM: 0, bearingErr: 0 };
  for (const [id, r] of Object.entries(raw)) {
    const e = ap.ends[id]; if (!e) return { missing: id };
    const ll = ap.proj.toLatLon(e.thr.x, e.thr.y);
    res.thrErrM = Math.max(res.thrErrM, haversine(r.lat, r.lon, e.thrLatLon[0], e.thrLatLon[1]));
    res.roundTripM = Math.max(res.roundTripM, haversine(e.thrLatLon[0], e.thrLatLon[1], ll.lat, ll.lon));
    res.hdgErr = Math.max(res.hdgErr, angDiff(e.hdg, r.hdg));
    // the model's heading must also agree with the bearing between the two physical ends on the sphere (data consistency)
    const opp = raw[e.opposite]; res.bearingErr = Math.max(res.bearingErr, angDiff(bearing(r.endLat, r.endLon, opp.endLat, opp.endLon), e.hdg));
  }
  return res;
}
const shift = (aptJson, fn) => { const j = JSON.parse(JSON.stringify(aptJson)); fn(j); return j; };

// ---- negatives: shifted / rotated datasets must fail ----
g.negative('threshold shifted 2 m north is caught', () => { const r = evaluate(shift(data.airport, (j) => { const e = j.nasr.ends.find((x) => x.id === '28L'); e.displacedThrLat += 2 / 111320; })); return r.thrErrM <= THR_M; });
g.negative('threshold shifted 1.5 m east is caught', () => { const r = evaluate(shift(data.airport, (j) => { const e = j.nasr.ends.find((x) => x.id === '1R'); e.displacedThrLon += 1.5 / (111320 * Math.cos(37.62 * Math.PI / 180)); })); return r.thrErrM <= THR_M; });
g.negative('heading rotated 1° is caught', () => { const r = evaluate(shift(data.airport, (j) => { j.nasr.ends.find((x) => x.id === '28R').trueHeading += 1; })); return r.hdgErr <= HDG_DEG; });
g.negative('a runway end swapped with its neighbour is caught', () => { const r = evaluate(shift(data.airport, (j) => { const a = j.nasr.ends.find((x) => x.id === '28L'), b = j.nasr.ends.find((x) => x.id === '28R'); [a.displacedThrLat, b.displacedThrLat] = [b.displacedThrLat, a.displacedThrLat]; })); return r.thrErrM <= THR_M; });

// ---- real ----
const r = evaluate(data.airport);
g.check('8 runway ends, 4 runways in the model', Object.keys(buildAirport(data.airport, data.procedures).ends).length === 8 && Object.keys(raw).length === 8);
g.check(`every landing threshold within ${THR_M} m of NASR`, r.thrErrM <= THR_M, `${r.thrErrM.toFixed(3)} m max`);
g.check(`every runway heading within ${HDG_DEG}° of NASR true alignment`, r.hdgErr <= HDG_DEG, `${r.hdgErr.toFixed(3)}° max`);
g.check('NASR true alignment agrees with the great-circle bearing between the runway ends (≤ 0.5°)', r.bearingErr <= HDG_DEG, `${r.bearingErr.toFixed(3)}° max`);
g.check('projection round trip < 0.05 m', r.roundTripM < 0.05, `${r.roundTripM.toFixed(4)} m`);
// cross-checks
const ap = buildAirport(data.airport, data.procedures);
let oaMax = 0, oaHdg = 0, cifpMax = 0;
for (const e of Object.values(ap.ends)) {
  const oa = data.airport.ourairports.ends.find((x) => x.id === e.id); oaMax = Math.max(oaMax, haversine(oa.lat, oa.lon, e.endLatLon[0], e.endLatLon[1])); oaHdg = Math.max(oaHdg, angDiff(oa.trueHeading, e.hdg));
  const c = data.airport.cifp.ends.find((x) => x.id.replace(/^0/, '') === e.id); cifpMax = Math.max(cifpMax, haversine(c.thrLat, c.thrLon, e.thrLatLon[0], e.thrLatLon[1]));
}
g.check(`OurAirports runway ends within ${OA_M} m and 1° of the NASR model (cross-check)`, oaMax <= OA_M && oaHdg <= 1, `${oaMax.toFixed(1)} m, ${oaHdg.toFixed(1)}°`);
g.check(`CIFP landing thresholds within ${CIFP_M} m of the NASR displaced thresholds (cross-check)`, cifpMax <= CIFP_M, `${cifpMax.toFixed(2)} m`);
g.check('CIFP magnetic bearings + NASR variation = NASR true alignment (≤ 0.5°)', data.airport.cifp.ends.every((c) => angDiff(c.magBearing + data.airport.nasr.magVar, ap.ends[c.id.replace(/^0/, '')].hdg) <= 0.5));
g.check('28L/28R × 1L/1R intersections exist, 4,000–6,000 ft from the 28 thresholds', ap.intersections.length === 4 && ap.intersections.every((i) => ['28L', '28R'].some((k) => i.fromThrFt[k] > 4000 && i.fromThrFt[k] < 6000)), ap.intersections.map((i) => Math.round(Math.min(i.fromThrFt['28L'] ?? 1e9, i.fromThrFt['28R'] ?? 1e9))).join('/'));
g.check('all four parallel pairs are < 2,500 ft apart (one runway for wake, 5-5-4)', ap.closeParallels.length === 4 && ap.closeParallels.every((p) => p[2] > 700 && p[2] < 800), JSON.stringify(ap.closeParallels));
g.finish(`thr ${r.thrErrM.toFixed(3)} m, hdg ${r.hdgErr.toFixed(2)}°, OurAirports ${oaMax.toFixed(1)} m, CIFP ${cifpMax.toFixed(2)} m`);
