// T1 Sim split: sim/ runs headless in Node; a seeded 60-min shift replays byte-identical twice; the original game works behind ?classic.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Gate, ROOT } from './_lib.mjs';
import { loadData } from '../sim/load-node.js';
import { Shift } from '../sim/shift.js';
import { RNG } from '../sim/rng.js';
import { serve, launch } from '../tools/browser.mjs';

const g = new Gate('T1', 'Sim split');
const data = loadData();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const run = (opts, hook) => { const s = new Shift(data, { seed: 't1', difficulty: 'hard', weather: 'auto', durationMin: 60, ...opts }); hook?.(s); s.step(3600); return { hash: s.hash, events: s.events.length, t: s.t, snap: JSON.stringify(s.snapshot()) }; };

// ---- negatives ----
g.negative('different seed gives a different replay hash', () => run({}).hash === run({ seed: 't1-other' }).hash ? true : false);
g.negative('a Math.random() leak into the RNG is caught', () => {
  const orig = RNG.prototype.next; RNG.prototype.next = function () { return Math.random(); };
  try { return run({}).hash === run({}).hash; } finally { RNG.prototype.next = orig; }
});
g.negative('sim/ importing the DOM is caught', () => { const src = stripComments(readdirSync(join(ROOT, 'sim')).map((f) => readFileSync(join(ROOT, 'sim', f), 'utf8')).join('\n')) + '\ndocument.getElementById("x");'; return !/\b(document|window|navigator|localStorage|requestAnimationFrame)\b/.test(src); });
g.negative('a modified classic file is caught', () => { const orig = execFileSync('git', ['show', '706a5d1:game.js'], { cwd: ROOT }); const mutated = Buffer.concat([orig, Buffer.from('\n// x')]); return createHash('sha256').update(orig).digest('hex') === createHash('sha256').update(mutated).digest('hex'); });

// ---- real checks ----
const a = run({}), b = run({});
g.check('60-min seeded shift replays byte-identical (hash + snapshot)', a.hash === b.hash && a.snap === b.snap && a.t === 3600, `${a.hash} ${a.events} events`);
g.check('different seeds diverge', a.hash !== run({ seed: 'x' }).hash);
const simSrc = stripComments(readdirSync(join(ROOT, 'sim')).filter((f) => f !== 'load-node.js').map((f) => readFileSync(join(ROOT, 'sim', f), 'utf8')).join('\n'));
g.check('sim/ is zero-DOM (no document/window/navigator/localStorage/rAF/Date.now/Math.random)', !/\b(document|window|navigator|localStorage|requestAnimationFrame|Date\.now|Math\.random|performance\.now)\b/.test(simSrc));
g.check('sim runs in the browser too: sim files never import node:', !/from 'node:/.test(simSrc));
for (const f of ['game.js', 'audio.js', 'index.html', 'style.css']) {
  const orig = execFileSync('git', ['show', `706a5d1:${f}`], { cwd: ROOT }); const now = readFileSync(join(ROOT, 'classic', f));
  g.check(`classic/${f} byte-identical to the pinned original`, createHash('sha256').update(orig).digest('hex') === createHash('sha256').update(now).digest('hex'));
}
g.check('index.html redirects ?classic to classic/', /classic\/index\.html/.test(readFileSync(join(ROOT, 'index.html'), 'utf8')));
// classic gameplay headless: ?classic&play&ff=40&autoland → the classic title hook reports state=play with planes and landings
const srv = await serve(); const browser = await launch();
try {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${srv.url}/index.html?classic&play&ff=15&apt=SFO&debug`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2500));
  const url = page.url(), title = await page.title();
  const m = title.match(/s=(\w+) t=([\d.]+) n=(\d+) sc=(-?\d+) apt=(\w+)/);
  g.check('?classic lands on classic/index.html with the original query hooks', url.includes('/classic/index.html') && url.includes('play') && url.includes('ff=15'), url);
  g.check('classic game runs: state=play, time advanced ≥ 10 s, aircraft present, no page errors', !!m && m[1] === 'play' && +m[2] >= 10 && +m[3] >= 1 && errors.length === 0, `${title} errors=${errors.length}`);
} finally { await browser.close(); await srv.close(); }
g.finish(`hash ${a.hash} ×2, ${a.events} events, classic byte-identical + playable`);
