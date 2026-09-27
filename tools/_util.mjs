import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = join(ROOT, 'data/raw');
export const DERIVED = join(ROOT, 'data/derived');

/** Read one member of a zip as a UTF-8 string (via the system unzip). */
export function unzipText(zipPath, member, maxBuffer = 1 << 30) {
  return execFileSync('unzip', ['-p', zipPath, member], { maxBuffer }).toString('utf8');
}
export function unzipBuffer(zipPath, member, maxBuffer = 1 << 30) {
  return execFileSync('unzip', ['-p', zipPath, member], { maxBuffer });
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas and doubled quotes). */
export function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export function csvObjects(text) {
  const rows = parseCSV(text).filter((r) => r.length > 1 || r[0] !== '');
  const hdr = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ''])));
}

export function writeJSON(rel, obj) {
  const p = join(DERIVED, rel); mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 1) + '\n');
  console.log(`wrote ${rel} (${(readFileSync(p).length / 1024).toFixed(0)} KB)`);
}
export const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** ARINC 424 lat "N37363403" (DDMMSSss) / lon "W122225483" (DDDMMSSss) → decimal degrees. */
export function arincLat(s) { const sg = s[0] === 'S' ? -1 : 1; return sg * (+s.slice(1, 3) + +s.slice(3, 5) / 60 + +s.slice(5, 9) / 100 / 3600); }
export function arincLon(s) { const sg = s[0] === 'W' ? -1 : 1; return sg * (+s.slice(1, 4) + +s.slice(4, 6) / 60 + +s.slice(6, 10) / 100 / 3600); }

/** Geodesy on the WGS-84 sphere (R = 6371008.8 m); good to <0.1% at 50 km. */
export const R_EARTH = 6371008.8;
const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}
export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
