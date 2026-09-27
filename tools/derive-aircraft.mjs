#!/usr/bin/env node
// FAA Aircraft Characteristics Database (xlsx) + JO 7360.1K (CWT/SRS/weight cross-check) → data/derived/aircraft.json
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { RAW, unzipText, writeJSON } from './_util.mjs';

const XLSX = join(RAW, 'aircraft/FAA-Aircraft-Char-Database.xlsx');
const PDF = join(RAW, 'aircraft/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf');
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const shared = [...unzipText(XLSX, 'xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs)].map((m) => unesc(m[1].replace(/<[^>]+>/g, '')));
const sheet = unzipText(XLSX, 'xl/worksheets/sheet1.xml');
const rows = [...sheet.matchAll(/<row [^>]*>(.*?)<\/row>/gs)].map((m) => {
  const o = {};
  for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
    const v = c[3]?.match(/<v>(.*?)<\/v>/)?.[1]; if (v == null) continue;
    o[c[1]] = c[2].includes('t="s"') ? shared[+v] : v;
  }
  return o;
});
const hdr = rows[0]; const col = (name) => Object.keys(hdr).find((k) => hdr[k] === name);
const C = { icao: col('ICAO_Code'), mfr: col('Manufacturer'), model: col('Model_FAA'), eng: col('Physical_Class_Engine'), n: col('Num_Engines'), aac: col('AAC'), adg: col('ADG'), vapp: col('Approach_Speed_knot'), span: col('Wingspan_ft_without_winglets_sharklets'), span2: col('Wingspan_ft_with_winglets_sharklets'), len: col('Length_ft'), mtow: col('MTOW_lb'), wtc: col('ICAO_WTC'), weight: col('FAA_Weight'), cwt: col('CWT'), srs: col('SRS'), lahso: col('LAHSO'), ops: col('TMFS_Operations_FY24') };

// The 30 types that make up SFO's traffic in the sim (US majors + regionals + the long-haul heavies + GA).
const WANT = ['A319', 'A320', 'A321', 'A21N', 'A20N', 'A332', 'A333', 'A339', 'A359', 'A35K', 'A388', 'B712', 'B737', 'B738', 'B739', 'B38M', 'B39M', 'B744', 'B748', 'B752', 'B763', 'B772', 'B77W', 'B788', 'B789', 'B78X', 'BCS1', 'BCS3', 'CRJ2', 'CRJ7', 'CRJ9', 'E170', 'E75L', 'E190', 'DH8D', 'C172', 'C208', 'PC12', 'C56X', 'GLF5', 'CL60', 'MD11', 'B762', 'A306'];
const types = {};
for (const r of rows.slice(1)) {
  const id = r[C.icao]; if (!WANT.includes(id) || types[id]) continue;
  types[id] = { icao: id, manufacturer: r[C.mfr], model: r[C.model], engine: r[C.eng], engines: +r[C.n], aac: r[C.aac], adg: r[C.adg], approachSpeedKt: +r[C.vapp], wingspanFt: +(r[C.span2] ?? r[C.span]), lengthFt: +r[C.len], mtowLb: +r[C.mtow], icaoWtc: r[C.wtc], faaWeight: r[C.weight], cwt: r[C.cwt], srs: r[C.srs], lahso: r[C.lahso], opsFY24: +r[C.ops] || 0 };
}
// Cross-check CWT / SRS / weight against JO 7360.1K (pdftotext -layout).
const txt = execFileSync('pdftotext', ['-layout', PDF, '-'], { maxBuffer: 1 << 28 }).toString('utf8');
const mism = [];
for (const t of Object.values(types)) {
  const m = txt.match(new RegExp(`^\\s*${t.icao}\\s+(?:Fixed-wing|Helicopter|Tilt-rotor|Gyrocopter)\\s+(\\S+)\\s+(Super|Heavy|Medium|Light|Large|Small)\\s+([A-I])\\s+(I{1,3})\\s+`, 'm'));
  if (!m) { t.jo7360 = null; continue; }
  t.jo7360 = { enginesClass: m[1], weight: m[2], cwt: m[3], srs: m[4] };
  if (m[3] !== t.cwt || m[4] !== t.srs) { mism.push(`${t.icao}: ACD cwt ${t.cwt}/srs ${t.srs} vs 7360.1K ${m[3]}/${m[4]} → using 7360.1K`); t.cwtSource = 'JO 7360.1K (ACD disagreed: ' + t.cwt + ')'; t.cwt = m[3]; t.srs = m[4]; }
}
console.log(`${Object.keys(types).length} types; 7360.1K matched ${Object.values(types).filter((t) => t.jo7360).length}; mismatches: ${mism.length ? mism.join('; ') : 'none'}`);
writeJSON('aircraft.json', { generated: 'tools/derive-aircraft.mjs', sources: ['FAA Aircraft Characteristics Database (approach speed, AAC, ADG, dimensions, CWT, SRS)', 'FAA Order JO 7360.1K (CWT/SRS/weight cross-check)'], missing: WANT.filter((w) => !types[w]), types });
