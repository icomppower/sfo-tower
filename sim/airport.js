// KSFO model built from data/derived/ksfo-airport.json (NASR source of truth) + localizers from ksfo-procedures.json.
import { Projection, segmentIntersection, dist, NM_FT, advance, wrap360 } from './geo.js';

export const CLOSE_PARALLEL_FT = 2500; // 7110.65 5-5-4: parallels < 2,500 ft apart are one runway for wake turbulence

export function buildAirport(aptJson, procJson) {
  const n = aptJson.nasr;
  const proj = new Projection(n.lat, n.lon);
  const ends = {};
  for (const e of n.ends) {
    const thrLat = e.displacedThrLat ?? e.endLat, thrLon = e.displacedThrLon ?? e.endLon;
    ends[e.id] = { id: e.id, runway: e.runway, hdg: e.trueHeading, end: proj.toXY(e.endLat, e.endLon), thr: proj.toXY(thrLat, thrLon), endLatLon: [e.endLat, e.endLon], thrLatLon: [thrLat, thrLon],
      elevFt: e.tdzeFt ?? e.endElevFt ?? n.elevFt, tchFt: e.tchFt ?? 50, gpDeg: e.glidePathDeg ?? 3, ilsType: e.ils, ldaFt: e.ldaFt, toraFt: e.toraFt, displacedFt: e.displacedThrLenFt };
  }
  const runways = {};
  for (const r of n.runways) {
    const [a, b] = r.id.split('/').map((s) => s.replace(/^0/, ''));
    runways[r.id] = { id: r.id, ends: [a, b], lengthFt: r.lengthFt, widthFt: r.widthFt, a: ends[a].end, b: ends[b].end };
    ends[a].opposite = b; ends[b].opposite = a; ends[a].physical = r.id; ends[b].physical = r.id;
  }
  for (const e of Object.values(ends)) {
    const opp = ends[e.opposite];
    e.farEnd = opp.end; // physical end of pavement ahead of a landing/departing aircraft on this end
    e.hdgCheck = Math.round(wrap360(Math.atan2(e.farEnd.x - e.end.x, e.farEnd.y - e.end.y) * 180 / Math.PI));
    const loc = procJson.localizers.find((l) => l.runway === e.id);
    e.ils = !!loc; e.gsDeg = loc?.gsAngleDeg ?? e.gpDeg; e.approachType = loc ? 'ILS' : 'RNAV';
    e.finalCourse = e.hdg; // localizers are aligned with the runway (CIFP bearings 283.8 M + 14 E ≈ 298 T)
  }
  // Runway intersections (28L/28R × 1L/1R) with distances from each landing threshold / departure end.
  const intersections = [];
  const rw = Object.values(runways);
  for (let i = 0; i < rw.length; i++) for (let j = i + 1; j < rw.length; j++) {
    const p = segmentIntersection(rw[i].a, rw[i].b, rw[j].a, rw[j].b);
    if (!p) continue;
    const from = {};
    for (const id of [...rw[i].ends, ...rw[j].ends]) from[id] = dist(ends[id].thr, p) * NM_FT;
    intersections.push({ runways: [rw[i].id, rw[j].id], x: p.x, y: p.y, fromThrFt: from });
  }
  // Close parallel pairs (one runway for wake purposes).
  const closeParallels = [];
  const endList = Object.values(ends);
  for (let i = 0; i < endList.length; i++) for (let j = i + 1; j < endList.length; j++) {
    const a = endList[i], b = endList[j];
    if (a.physical === b.physical || Math.abs(a.hdg - b.hdg) > 1) continue;
    const sep = Math.abs((b.thr.x - a.thr.x) * Math.cos(a.hdg * Math.PI / 180) - (b.thr.y - a.thr.y) * Math.sin(a.hdg * Math.PI / 180)) * NM_FT;
    if (sep < CLOSE_PARALLEL_FT) closeParallels.push([a.id, b.id, Math.round(sep)]);
  }
  const intersecting = (endA, endB) => intersections.find((s) => s.runways.includes(ends[endA].physical) && s.runways.includes(ends[endB].physical)) ?? null;
  const sameOrCloseParallel = (endA, endB) => ends[endA].physical === ends[endB].physical || closeParallels.some(([a, b]) => (a === endA && b === endB) || (a === endB && b === endA));
  return { icao: n.icao, name: n.name, elevFt: n.elevFt, magVar: n.magVar, proj, ends, runways, intersections, closeParallels, intersecting, sameOrCloseParallel,
    /** point on the final approach course d NM before the threshold */
    finalPoint: (endId, dNm) => advance(ends[endId].thr, ends[endId].finalCourse + 180, dNm) };
}

// Runway configurations (SFO plans). arrivals/departures list runway ends; heavies depart 28L in the West Plan (capacity profile).
export const CONFIGS = {
  WEST: { id: 'WEST', name: 'West Plan 28/01', arrivals: ['28L', '28R'], departures: ['1L', '1R'], heavyDepartures: ['28L'], pairedArrivals: true },
  WEST_28RT: { id: 'WEST_28RT', name: '28 Right Turn (28/28)', arrivals: ['28L', '28R'], departures: ['28L', '28R'], heavyDepartures: ['28L'], pairedArrivals: true },
  SOUTHEAST: { id: 'SOUTHEAST', name: 'Southeast Plan 19/10', arrivals: ['19L', '19R'], departures: ['10L', '10R'], heavyDepartures: ['10L'], pairedArrivals: false },
};
