// D5: realism scoring — collision ends the shift; everything else is scored and logged.
export const PENALTY = { SEP_LOSS: 200, WAKE: 150, RUNWAY_INCURSION: 300, CROSSING_CONFLICT: 300, GO_AROUND: 40, LOST: 250 };
export const REWARD = { LANDED: 100, DEPARTED: 60 };
export class Scoring {
  constructor() { this.score = 0; this.tally = { LANDED: 0, DEPARTED: 0, GO_AROUND: 0, SEP_LOSS: 0, WAKE: 0, RUNWAY_INCURSION: 0, CROSSING_CONFLICT: 0, COLLISION: 0, LOST: 0 }; this.delayS = 0; this.gameOver = false; this.log = []; }
  apply(events, shift) {
    for (const e of events) {
      if (e.type in this.tally) this.tally[e.type]++;
      if (e.type in REWARD) this.score += REWARD[e.type];
      if (e.type in PENALTY) { this.score -= PENALTY[e.type]; this.log.push(e); }
      if (e.type === 'GO_AROUND' && e.commanded) this.score += PENALTY.GO_AROUND / 2; // a commanded go-around that prevents a loss is half price
      if (e.type === 'COLLISION') { this.gameOver = true; this.log.push(e); }
    }
    // delay: arrivals holding in the airspace longer than a nominal 14 min, departures waiting > 3 min once ready
    for (const a of shift.aircraft.values()) {
      if (a.done) continue;
      if (a.kind === 'ARR' && shift.t - a.spawnedAt > 14 * 60 && !a.onGround) this.delayS += 1;
      if (a.kind === 'DEP' && a.mode === 'QUEUE' && shift.t - a.readyAt > 180) this.delayS += 1;
    }
  }
  get delayMin() { return Math.round(this.delayS / 60); }
  summary() { return { score: this.score - this.delayMin * 5, ...this.tally, delayMin: this.delayMin, gameOver: this.gameOver }; }
}
