// T0 Data: runways, CIFP procedures, METAR history and BTS counts for KSFO fetched, cached, checksummed; licences recorded.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Gate, ROOT, readJSON } from './_lib.mjs';
import { SOURCES } from '../tools/fetch-data.mjs';

const g = new Gate('T0', 'Data');
const CK = join(ROOT, 'data/checksums.json');
const runCheck = () => { try { execFileSync('node', [join(ROOT, 'tools/fetch-data.mjs'), '--check'], { stdio: 'pipe' }); return true; } catch { return false; } };

// ---- negatives: each mutation of the cache must make --check fail ----
copyFileSync(CK, CK + '.bak');
try {
  const ck = readJSON('data/checksums.json');
  g.negative('flipped checksum of one raw file is caught', () => {
    const m = JSON.parse(JSON.stringify(ck)); const k = Object.keys(m.files)[0]; m.files[k].sha256 = '0'.repeat(64);
    writeFileSync(CK, JSON.stringify(m)); return runCheck();
  });
  g.negative('missing checksum record is caught', () => {
    const m = JSON.parse(JSON.stringify(ck)); delete m.files['ourairports/runways.csv'];
    writeFileSync(CK, JSON.stringify(m)); return runCheck();
  });
  copyFileSync(CK + '.bak', CK);
  g.negative('a truncated raw file is caught', () => {
    const p = join(ROOT, 'data/raw/ourairports/airports.csv'); const orig = readFileSync(p);
    try { writeFileSync(p, orig.subarray(0, orig.length - 10)); return runCheck(); } finally { writeFileSync(p, orig); }
  });
  g.negative('a source without a licence note is caught', () => {
    const m = JSON.parse(JSON.stringify(ck)); m.files['cifp/CIFP_260903.zip'].licence = '';
    return Object.values(m.files).every((f) => f.licence && f.licence.length > 10);
  });
} finally { copyFileSync(CK + '.bak', CK); unlinkSync(CK + '.bak'); }

// ---- real checks ----
const ck = readJSON('data/checksums.json');
g.check('checksums verify (fetch-data --check)', runCheck());
g.check('every manifest source has a checksum record', SOURCES.every((s) => ck.files[s.out]), `${Object.keys(ck.files).length}/${SOURCES.length}`);
g.check('every record carries a licence note and a use', Object.values(ck.files).every((f) => f.licence?.length > 10 && f.use?.length > 5));
const groups = { nasr: /^nasr\//, cifp: /^cifp\//, ourairports: /^ourairports\//, metar: /^metar\//, bts: /^bts\//, '7110.65': /^faa-7110\//, aircraft: /^aircraft\// };
for (const [k, re] of Object.entries(groups)) g.check(`source group cached: ${k}`, Object.keys(ck.files).some((f) => re.test(f)));
g.check('12 BTS months cached', Object.keys(ck.files).filter((f) => f.startsWith('bts/')).length === 12);
g.check('3 METAR years cached', Object.keys(ck.files).filter((f) => f.startsWith('metar/')).length === 3);

const apt = readJSON('data/derived/ksfo-airport.json');
g.check('NASR: 4 runways / 8 ends for KSFO', apt.nasr.runways.length === 4 && apt.nasr.ends.length === 8);
g.check('NASR effective date matches the checksummed cycle', apt.nasr.effective.replace(/\//g, '-') === '2026-09-03' && ck.nasrCycle === '03_Sep_2026');
g.check('CIFP: 8 runway ends, 3 localizers', apt.cifp.ends.length === 8);
const proc = readJSON('data/derived/ksfo-procedures.json');
g.check('CIFP: ≥12 approaches, ≥8 SIDs, ≥8 STARs, 3 localizers', proc.approaches.length >= 12 && proc.sids.length >= 8 && proc.stars.length >= 8 && proc.localizers.length === 3, `${proc.approaches.length}/${proc.sids.length}/${proc.stars.length}/${proc.localizers.length}`);
g.check('CIFP: ILS 28L, ILS 28R, ILS 19L present', ['I28L', 'I28R', 'I19L'].every((id) => proc.approaches.some((a) => a.id === id)));
g.check('CIFP: every procedure fix resolved to coordinates', proc.unresolvedFixes.length === 0, proc.unresolvedFixes.join(','));
const metar = readJSON('data/derived/ksfo-metar.json');
g.check('METAR: ≥ 26,000 hourly obs over 2023–2025', metar.records.length >= 26000, String(metar.records.length));
g.check('METAR: LIFR/IFR hours present (fog exists)', metar.records.filter((r) => r.cat === 'LIFR' || r.cat === 'IFR').length > 500);
g.check('METAR: obs sorted, no gap > 6 h', metar.records.every((r, i) => i === 0 || (r.t > metar.records[i - 1].t && r.t - metar.records[i - 1].t <= 6 * 3600)));
const traffic = existsSync(join(ROOT, 'data/derived/ksfo-traffic.json')) ? readJSON('data/derived/ksfo-traffic.json') : null;
g.check('BTS: traffic derived for 12 months', !!traffic && Object.keys(traffic.months).length === 12);
g.check('BTS: ≥ 250,000 SFO flights in 2025 and a 7-day pattern for every month', !!traffic && traffic.flights >= 250000 && Object.values(traffic.months).every((m) => Object.keys(m).length === 7), traffic ? String(traffic.flights) : 'missing');
const ac = readJSON('data/derived/aircraft.json');
g.check('aircraft: ≥ 40 types with approach speed, CWT and SRS', Object.values(ac.types).filter((t) => t.approachSpeedKt > 50 && /^[A-I]$/.test(t.cwt) && /^I{1,3}$/.test(t.srs)).length >= 40 && ac.missing.length === 0, `${Object.keys(ac.types).length} types, missing ${ac.missing}`);
g.check('aircraft: every type cross-checked against JO 7360.1K', Object.values(ac.types).every((t) => t.jo7360));
const cap = readJSON('data/derived/sfo-capacity.json');
g.check('capacity profile: 6 configuration rate ranges incl. VISUAL side-by and INSTRUMENT in-trail', cap.configurations.length === 6 && cap.configurations.some((c) => c.weather === 'VISUAL' && c.configuration.includes('SIDE-BYES')) && cap.configurations.some((c) => c.weather === 'INSTRUMENT' && c.configuration.includes('INTRAIL')));
const rules = readFileSync(join(ROOT, 'docs/RULES.md'), 'utf8');
g.check('RULES.md quotes 3-9-6, 3-9-8, 3-10-3, 3-10-4, 5-5-4 from 7110.65BB', ['## 3-9-6', '## 3-9-8', '## 3-10-3', '## 3-10-4', '## 5-5-4', '7110.65BB'].every((s) => rules.includes(s)) && rules.length > 20000);
g.finish(`${Object.keys(ck.files).length} raw files checksummed, ${metar.records.length} METARs, ${proc.approaches.length} approaches, ${Object.keys(ac.types).length} aircraft types`);
