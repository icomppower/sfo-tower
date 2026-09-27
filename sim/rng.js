// Seeded deterministic PRNG (sfc32) — the only randomness source in sim/.
export function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
export class RNG {
  constructor(seed) {
    const h = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
    this.a = h ^ 0x9E3779B9; this.b = (h * 0x85EBCA6B) >>> 0; this.c = (h ^ 0xC2B2AE35) >>> 0; this.d = 1;
    for (let i = 0; i < 12; i++) this.next();
  }
  next() { // sfc32, returns [0,1)
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0; this.a = this.b ^ (this.b >>> 9); this.b = (this.c + (this.c << 3)) | 0; this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0; t = (t + this.d) | 0; this.c = (this.c + t) | 0; return (t >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); } // inclusive
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(entries) { // [[value, weight], ...]
    let total = 0; for (const [, w] of entries) total += w; let r = this.next() * total;
    for (const [v, w] of entries) { r -= w; if (r <= 0) return v; } return entries[entries.length - 1][0];
  }
  exp(mean) { return -Math.log(1 - this.next()) * mean; }
  fork(label) { return new RNG(hashString(label + ':' + Math.floor(this.next() * 4294967296))); }
}
