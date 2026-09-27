#!/usr/bin/env node
// KSFO METAR history (IEM ASOS archive CSV: station,valid,metar) → data/derived/ksfo-metar.json
// One record per hour: t (unix s), wd (deg, null=variable/calm), ws, gust (kt), vis (sm), ceil (ft AGL or null), wx codes, temp/dew (°C), altimeter (inHg), cat (VFR/MVFR/IFR/LIFR).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAW, writeJSON } from './_util.mjs';

export function parseMetar(raw) {
  const t = raw.replace(/\s+/g, ' ').trim().split(' ');
  const o = { wd: null, ws: 0, gust: null, vis: null, ceil: null, wx: [], temp: null, dew: null, altim: null };
  let i = 0, rmk = false;
  for (; i < t.length; i++) {
    const s = t[i];
    if (s === 'RMK') { rmk = true; break; }
    let m;
    if ((m = s.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/))) { o.wd = m[1] === 'VRB' ? null : +m[1]; o.ws = +m[2]; o.gust = m[3] ? +m[3] : null; }
    else if ((m = s.match(/^(M?)(\d+)?(?: )?(\d)\/(\d)SM$/))) o.vis = (m[2] ? +m[2] : 0) + +m[3] / +m[4];
    else if ((m = s.match(/^(M?)(\d+)SM$/))) o.vis = +m[2];
    else if (/^\d$/.test(s) && /^\d\/\dSM$/.test(t[i + 1] ?? '')) { const f = t[++i].match(/^(\d)\/(\d)SM$/); o.vis = +s + +f[1] / +f[2]; }
    else if ((m = s.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/))) { const ft = +m[2] * 100; if ((m[1] === 'BKN' || m[1] === 'OVC' || m[1] === 'VV') && (o.ceil == null || ft < o.ceil)) o.ceil = ft; }
    else if ((m = s.match(/^(M?\d{2})\/(M?\d{2})?$/))) { o.temp = +m[1].replace('M', '-'); o.dew = m[2] ? +m[2].replace('M', '-') : null; }
    else if ((m = s.match(/^A(\d{4})$/))) o.altim = +m[1] / 100;
    else if (/^[-+]?(VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/.test(s) && i > 1) o.wx.push(s);
  }
  if (o.wd === null && o.ws === 0 && !raw.includes('VRB')) o.wd = null;
  const v = o.vis ?? 10, c = o.ceil ?? 99999;
  o.cat = c < 500 || v < 1 ? 'LIFR' : c < 1000 || v < 3 ? 'IFR' : c <= 3000 || v <= 5 ? 'MVFR' : 'VFR';
  return o;
}

if (process.argv[1].endsWith('derive-metar.mjs')) {
  const files = readdirSync(join(RAW, 'metar')).filter((f) => /^KSFO_\d{4}\.csv$/.test(f)).sort();
  const recs = [];
  for (const f of files) {
    for (const line of readFileSync(join(RAW, 'metar', f), 'utf8').split('\n').slice(1)) {
      if (!line.trim()) continue;
      const [, valid, ...rest] = line.split(',');
      const raw = rest.join(',');
      const o = parseMetar(raw);
      recs.push({ t: Math.floor(Date.parse(valid.replace(' ', 'T') + 'Z') / 1000), ...o, raw });
    }
  }
  recs.sort((a, b) => a.t - b.t);
  const cats = {}; for (const r of recs) cats[r.cat] = (cats[r.cat] ?? 0) + 1;
  console.log(`${recs.length} obs ${files.join(', ')}`, cats);
  writeJSON('ksfo-metar.json', { generated: 'tools/derive-metar.mjs', station: 'KSFO', source: 'IEM ASOS archive (NWS METAR)', years: files.map((f) => +f.slice(5, 9)), records: recs });
  // browser copy: same records without the raw METAR text and with short keys expanded on load (view/main.js)
  writeJSON('ksfo-metar.min.json', { generated: 'tools/derive-metar.mjs', station: 'KSFO', source: 'IEM ASOS archive (NWS METAR)', years: files.map((f) => +f.slice(5, 9)), records: recs.map((r) => [r.t, r.wd, r.ws, r.gust, r.vis, r.ceil, r.wx.join(' '), r.temp, r.dew, r.altim, r.cat]) });
}
