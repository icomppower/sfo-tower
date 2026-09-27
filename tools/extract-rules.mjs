#!/usr/bin/env node
// Quote the JO 7110.65BB paragraphs the sim implements → docs/RULES.md (from the cached FAA HTML).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW, ROOT } from './_util.mjs';

const text = (p) => readFileSync(join(RAW, 'faa-7110', p + '.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  .replace(/<\/(p|div|h[1-6]|li|tr)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/t[dh]>/g, ' | ')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8209;|&#8211;|&ndash;/g, '-').replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
const para = (t, id, next) => { const i = t.indexOf(id + '.'); const j = t.indexOf(next + '.', i + 1); return t.slice(i, j > 0 ? j : i + 6000).trim(); };
const ed = text('chap0_section_0').match(/7110\.65[A-Z]{1,2}/)[0];
const c2 = text('chap2_section_1'), c39 = text('chap3_section_9'), c310 = text('chap3_section_10'), c55 = text('chap5_section_5'), c72 = text('chap7_section_2');
const sections = [
  ['2-1-19', para(c2, '2-1-19', '2-1-20'), 'sim/rules.js applies wake separation to touchdown for IFR arrivals not on a visual approach.'],
  ['3-9-4', para(c39, '3-9-4', '3-9-5'), 'LUAW command: an aircraft may line up and wait; takeoff clearance is a separate action.'],
  ['3-9-6', para(c39, '3-9-6', '3-9-7'), 'Same-runway departure separation: preceding departure past the runway end / airborne with the SRS distance, or preceding arrival clear of the runway; CWT time intervals (3 min behind A, 2 min behind B/D, 2 min E-I behind C, 2 min I behind E).'],
  ['3-9-8', para(c39, '3-9-8', '3-9-9'), 'Intersecting-runway departure separation (SFO 1L/1R departures vs 28L/28R arrivals): no takeoff roll until the arrival has passed the intersection, is clear, or holds short; CWT time intervals when flight paths cross.'],
  ['3-10-3', para(c310, '3-10-3', '3-10-4'), 'Same-runway arrival separation: threshold crossing only when the runway is clear or the SRS distance exists (3,000 / 4,500 / 6,000 ft).'],
  ['3-10-4', para(c310, '3-10-4', '3-10-5'), 'Intersecting-runway arrival separation: an arrival may not cross the threshold until the departing aircraft has passed the intersection or is airborne and turning away.'],
  ['5-5-4', para(c55, '5-5-4', '5-5-5'), 'Radar minima: 3 NM terminal (2.5 NM inside 10 NM on final with documented runway occupancy ≤ 50 s); CWT wake matrices TBL 5-5-1 (directly behind) and TBL 5-5-2 (on approach, measured at the threshold).'],
  ['5-5-5', para(c55, '5-5-5', '5-5-6'), 'Vertical separation 1,000 ft below FL 410 is an alternative to radar separation.'],
  ['7-2-1', para(c72, '7-2-1', '7-2-2'), 'Visual separation in VMC may substitute for radar separation between arrivals in the tower environment (assist level / visual approach mode).'],
];
let md = `# Rules implemented (FAA Order JO ${ed})\n\nQuoted from the FAA HTML edition cached in \`data/raw/faa-7110/\` (checksums in \`data/checksums.json\`). Each block ends with how the sim uses it. Wake categories are the Consolidated Wake Turbulence (CWT) letters A–I assigned per type by JO 7360.1K / the FAA Aircraft Characteristics Database.\n\n`;
for (const [id, body, use] of sections) md += `## ${id}\n\n> ${body.split('\n').filter(Boolean).join('\n> ')}\n\n**Sim:** ${use}\n\n`;
writeFileSync(join(ROOT, 'docs/RULES.md'), md);
console.log(`docs/RULES.md ${md.length} chars, edition ${ed}`);
