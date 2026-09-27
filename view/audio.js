// Synthesized radio audio (no files, no TTS): readback click + burst, alert two-tone, landing/departure chime. Created lazily inside the Start click.
export class Radio {
  constructor() { this.ctx = null; this.master = null; this.muted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6; this.master.connect(this.ctx.destination); } catch { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.03); }
  noise(dur, gain, hp = 900, bp = 1800) {
    if (!this.ctx) return; const c = this.ctx; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = 1.2; const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  tone(freq, dur, gain = 0.15, type = 'square', when = 0) {
    if (!this.ctx) return; const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.value = freq; const g = c.createGain(); const t0 = c.currentTime + when;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.01); g.gain.setTargetAtTime(0, t0 + dur, 0.03); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.2);
  }
  /** Pilot readback: squelch click, a short garbled burst whose length follows the text, squelch tail. */
  readback(text) { if (!this.ctx) return; this.noise(0.04, 0.5, 900, 2400); const len = Math.min(1.4, 0.25 + text.length * 0.012); this.noise(len, 0.12, 700, 1400); this.tone(160 + (text.length % 7) * 12, len * 0.7, 0.03, 'sawtooth', 0.05); setTimeout(() => this.noise(0.05, 0.4, 900, 2400), len * 1000); }
  unable() { this.tone(330, 0.12, 0.12, 'square'); this.tone(262, 0.16, 0.12, 'square', 0.14); }
  alert() { for (let i = 0; i < 3; i++) { this.tone(880, 0.12, 0.2, 'square', i * 0.28); this.tone(660, 0.12, 0.2, 'square', i * 0.28 + 0.14); } }
  chime() { this.tone(660, 0.09, 0.1, 'sine'); this.tone(990, 0.14, 0.1, 'sine', 0.1); }
  click() { this.noise(0.03, 0.35, 1200, 2600); }
}
