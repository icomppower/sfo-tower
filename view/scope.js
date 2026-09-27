// Radar scope: range rings, runways, extended centrelines, STAR fixes, aircraft with data blocks, trails, planned routes, conflict lines.
import { MODES } from '../sim/aircraft.js';
const NM_FT = 6076.1155;
export class Scope {
  constructor(canvas, shift, opts = {}) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.shift = shift; this.range = opts.range ?? 30; this.center = { x: 6, y: -4 }; this.trails = new Map(); this.selected = null; this.assist = opts.assist ?? true; this.dpr = 1;
    this.fixes = this.collectFixes();
  }
  collectFixes() {
    const out = new Map();
    for (const st of this.shift.procedures.stars) { const l = st.route[st.route.length - 1]; if (Math.hypot(l.x, l.y) > 6 && Math.hypot(l.x, l.y) < 40) out.set(l.fix, l); const f = st.route[0]; if (Math.hypot(f.x, f.y) < 45) out.set(f.fix, f); }
    return [...out.values()];
  }
  resize() { const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr)); this.w = r.width; this.h = r.height; }
  scale() { return Math.min(this.w, this.h) / (2 * this.range); }
  toPx(p) { const s = this.scale(); return { x: this.w / 2 + (p.x - this.center.x) * s, y: this.h / 2 - (p.y - this.center.y) * s }; }
  toNm(px) { const s = this.scale(); return { x: this.center.x + (px.x - this.w / 2) / s, y: this.center.y - (px.y - this.h / 2) / s }; }
  /** aircraft position interpolated `frac` of a second past the last sim step */
  pos(a, frac) { if (a.onGround || a.done) return { x: a.x, y: a.y }; const v = (a.gs || a.ias) / 3600 * frac; return { x: a.x + Math.sin(a.hdg * Math.PI / 180) * v, y: a.y + Math.cos(a.hdg * Math.PI / 180) * v }; }
  hit(px, py) { let best = null, bd = 26; for (const a of this.shift.aircraft.values()) { if (a.done) continue; const p = this.toPx(a); const d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = a; } } return best; }
  draw(frac, conflicts) {
    const g = this.g, s = this.shift, ap = s.airport; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.w, this.h);
    const look = this.look ?? {}; g.fillStyle = look.night ? '#02060b' : '#050b12'; g.fillRect(0, 0, this.w, this.h);
    if (look.fog) { g.fillStyle = 'rgba(120,135,150,0.10)'; g.fillRect(0, 0, this.w, this.h); }
    const sc = this.scale(); const c0 = this.toPx({ x: 0, y: 0 });
    // range rings + labels
    g.strokeStyle = '#13263a'; g.lineWidth = 1; g.fillStyle = '#2d4a63'; g.font = '11px system-ui';
    for (let r = 5; r <= 60; r += 5) { g.beginPath(); g.arc(c0.x, c0.y, r * sc, 0, Math.PI * 2); g.stroke(); if (r % 10 === 0) g.fillText(r + ' NM', c0.x + r * sc * 0.707 + 3, c0.y - r * sc * 0.707); }
    // extended centrelines for arrival runways
    for (const id of s.config.arrivals) { const e = ap.ends[id]; const a = this.toPx(e.thr), b = this.toPx(ap.finalPoint(id, 25)); g.strokeStyle = '#1f3f5a'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); for (const d of [5, 10, 15, 20]) { const p = this.toPx(ap.finalPoint(id, d)); g.fillStyle = '#2b5578'; g.fillRect(p.x - 2, p.y - 2, 4, 4); } }
    // runways
    g.strokeStyle = '#9fb7cc'; g.lineWidth = Math.max(2, 200 / NM_FT * sc);
    for (const rw of Object.values(ap.runways)) { const a = this.toPx(rw.a), b = this.toPx(rw.b); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    // fixes
    g.fillStyle = '#5c7f9c'; g.font = '11px system-ui';
    for (const f of this.fixes) { const p = this.toPx(f); if (p.x < -20 || p.y < -20 || p.x > this.w + 20 || p.y > this.h + 20) continue; g.beginPath(); g.moveTo(p.x, p.y - 5); g.lineTo(p.x + 5, p.y + 4); g.lineTo(p.x - 5, p.y + 4); g.closePath(); g.fill(); g.fillText(f.fix, p.x + 7, p.y + 4); }
    // conflicts (assist)
    if (conflicts) for (const [a, b, kind] of conflicts) { const pa = this.toPx(this.pos(a, frac)), pb = this.toPx(this.pos(b, frac)); g.strokeStyle = kind === 'loss' ? '#ff5c6c' : '#ffb648'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke(); g.setLineDash([]); }
    // aircraft
    for (const a of s.aircraft.values()) {
      if (a.done || a.mode === MODES.QUEUE) continue;
      const p = this.toPx(this.pos(a, frac));
      if (p.x < -60 || p.y < -60 || p.x > this.w + 60 || p.y > this.h + 60) continue;
      const tr = this.trails.get(a.id) ?? []; if (!tr.length || s.t !== tr[tr.length - 1].t) { tr.push({ x: a.x, y: a.y, t: s.t }); if (tr.length > 6) tr.shift(); this.trails.set(a.id, tr); }
      g.fillStyle = '#2d6a8a'; for (const q of tr.slice(0, -1)) { const tp = this.toPx(q); g.fillRect(tp.x - 1.5, tp.y - 1.5, 3, 3); }
      const sel = this.selected === a.id; const col = a.kind === 'ARR' ? '#5be0ff' : '#ffd166'; const onGround = a.onGround;
      if (!onGround) { const v = this.toPx(this.pos(a, frac + 60)); g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(v.x, v.y); g.stroke(); } // 1-min vector
      g.strokeStyle = col; g.lineWidth = sel ? 2.5 : 1.5; g.beginPath(); if (a.kind === 'ARR') g.rect(p.x - 5, p.y - 5, 10, 10); else { g.moveTo(p.x, p.y - 6); g.lineTo(p.x + 6, p.y + 5); g.lineTo(p.x - 6, p.y + 5); g.closePath(); } g.stroke();
      if (sel) { g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(p.x, p.y, 13, 0, Math.PI * 2); g.stroke(); if (a.route?.length && a.routeIdx < a.route.length) { g.strokeStyle = '#3fc3ff88'; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(p.x, p.y); for (let i = a.routeIdx; i < a.route.length; i++) { const q = this.toPx(a.route[i]); g.lineTo(q.x, q.y); } g.stroke(); g.setLineDash([]); } }
      // data block
      g.font = (sel ? 'bold ' : '') + '11px ui-monospace, Menlo, monospace'; g.fillStyle = sel ? '#ffffff' : col;
      const alt = Math.round(a.alt / 100).toString().padStart(3, '0'); const spd = Math.round(a.gs || a.ias);
      const l1 = a.callsign, l2 = `${a.type}/${a.cwt} ${a.runway ?? ''}`, l3 = onGround ? (a.mode === MODES.LUAW ? 'LUAW' : a.mode === MODES.TAKEOFF ? 'ROLL' : 'RWY') : `${alt} ${spd}${a.mode === MODES.FINAL ? ' F' + a.finalDistNm.toFixed(0) : a.mode === MODES.APPROACH ? ' APP' : a.mode === MODES.GOAROUND ? ' GA' : ''}`;
      let ox = 9; const oy = -14; g.textAlign = 'start';
      for (const o of s.aircraft.values()) { if (o === a || o.done || o.mode === MODES.QUEUE) continue; const q = this.toPx(this.pos(o, frac)); if (q.x > p.x && q.x - p.x < 70 && Math.abs(q.y - p.y) < 34) { ox = -9; g.textAlign = 'end'; break; } }
      g.fillText(l1, p.x + ox, p.y + oy); g.fillText(l2, p.x + ox, p.y + oy + 12); g.fillText(l3, p.x + ox, p.y + oy + 24); g.textAlign = 'start';
    }
    // wind / config corner
    if (look.night) { g.fillStyle = '#ffd166'; g.font = '11px system-ui'; g.fillText('NIGHT ' + (look.localHour ?? ''), this.w - 70, 20); }
    g.fillStyle = '#8fa3b8'; g.font = '12px system-ui'; const w = s.weather.current.wind;
    g.fillText(`${s.config.name} · ${s.weather.current.conditions} · wind ${w.dir == null ? 'VRB' : String(w.dir).padStart(3, '0')}/${w.kt}${w.gust ? 'G' + w.gust : ''}`, 8, this.h - 8);
  }
}
