#!/usr/bin/env node
// Rebuild every derived dataset from data/raw/ (run tools/fetch-data.mjs first).
import { execFileSync } from 'node:child_process';
for (const s of ['derive-airport', 'derive-cifp', 'derive-metar', 'derive-aircraft', 'derive-capacity', 'derive-bts', 'extract-rules']) {
  console.log(`\n## ${s}`); execFileSync('node', [new URL(`./${s}.mjs`, import.meta.url).pathname], { stdio: 'inherit' });
}
