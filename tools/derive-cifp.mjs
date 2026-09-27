#!/usr/bin/env node
// KSFO procedures from the FAA CIFP (ARINC 424-18) → data/derived/ksfo-procedures.json
// Approaches (PF), SIDs (PD), STARs (PE) with resolved fix coordinates, localizers (PI), terminal waypoints (PC).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAW, arincLat, arincLon, unzipText, writeJSON } from './_util.mjs';

const cifpZip = join(RAW, 'cifp', readdirSync(join(RAW, 'cifp')).find((f) => /^CIFP_\d+\.zip$/.test(f)));
const lines = unzipText(cifpZip, 'FAACIFP18').split('\n');

// Fix database: terminal waypoints (PC, any airport in K2), enroute waypoints (EA), VHF navaids (D), NDBs (DB), runways (PG for KSFO).
const fixes = {};
for (const l of lines) {
  if (l.startsWith('SUSAP ') && l[12] === 'C') fixes[l.slice(13, 18).trim() + '|' + l.slice(6, 10)] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'terminal' };
  else if (/^S(USA|PAC|CAN)EA/.test(l)) fixes[l.slice(13, 18).trim()] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'enroute' };
  else if (l.startsWith('SUSAD ') && l[5] === ' ') { const id = l.slice(13, 17).trim(); if (l.slice(32, 41).trim()) fixes[id] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'vor', freq: +l.slice(22, 27) / 100 }; }
  else if (l.startsWith('SUSADB')) fixes[l.slice(13, 17).trim()] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'ndb' };
  else if (l.startsWith('SUSAP KSFOK2A')) fixes['KSFO'] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'airport' };
  else if (l.startsWith('SUSAP KSFOK2G')) fixes[l.slice(13, 18).trim()] = { lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), kind: 'runway' };
}
const fix = (id, section, sub) => (section === 'P' && sub === 'C' ? fixes[id + '|KSFO'] ?? Object.entries(fixes).find(([k]) => k.startsWith(id + '|'))?.[1] : fixes[id]) ?? null;

const alt = (s) => { s = s.trim(); if (!s) return null; if (s.startsWith('FL')) return +s.slice(2) * 100; return +s; };
function leg(l) {
  const fixId = l.slice(29, 34).trim(), sec = l.slice(36, 37), sub = l.slice(37, 38);
  const f = fixId ? fix(fixId, sec, sub) : null;
  return {
    seq: +l.slice(26, 29), fix: fixId || null, lat: f?.lat ?? null, lon: f?.lon ?? null,
    desc: l.slice(39, 43), role: { A: 'IAF', B: 'IF', C: 'IAF', D: 'IF', E: 'FAF', M: 'MAP', ' ': null }[l[42]] ?? null, flyover: l[41] === 'Y',
    turn: l.slice(43, 44).trim() || null, pathTerm: l.slice(47, 49), recNavaid: l.slice(50, 54).trim() || null,
    course: l.slice(70, 74).trim() ? +l.slice(70, 74) / 10 : null, distanceNm: l.slice(74, 78).trim() ? +l.slice(74, 78) / 10 : null,
    altDesc: l.slice(82, 83).trim() || null, alt1: alt(l.slice(84, 89)), alt2: alt(l.slice(89, 94)), speedLimit: l.slice(99, 103).trim() ? +l.slice(99, 103) : null,
    verticalAngle: l.slice(103, 107).trim() ? -(+l.slice(103, 107)) / 100 : null,
  };
}
function procedures(sub) {
  const out = {};
  for (const l of lines) {
    if (!l.startsWith('SUSAP KSFOK2' + sub)) continue;
    const id = l.slice(13, 19).trim(), routeType = l[19], transition = l.slice(20, 25).trim();
    const key = id + '/' + routeType + '/' + (transition || '-');
    (out[id] ??= { id, routes: {} }).routes[key] ??= { routeType, transition: transition || null, legs: [] };
    out[id].routes[key].legs.push(leg(l));
  }
  return Object.values(out).map((p) => ({ ...p, routes: Object.values(p.routes) }));
}
const localizers = lines.filter((l) => l.startsWith('SUSAP KSFOK2I')).map((l) => ({
  ident: l.slice(13, 17).trim(), category: l.slice(17, 18), freqMHz: +l.slice(22, 27) / 100, runway: l.slice(27, 32).trim().replace('RW', ''),
  lat: arincLat(l.slice(32, 41)), lon: arincLon(l.slice(41, 51)), magBearing: +l.slice(51, 55) / 10,
  gsLat: l.slice(55, 64).trim() ? arincLat(l.slice(55, 64)) : null, gsLon: l.slice(64, 74).trim() ? arincLon(l.slice(64, 74)) : null,
  locFromThrFt: +l.slice(74, 78), gsFromThrFt: l.slice(79, 83).trim() ? +l.slice(79, 83) : null, locWidthDeg: +l.slice(83, 87) / 100, gsAngleDeg: +l.slice(87, 90) / 100,
  magVar: (l[90] === 'W' ? -1 : 1) * +l.slice(91, 95) / 10, tchFt: l.slice(95, 97).trim() ? +l.slice(95, 97) : null, elevFt: +l.slice(97, 102),
}));
const terminalWaypoints = Object.fromEntries(Object.entries(fixes).filter(([k]) => k.endsWith('|KSFO')).map(([k, v]) => [k.split('|')[0], { lat: v.lat, lon: v.lon }]));
const approaches = procedures('F'), sids = procedures('D'), stars = procedures('E');
const unresolved = [...approaches, ...sids, ...stars].flatMap((p) => p.routes.flatMap((r) => r.legs.filter((g) => g.fix && g.lat == null).map((g) => p.id + ':' + g.fix)));
writeJSON('ksfo-procedures.json', { generated: 'tools/derive-cifp.mjs', cycle: lines.find((l) => l.startsWith('SUSAP KSFOK2A')).slice(128, 132), localizers, approaches, sids, stars, terminalWaypoints, unresolvedFixes: [...new Set(unresolved)] });
console.log(`approaches ${approaches.length}, SIDs ${sids.length}, STARs ${stars.length}, localizers ${localizers.length}, unresolved fixes ${new Set(unresolved).size}`);
