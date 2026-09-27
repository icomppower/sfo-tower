// Arrival entry routes (STAR tails) and departure routes (SIDs) from data/derived/ksfo-procedures.json, projected to sim xy.
const SCOPE_NM = 45;
const RW_GROUP = { WEST: 'RW28B', WEST_28RT: 'RW28B', SOUTHEAST_19: 'RW19B', SOUTHEAST_10: 'RW10B' };

function legsToRoute(legs, proj) {
  const out = [];
  for (const l of legs) {
    if (l.lat == null) continue;
    const p = proj.toXY(l.lat, l.lon);
    const last = out[out.length - 1];
    if (last && last.fix === l.fix) { Object.assign(last, { alt1: l.alt1 ?? last.alt1, alt2: l.alt2 ?? last.alt2, altDesc: l.altDesc ?? last.altDesc, speed: l.speedLimit ?? last.speed }); continue; }
    out.push({ fix: l.fix, x: p.x, y: p.y, alt1: l.alt1, alt2: l.alt2, altDesc: l.altDesc, speed: l.speedLimit, role: l.role });
  }
  return out;
}
/** Altitude to fly at a leg: "at" → alt1; "+" at-or-above → alt1; "-" at-or-below → alt1; "B" between → alt2 (lower)…alt1; window → mid. */
export function legAltitude(leg, fallback) {
  if (leg.alt1 == null) return fallback;
  if (leg.altDesc === 'B') return leg.alt2 ?? leg.alt1;
  return leg.alt1;
}

export function buildProcedures(procJson, proj) {
  const stars = [], sids = [];
  for (const s of procJson.stars) {
    // common route (2/5) + runway transition (3/6) for each runway group, or common only.
    const common = s.routes.filter((r) => r.routeType === '2' || r.routeType === '5');
    const rwy = s.routes.filter((r) => r.routeType === '3' || r.routeType === '6');
    const groups = rwy.length ? rwy : [null];
    for (const rt of groups) {
      const base = common.length ? common[0].legs : [];
      const legs = legsToRoute([...(rt && !common.length ? [] : base), ...(rt ? rt.legs : [])], proj);
      // keep the part inside the scope (plus the first fix outside it as the entry point)
      const inside = legs.map((l) => Math.hypot(l.x, l.y) <= SCOPE_NM);
      const firstIn = inside.indexOf(true); if (firstIn < 0) continue;
      const route = legs.slice(Math.max(0, firstIn - 1)).filter((l) => l.fix !== 'KSFO' && l.fix !== 'SFO');
      if (route.length < 2) continue;
      const entry = route[0];
      const entryAlt = legAltitude(entry, null) ?? Math.min(15000, Math.round(Math.hypot(entry.x, entry.y) * 300 / 1000) * 1000);
      stars.push({ id: s.id, runwayGroup: rt?.transition ?? 'ALL', entryBearing: Math.round(((Math.atan2(entry.x, entry.y) * 180 / Math.PI) + 360) % 360), entryAlt, route });
    }
  }
  for (const s of procJson.sids) {
    for (const rt of s.routes.filter((r) => ['1', '4', 'T'].includes(r.routeType) && r.transition?.startsWith('RW'))) {
      const legs = legsToRoute(rt.legs, proj).filter((l) => l.fix !== 'KSFO' && l.fix !== 'SFO');
      if (!legs.length) continue;
      const climbTo = rt.legs.find((l) => l.pathTerm === 'VA' || l.pathTerm === 'CA')?.alt1 ?? 520;
      sids.push({ id: s.id, runwayGroup: rt.transition, initialClimbFt: climbTo, route: legs, topAlt: 10000, exitBearing: Math.round(((Math.atan2(legs[legs.length - 1].x, legs[legs.length - 1].y) * 180 / Math.PI) + 360) % 360) });
    }
  }
  const forRunway = (list, endId) => list.filter((p) => p.runwayGroup === 'ALL' || p.runwayGroup === '-' || p.runwayGroup === 'RW' + endId.padStart(3, '0') || (p.runwayGroup.endsWith('B') && p.runwayGroup.slice(2, 4) === endId.padStart(3, '0').slice(0, 2)));
  return { stars, sids, starsFor: (endId) => forRunway(stars, endId), sidsFor: (endId) => forRunway(sids, endId) };
}
