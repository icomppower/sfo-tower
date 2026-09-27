#!/usr/bin/env node
// BTS On-Time Performance 2025 (12 monthly zips) → data/derived/ksfo-traffic.json
// Real SFO hourly wheels-on (arrival) and wheels-off (departure) counts by month × day-of-week × local hour, carrier shares, and route mix.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAW, parseCSV, writeJSON } from './_util.mjs';

const dir = join(RAW, 'bts');
const zips = readdirSync(dir).filter((f) => f.endsWith('.zip')).sort((a, b) => +a.match(/_(\d+)\.zip$/)[1] - +b.match(/_(\d+)\.zip$/)[1]);
const hourly = {}; // month -> dow(1-7) -> { arr: [24], dep: [24], days: Set }
const carriers = {}; const dests = {}; const origins = {};
let flights = 0, cancelled = 0;

for (const z of zips) {
  const member = (await new Promise((res, rej) => { let out = ''; const p = spawn('unzip', ['-Z1', join(dir, z)]); p.stdout.on('data', (d) => (out += d)); p.on('close', () => res(out.trim().split('\n').find((n) => n.endsWith('.csv')))); p.on('error', rej); }));
  const proc = spawn('unzip', ['-p', join(dir, z), member]);
  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  let hdr = null, idx = null, n = 0;
  for await (const line of rl) {
    if (!hdr) { hdr = parseCSV(line)[0]; idx = Object.fromEntries(hdr.map((h, i) => [h, i])); continue; }
    if (!line.includes('"SFO"')) continue;
    const r = parseCSV(line)[0];
    const origin = r[idx.Origin], dest = r[idx.Dest];
    if (origin !== 'SFO' && dest !== 'SFO') continue;
    const month = +r[idx.Month], dow = +r[idx.DayOfWeek], day = r[idx.FlightDate];
    const m = (hourly[month] ??= {}); const d = (m[dow] ??= { arr: Array(24).fill(0), dep: Array(24).fill(0), days: new Set() }); d.days.add(day);
    flights++;
    if (r[idx.Cancelled] === '1.00' || r[idx.Cancelled] === '1') { cancelled++; continue; }
    const carrier = r[idx.Reporting_Airline]; carriers[carrier] = (carriers[carrier] ?? 0) + 1;
    if (dest === 'SFO') { const t = r[idx.WheelsOn]; if (/^\d{3,4}$/.test(t)) d.arr[Math.min(23, Math.floor(+t / 100))]++; origins[origin] = (origins[origin] ?? 0) + 1; }
    if (origin === 'SFO') { const t = r[idx.WheelsOff]; if (/^\d{3,4}$/.test(t)) d.dep[Math.min(23, Math.floor(+t / 100))]++; dests[dest] = (dests[dest] ?? 0) + 1; }
    n++;
  }
  console.log(`${z}: ${n} SFO flights`);
}
// Per-hour means (flights per hour, per day) so the sim can sample a realistic day.
const months = {};
for (const [mo, dows] of Object.entries(hourly)) {
  months[mo] = {};
  for (const [dow, d] of Object.entries(dows)) {
    const days = d.days.size;
    months[mo][dow] = { days, arrPerHour: d.arr.map((v) => +(v / days).toFixed(2)), depPerHour: d.dep.map((v) => +(v / days).toFixed(2)) };
  }
}
const top = (o, k = 25) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
const peak = Math.max(...Object.values(months).flatMap((m) => Object.values(m).flatMap((d) => d.arrPerHour.map((a, i) => a + d.depPerHour[i]))));
console.log(`flights ${flights}, cancelled ${cancelled}, peak mean ops/hour ${peak.toFixed(1)}`);
writeJSON('ksfo-traffic.json', { generated: 'tools/derive-bts.mjs', source: 'BTS On-Time Reporting Carrier On-Time Performance, 2025 (US reporting carriers only; international and non-reporting carriers are NOT included)', year: 2025, flights, cancelled, months, carriers: Object.fromEntries(top(carriers, 30)), topOrigins: Object.fromEntries(top(origins)), topDests: Object.fromEntries(top(dests)) });
