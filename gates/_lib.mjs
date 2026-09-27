// Shared gate helpers. A gate runs its negative fixtures first (each MUST fail), prints `NEGATIVE n/n`,
// then the real checks, and exits 0 only if everything passed. verify.sh requires the NEGATIVE line.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const readJSON = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

export class Gate {
  constructor(id, title) { this.id = id; this.title = title; this.fails = []; this.checks = 0; this.neg = []; }
  /** A real check: `ok` must be truthy. */
  check(name, ok, detail = '') { this.checks++; const line = `${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`; console.log('  ' + line); if (!ok) this.fails.push(line); return !!ok; }
  /** A negative fixture: `fn` must return false / throw (the mutated input must be caught). */
  negative(name, fn) {
    let caught = false, err = '';
    try { caught = fn() === false; } catch (e) { caught = true; err = e.message; }
    this.neg.push(caught); console.log(`  neg ${caught ? 'caught ' : 'MISSED '} ${name}${err ? ' (' + err.slice(0, 80) + ')' : ''}`);
    return caught;
  }
  async negativeAsync(name, fn) {
    let caught = false, err = '';
    try { caught = (await fn()) === false; } catch (e) { caught = true; err = e.message; }
    this.neg.push(caught); console.log(`  neg ${caught ? 'caught ' : 'MISSED '} ${name}${err ? ' (' + err.slice(0, 80) + ')' : ''}`);
    return caught;
  }
  finish(summary = '') {
    const nc = this.neg.filter(Boolean).length;
    console.log(`NEGATIVE ${nc}/${this.neg.length}`);
    const pass = nc === this.neg.length && this.neg.length > 0 && this.fails.length === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${this.id} ${this.title}${summary ? ' — ' + summary : ''} (${this.checks} checks, ${this.fails.length} failed)`);
    process.exit(pass ? 0 : 1);
  }
}
export const approx = (a, b, tol) => Math.abs(a - b) <= tol;
export const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); };
