// Local tangent-plane geometry. Horizontal unit = nautical mile, x east, y north; headings true, degrees, clockwise from north.
export const NM_M = 1852, FT_NM = 1 / 6076.1155, NM_FT = 6076.1155;
export const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
export const wrap360 = (d) => ((d % 360) + 360) % 360;
/** signed a-b in (-180, 180] */
export const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d === -180 ? 180 : d; };
export const hdgVec = (h) => ({ x: Math.sin(rad(h)), y: Math.cos(rad(h)) });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const bearingTo = (a, b) => wrap360(deg(Math.atan2(b.x - a.x, b.y - a.y)));
/** position ahead of p along heading h by d NM */
export const advance = (p, h, d) => ({ x: p.x + Math.sin(rad(h)) * d, y: p.y + Math.cos(rad(h)) * d });
/** cross-track (+ right of course) and along-track (+ ahead) distance of point b relative to a course line through p with heading h */
export function trackOffsets(p, h, b) {
  const dx = b.x - p.x, dy = b.y - p.y, s = Math.sin(rad(h)), c = Math.cos(rad(h));
  return { cross: dx * c - dy * s, along: dx * s + dy * c };
}
export function segmentIntersection(a1, a2, b1, b2) {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y), t, u };
}
export class Projection {
  constructor(lat0, lon0) { this.lat0 = lat0; this.lon0 = lon0; this.k = Math.cos(rad(lat0)); }
  toXY(lat, lon) { return { x: (lon - this.lon0) * this.k * 60, y: (lat - this.lat0) * 60 }; }
  toLatLon(x, y) { return { lat: this.lat0 + y / 60, lon: this.lon0 + x / (60 * this.k) }; }
}
