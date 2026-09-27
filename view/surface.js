// Airport surface map: runways with numbers, intersections, hold-short bars, aircraft on the ground and on short final, occupancy.
import { MODES } from '../sim/aircraft.js';
const NM_FT = 6076.1155;
export class Surface {
  constructor(canvas, shift) { this.c = canvas; this.g = canvas.getContext('2d'); this.shift = shift; this.half = 1.7; this.center = { x: 0.15, y: -0.05 }; this.selected = null; this.dpr = 1; }
  resize() { const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr)); this.w = r.width; this.h = r.height; }
  scale() { return Math.min(this.w, this.h) / (2 * this.half); }
  toPx(p) { const s = this.scale(); return { x: this.w / 2 + (p.x - this.center.x) * s, y: this.h / 2 - (p.y - this.center.y) * s }; }
  hit(px, py) { let best = null, bd = 22; for (const a of this.shift.aircraft.values()) { if (a.done) continue; const p = this.toPx(a); const d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = a; } } return best; }
  draw(frac) {
    const g = this.g, s = this.shift, ap = s.airport; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.w, this.h);
    g.fillStyle = '#08131c'; g.fillRect(0, 0, this.w, this.h); const sc = this.scale();
    // bay water hint (east/south-east of the field) and runways
    g.fillStyle = '#0b2033'; g.beginPath(); const bx = this.toPx({ x: 1.6, y: -0.2 }); g.moveTo(bx.x, -10); g.lineTo(this.w + 10, -10); g.lineTo(this.w + 10, this.h + 10); g.lineTo(bx.x - 0.9 * sc, this.h + 10); g.closePath(); g.fill();
    const occupied = new Set(); for (const a of s.aircraft.values()) if (a.onRunway && !a.done && a.clearedRunwayAt == null) occupied.add(a.onRunway);
    for (const rw of Object.values(ap.runways)) {
      const a = this.toPx(rw.a), b = this.toPx(rw.b); g.strokeStyle = occupied.has(rw.id) ? '#6b2a33' : '#3b4c5c'; g.lineWidth = Math.max(6, rw.widthFt / NM_FT * sc); g.lineCap = 'butt'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = '#a9b8c6'; g.lineWidth = 1; g.setLineDash([8, 10]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
      for (const id of rw.ends) { const e = ap.ends[id]; const use = s.config.arrivals.includes(id) ? '#5be0ff' : s.config.departures.includes(id) || s.config.heavyDepartures.includes(id) ? '#ffd166' : '#6f8397'; g.fillStyle = use; g.font = 'bold 13px system-ui'; const side = (rw.ends.indexOf(id) === 0 ? 1 : 1) * (ap.closeParallels.some(([x, y]) => (x === id || y === id)) ? (/L$/.test(id) ? -1 : 1) : 0); // close parallels: L labels left of the runway, R labels right
        const back = this.toPx({ x: e.end.x - Math.sin(e.hdg * Math.PI / 180) * 0.16 + Math.cos(e.hdg * Math.PI / 180) * 0.11 * side, y: e.end.y - Math.cos(e.hdg * Math.PI / 180) * 0.16 - Math.sin(e.hdg * Math.PI / 180) * 0.11 * side }); g.textAlign = 'center'; g.fillText(id, back.x, back.y + 5); g.textAlign = 'start';
        if (s.config.departures.includes(id) || s.config.heavyDepartures.includes(id)) { const h = this.toPx({ x: e.thr.x - Math.sin(e.hdg * Math.PI / 180) * 0.06, y: e.thr.y - Math.cos(e.hdg * Math.PI / 180) * 0.06 }); g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); const px = Math.cos(e.hdg * Math.PI / 180) * 0.09 * sc, py = Math.sin(e.hdg * Math.PI / 180) * 0.09 * sc; g.moveTo(h.x - px, h.y - py); g.lineTo(h.x + px, h.y + py); g.stroke(); } }
    }
    for (const i of ap.intersections) { const p = this.toPx(i); g.strokeStyle = '#ff8a5c'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.stroke(); }
    // aircraft: on the ground, or on final inside 7 NM (drawn along the extended centreline with distance)
    for (const a of s.aircraft.values()) {
      if (a.done) continue; const p = this.toPx(a); const sel = this.selected === a.id; const col = a.kind === 'ARR' ? '#5be0ff' : '#ffd166';
      if (a.onGround || a.mode === MODES.QUEUE) {
        if (p.x < -20 || p.y < -20 || p.x > this.w + 20 || p.y > this.h + 20) continue;
        g.fillStyle = col; g.strokeStyle = sel ? '#fff' : col; g.lineWidth = sel ? 2 : 1; g.save(); g.translate(p.x, p.y); g.rotate(a.hdg * Math.PI / 180); g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
        const left = /L$/.test(a.runway ?? '') || (a.kind === 'ARR' && a.runway?.endsWith('L')); g.font = (sel ? 'bold ' : '') + '11px ui-monospace, monospace'; g.fillStyle = sel ? '#fff' : col; g.textAlign = left ? 'end' : 'start'; g.fillText(`${a.callsign} ${a.mode === MODES.QUEUE ? 'RDY' : a.mode === MODES.LUAW ? 'LUAW' : a.mode === MODES.TAKEOFF ? 'ROLL' : 'RLO'}`, p.x + (left ? -9 : 9), p.y + 4); g.textAlign = 'start';
      } else if (a.mode === MODES.FINAL && a.finalDistNm < 7) {
        const q = this.toPx(a); g.strokeStyle = col; g.lineWidth = sel ? 2 : 1; g.beginPath(); g.rect(q.x - 4, q.y - 4, 8, 8); g.stroke(); g.font = '11px ui-monospace, monospace'; g.fillStyle = col; g.fillText(`${a.callsign} ${a.finalDistNm.toFixed(1)}NM ${Math.round(a.alt / 100)}`, q.x + 8, q.y + 4);
      }
    }
    g.fillStyle = '#8fa3b8'; g.font = '11px system-ui'; g.fillText(`arr ${s.config.arrivals.join('/')} · dep ${s.config.departures.join('/')} · heavies ${s.config.heavyDepartures.join('/')}`, 8, this.h - 8);
  }
}
