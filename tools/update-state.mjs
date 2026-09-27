#!/usr/bin/env node
// Rewrites the gate table in STATE.md from verify.sh summaries ("t2:PASS:3/3:summary text").
import { readFileSync, writeFileSync } from 'node:fs';
const TITLES = { t0: 'T0 Data', t1: 'T1 Sim split', t2: 'T2 Airport geometry', t3: 'T3 Flight model', t4: 'T4 Separation rules', t5: 'T5 SFO runway ops', t6: 'T6 Weather', t7: 'T7 Bot shift', t8: 'T8 UI', t9: 'T9 Look (advisory)' };
const p = new URL('../STATE.md', import.meta.url);
let md = readFileSync(p, 'utf8');
const today = new Date().toISOString().slice(0, 10);
for (const arg of process.argv.slice(2)) {
  const [g, st, neg, ...rest] = arg.split(':'); const note = rest.join(':').replace(/\|/g, '/');
  const re = new RegExp(`^\\| ${TITLES[g].replace(/[()]/g, '\\$&')} \\|.*$`, 'm');
  if (st === 'missing') continue;
  md = md.replace(re, `| ${TITLES[g]} | ${st} | ${today} | ${note}${neg ? ` (negatives ${neg})` : ''} |`);
}
writeFileSync(p, md);
