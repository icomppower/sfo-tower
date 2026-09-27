#!/usr/bin/env node
// FAA SFO Airport Capacity Profile (2019) → data/derived/sfo-capacity.json: called rate ranges per weather condition and configuration.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { RAW, writeJSON } from './_util.mjs';

const txt = execFileSync('pdftotext', ['-layout', join(RAW, 'capacity/SFO-Airport-Capacity-Profile-2019.pdf'), '-'], { maxBuffer: 1 << 26 }).toString('utf8').replace(/\s+/g, ' ');
const configs = [];
for (const m of txt.matchAll(/(VISUAL|MARGINAL|INSTRUMENT) [–-] (28\/01 SIDE-BYES|28RT STAGGER-BYES|28\/01 INTRAIL|28RT INTRAIL) ([A-Z, ]+?) Hourly Rate .*?CURRENT OPERATIONS (\S+) (\S+) (\d+) (\d+) .*?capacity rate range in (\w+) conditions for ([\w/ -]+?) is currently (\d+)-\s?(\d+) operations per hour/g)) {
  configs.push({ weather: m[1], configuration: m[2], separation: m[3].trim(), arrivalRunways: m[4].split(','), departureRunways: m[5].split(','), facilityReportedOpsPerHour: +m[6], modelEstimatedOpsPerHour: +m[7], rangeOpsPerHour: [+m[10], +m[11]] });
}
const def = {
  VISUAL: txt.match(/VISUAL CONDITIONS: (.*?) MARGINAL CONDITIONS/)[1].trim(),
  MARGINAL: txt.match(/MARGINAL CONDITIONS: (.*?) INSTRUMENT CONDITIONS/)[1].trim(),
  INSTRUMENT: txt.match(/INSTRUMENT CONDITIONS: (.*?) Data Sources/)[1].trim(),
};
console.log(configs.map((c) => `${c.weather} ${c.configuration}: ${c.rangeOpsPerHour.join('-')} ops/h`).join('\n'));
if (configs.length !== 6) throw new Error('expected 6 configuration tables, got ' + configs.length);
writeJSON('sfo-capacity.json', { generated: 'tools/derive-capacity.mjs', source: 'FAA Airport Capacity Profile: San Francisco International Airport (2019), data Dec 2017–Nov 2018 (ASPM)', weatherDefinitions: def, note: 'Rates are total operations per hour (arrivals + departures). In the balanced West Plan roughly half are arrivals.', configurations: configs });
