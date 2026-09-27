// Debug plot: run a bot shift and draw aircraft tracks (arrivals coloured by bot state) over the runway/final geometry → PNG.
// node tools/plot-tracks.mjs <out.png> <seed> <difficulty> <weather> <minutes> [demandArr] [demandDep]
import { writeFileSync } from 'node:fs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
import { launch } from './browser.mjs';
const [out = '/tmp/tracks.png', seed = 'cap', difficulty = 'normal', weather = 'clear', minutes = '15', dArr, dDep] = process.argv.slice(2);
const s = new Shift(loadData(), { seed, difficulty, weather, durationMin: +minutes, demand: dArr ? { arr: +dArr, dep: +dDep } : null });
const bot = new Bot(s); const tracks = new Map(); const marks = [];
while (!s.finished && !s.gameOver) { bot.tick(); const n = s.events.length; s.step(1); if (s.t % 4 === 0) for (const a of s.aircraft.values()) { if (a.done || a.kind !== 'ARR') continue; const st = bot.plan.get(a.id)?.state ?? a.mode; (tracks.get(a.id) ?? tracks.set(a.id, []).get(a.id)).push([a.x, a.y, st, a.alt]); } for (const e of s.events.slice(n)) if (['SEP_LOSS', 'WAKE', 'COLLISION', 'RUNWAY_INCURSION', 'CROSSING_CONFLICT'].includes(e.type)) { const a = s.aircraft.get(e.ac); if (a) marks.push([a.x, a.y, e.type]); } }
const W = 1400, H = 1000, scale = 22, cx = W / 2 - 150, cy = H / 2 - 60; const X = (x) => cx + x * scale, Y = (y) => cy - y * scale;
const COL = { star: '#999', hold: '#e6a', entry: '#4ad', lane: '#2b8', trombone: '#f80', released: '#66f', final: '#000', goaround: '#f00', return: '#a0f', VECTOR: '#888', APPROACH: '#66f', FINAL: '#000', STAR: '#999', GOAROUND: '#f00' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font:12px sans-serif">`;
for (let r = 5; r <= 40; r += 5) svg += `<circle cx="${X(0)}" cy="${Y(0)}" r="${r * scale}" fill="none" stroke="#eee"/><text x="${X(0) + r * scale + 2}" y="${Y(0)}" fill="#bbb">${r}</text>`;
for (const rw of Object.values(s.airport.runways)) svg += `<line x1="${X(rw.a.x)}" y1="${Y(rw.a.y)}" x2="${X(rw.b.x)}" y2="${Y(rw.b.y)}" stroke="#333" stroke-width="4"/>`;
for (const id of s.config.arrivals) { const e = s.airport.ends[id]; const f = s.airport.finalPoint(id, 30); svg += `<line x1="${X(e.thr.x)}" y1="${Y(e.thr.y)}" x2="${X(f.x)}" y2="${Y(f.y)}" stroke="#c9c" stroke-dasharray="6 4"/>`; for (const d of [10, 14, 20]) { const p = s.airport.finalPoint(id, d); svg += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="#c9c"/>`; } }
for (const side of [1, -1]) { const g = bot.laneGeo?.(s.config.arrivals[0], side); if (g) svg += `<circle cx="${X(g.E.x)}" cy="${Y(g.E.y)}" r="5" fill="none" stroke="#4ad" stroke-width="2"/><text x="${X(g.E.x) + 6}" y="${Y(g.E.y)}" fill="#4ad">E${side > 0 ? 'S' : 'N'}</text>`; }
for (const st of s.procedures.stars) { const l = st.route[st.route.length - 1]; svg += `<text x="${X(l.x) + 4}" y="${Y(l.y) - 4}" fill="#a66">${l.fix}</text><circle cx="${X(l.x)}" cy="${Y(l.y)}" r="3" fill="#a66"/>`; }
for (const [id, pts] of tracks) { for (let i = 1; i < pts.length; i++) svg += `<line x1="${X(pts[i - 1][0])}" y1="${Y(pts[i - 1][1])}" x2="${X(pts[i][0])}" y2="${Y(pts[i][1])}" stroke="${COL[pts[i][2]] ?? '#0aa'}" stroke-width="1.5" opacity="0.8"/>`; const l = pts[pts.length - 1]; svg += `<text x="${X(l[0]) + 3}" y="${Y(l[1]) + 3}" fill="#333" font-size="10">${s.aircraft.get(id)?.callsign ?? id} ${Math.round(l[3] / 100)}</text>`; }
for (const [x, y, t] of marks) svg += `<circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="none" stroke="${t === 'COLLISION' ? '#f00' : t === 'WAKE' ? '#f80' : '#d00'}" stroke-width="2"/>`;
let ly = 20; for (const [k, c] of Object.entries(COL).slice(0, 9)) { svg += `<rect x="${W - 130}" y="${ly - 10}" width="12" height="12" fill="${c}"/><text x="${W - 112}" y="${ly}">${k}</text>`; ly += 16; }
const sc = s.scoring.summary(); svg += `<text x="10" y="${H - 10}">${seed}/${difficulty}/${weather} ${s.config.id} ${s.weather.current.conditions} t=${s.t}s landed=${sc.LANDED} dep=${sc.DEPARTED} sep=${sc.SEP_LOSS} wake=${sc.WAKE} coll=${sc.COLLISION} lost=${sc.LOST} GA=${sc.GO_AROUND}</text></svg>`;
writeFileSync('/tmp/tracks.svg', svg);
const browser = await launch({ viewport: { width: W, height: H } }); const page = await browser.newPage(); await page.setContent(`<html><body style="margin:0">${svg}</body></html>`); await page.screenshot({ path: out }); await browser.close();
console.log('wrote', out, `t=${s.t}`, JSON.stringify(sc));
