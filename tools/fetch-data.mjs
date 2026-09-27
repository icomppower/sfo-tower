#!/usr/bin/env node
// Downloads every raw dataset SFO Tower is built from into data/raw/ (gitignored),
// records SHA-256 checksums + licence notes in data/checksums.json, and with --check
// verifies the cached files against the recorded checksums without downloading.
//   node tools/fetch-data.mjs            fetch what is missing, then (re)write checksums
//   node tools/fetch-data.mjs --check    verify cached files against data/checksums.json
//   node tools/fetch-data.mjs --force    re-download everything
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data/raw');
const CHECKSUMS = join(ROOT, 'data/checksums.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 sfo-tower-data-fetch';

// NASR 28-day cycle in effect on 2026-09-26 (cycles: 2025-01-23 + 28 n).
const NASR_CYCLE = '03_Sep_2026';
const CIFP_CYCLE = '260903';
const IEM = (y) => `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=SFO&data=metar&year1=${y}&month1=1&day1=1&year2=${y + 1}&month2=1&day2=1&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&missing=M&trace=T&direct=no`;
const BTS = (m) => `https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_2025_${m}.zip`;
const ATC = (p) => `https://www.faa.gov/air_traffic/publications/atpubs/atc_html/${p}.html`;

export const SOURCES = [
  { id: 'nasr-apt', url: `https://nfdc.faa.gov/webContent/28DaySub/extra/${NASR_CYCLE}_APT_CSV.zip`, out: `nasr/${NASR_CYCLE}_APT_CSV.zip`,
    licence: 'FAA NASR (National Airspace System Resources) 28-day subscription — US Government work, public domain.', use: 'runway ends, thresholds, elevations, true alignment (T2 source of truth)' },
  { id: 'cifp', url: `https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_${CIFP_CYCLE}.zip`, out: `cifp/CIFP_${CIFP_CYCLE}.zip`,
    licence: 'FAA CIFP (Coded Instrument Flight Procedures, ARINC 424) — US Government work, public domain; see "FAA CIFP Disclaimer.pdf" inside the zip.', use: 'KSFO approaches, SIDs, STARs, fixes, localizers, runway cross-check' },
  { id: 'ourairports-runways', url: 'https://davidmegginson.github.io/ourairports-data/runways.csv', out: 'ourairports/runways.csv',
    licence: 'OurAirports — released into the public domain (https://ourairports.com/data/).', use: 'T2 cross-check of runway ends' },
  { id: 'ourairports-airports', url: 'https://davidmegginson.github.io/ourairports-data/airports.csv', out: 'ourairports/airports.csv',
    licence: 'OurAirports — public domain.', use: 'KSFO reference point / elevation cross-check' },
  ...[2023, 2024, 2025].map((y) => ({ id: `metar-${y}`, url: IEM(y), out: `metar/KSFO_${y}.csv`, sequential: true,
    licence: 'Iowa Environmental Mesonet ASOS archive (redistributed NWS/FAA METAR observations) — US Government observations, public domain; IEM asks for attribution and rate limiting.', use: 'historical KSFO METARs for runway configuration statistics and shift weather (T6)' })),
  ...Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({ id: `bts-2025-${m}`, url: BTS(m), out: `bts/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_2025_${m}.zip`,
    licence: 'US DOT Bureau of Transportation Statistics, Airline On-Time Performance Data — US Government work, public domain.', use: 'real hourly SFO arrival/departure counts and carrier mix (traffic shape)' })),
  ...['chap0_section_0', 'chap2_section_1', 'chap3_section_9', 'chap3_section_10', 'chap5_section_5', 'chap5_section_8', 'chap7_section_2'].map((p) => ({ id: `7110-${p}`, url: ATC(p), out: `faa-7110/${p}.html`,
    licence: 'FAA Order JO 7110.65BB Air Traffic Control (HTML edition) — US Government work, public domain.', use: 'separation, wake, same/intersecting runway rules (T4, T5); paragraphs quoted in docs/RULES.md' })),
  { id: '7360-1K', url: 'https://www.faa.gov/documentLibrary/media/Order/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf', out: 'aircraft/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf',
    licence: 'FAA Order JO 7360.1K Aircraft Type Designators — US Government work, public domain.', use: 'per-type CWT wake category, SRS category, weight class' },
  { id: 'sfo-capacity-profile', url: 'https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/SFO-Airport-Capacity-Profile-2019.pdf', out: 'capacity/SFO-Airport-Capacity-Profile-2019.pdf',
    licence: 'FAA Airport Capacity Profile: San Francisco International (2019) — US Government work, public domain.', use: 'called arrival/departure rates by runway configuration and weather (T6 throughput ranges)' },
  { id: 'faa-ifh', url: 'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf', out: 'refs/FAA-H-8083-15B.pdf',
    licence: 'FAA Instrument Flying Handbook FAA-H-8083-15B — US Government work, public domain.', use: 'standard rate turn = 3° per second (T3 turn-rate citation)' },
  { id: 'faa-aim-4-4', url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_4.html', out: 'faa-aim/chap4_section_4.html',
    licence: 'FAA Aeronautical Information Manual, Chapter 4 Section 4 (HTML) — US Government work, public domain.', use: 'AIM 4-4-12 speed adjustments: 250 kt below 10,000 ft (14 CFR 91.117), 200 kt within Class B surface area speed context (T3)' },
  { id: 'ecfr-91-117', url: 'https://www.ecfr.gov/api/versioner/v1/full/2026-09-01/title-14.xml?part=91&section=91.117', out: 'refs/14CFR-91.117.xml',
    licence: 'eCFR, 14 CFR 91.117 Aircraft speed (point-in-time 2026-09-01) — US Government work, public domain.', use: '250 kt below 10,000 ft (T3)' },
  { id: 'faa-aircraft-char', url: 'https://www.faa.gov/airports/engineering/aircraft_char_database/aircraft_data', out: 'aircraft/FAA-Aircraft-Char-Database.xlsx',
    licence: 'FAA Aircraft Characteristics Database (Office of Airports) — US Government work, public domain.', use: 'approach speed, approach category, wingspan/length per type (T3)' },
];

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(src) {
  const out = join(RAW, src.out);
  mkdirSync(dirname(out), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(src.url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error(`${src.id}: suspiciously small response (${buf.length} B): ${buf.toString().slice(0, 120)}`);
      writeFileSync(out, buf);
      return;
    }
    console.error(`  ${src.id}: HTTP ${res.status} (attempt ${attempt})`);
    await sleep(3000 * attempt);
  }
  throw new Error(`${src.id}: download failed`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const force = args.has('--force');
  const prev = existsSync(CHECKSUMS) ? JSON.parse(readFileSync(CHECKSUMS, 'utf8')) : { files: {} };
  const files = {};
  let bad = 0;
  for (const src of SOURCES) {
    const out = join(RAW, src.out);
    if (check) {
      const rec = prev.files[src.out];
      if (!rec) { console.log(`MISSING-RECORD ${src.out}`); bad++; continue; }
      if (!existsSync(out)) { console.log(`MISSING-FILE ${src.out}`); bad++; continue; }
      const h = sha256(out);
      if (h !== rec.sha256) { console.log(`MISMATCH ${src.out}`); bad++; } else console.log(`OK ${src.out}`);
      continue;
    }
    if (force || !existsSync(out) || statSync(out).size === 0) {
      console.log(`fetch ${src.id} ← ${src.url}`);
      await download(src);
      if (src.sequential) await sleep(8000); // IEM rate limit
    }
    files[src.out] = { id: src.id, url: src.url, sha256: sha256(out), bytes: statSync(out).size, fetched: prev.files[src.out]?.fetched ?? new Date().toISOString().slice(0, 10), licence: src.licence, use: src.use };
    console.log(`  ${src.out}  ${files[src.out].bytes} B  ${files[src.out].sha256.slice(0, 16)}…`);
  }
  if (check) { console.log(bad ? `CHECK FAILED (${bad})` : 'CHECK OK'); process.exit(bad ? 1 : 0); }
  writeFileSync(CHECKSUMS, JSON.stringify({ note: 'SHA-256 of every raw file in data/raw/ (gitignored). Regenerate with node tools/fetch-data.mjs; verify with --check.', nasrCycle: NASR_CYCLE, cifpCycle: CIFP_CYCLE, files }, null, 2) + '\n');
  console.log(`wrote ${CHECKSUMS} (${Object.keys(files).length} files)`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
