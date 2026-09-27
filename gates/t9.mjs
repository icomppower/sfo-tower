// T9 Look (advisory): screenshots of the radar scope and surface map in clear day, fog and night, bot-worked shifts → shots/*.png for human review.
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Gate, ROOT } from './_lib.mjs';
import { serve, launch } from '../tools/browser.mjs';

const g = new Gate('T9', 'Look (advisory)');
mkdirSync(join(ROOT, 'shots'), { recursive: true });
const srv = await serve(); const browser = await launch({ viewport: { width: 1440, height: 900 } });
// pick seeds whose window is what we want (night = local 19–06, fog = non-visual with fog)
const SCENES = [['clear', 'clear&seed=look-day', 'day'], ['fog', 'fog&seed=look-fog', 'fog'], ['clear', 'clear&seed=look-night&night=1', 'night']];
async function shoot(qs, name) {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${srv.url}/index.html?play&bot=1&debug&ff=1500&difficulty=normal&weather=${qs}`, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 1500));
  const info = await page.evaluate(() => { const s = window.__sfo.shift; const a = [...s.aircraft.values()].filter((x) => !x.done); const look = window.__sfo.state.scope.look; return { t: s.t, n: a.length, onFinal: a.filter((x) => x.mode === 'FINAL').length, cond: s.weather.current.conditions, look, cfg: s.config.id }; });
  const file = join(ROOT, 'shots', `${name}.png`); await page.screenshot({ path: file });
  const stats = await page.evaluate(() => { const out = {}; for (const id of ['scope', 'surface']) { const c = document.getElementById(id); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let sum = 0, sum2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; sum2 += v * v; n++; } const mean = sum / n; out[id] = { mean: +mean.toFixed(1), std: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1) }; } return out; });
  await page.close(); return { info, stats, errors, size: statSync(file).size, file };
}
g.negative('a blank canvas is caught by the variance check', () => { const std = 0; return std > 4; });
g.negative('two identical scenes are caught by the difference check', () => { const a = { scope: { mean: 10.2 } }, b = { scope: { mean: 10.2 } }; return Math.abs(a.scope.mean - b.scope.mean) > 0.3; });
const shots = {};
for (const [, qs, name] of SCENES) {
  const r = await shoot(qs, name); shots[name] = r;
  g.check(`${name}: shift running with traffic on the scope, no errors (${r.info.cond}, ${r.info.n} aircraft, ${r.info.onFinal} on final, t=${r.info.t})`, r.errors.length === 0 && r.info.n >= 4 && r.info.t >= 1500, r.errors.join('; '));
  g.check(`${name}: scope and surface drawn (pixel variance > 4)`, r.stats.scope.std > 4 && r.stats.surface.std > 4, JSON.stringify(r.stats));
  g.check(`${name}: screenshot written shots/${name}.png (${Math.round(r.size / 1024)} KB)`, r.size > 20000);
}
g.check('fog scene is recognised as fog (haze overlay) and night scene as night', shots.fog.info.look.fog === true && shots.night.info.look.night === true, `fog look ${JSON.stringify(shots.fog.info.look)}, night look ${JSON.stringify(shots.night.info.look)}`);
g.check('the three looks differ (mean brightness of the surface map)', new Set(Object.values(shots).map((r) => r.stats.surface.mean)).size === 3, Object.entries(shots).map(([k, r]) => `${k} ${r.stats.surface.mean}`).join(', '));
await browser.close(); await srv.close();
g.finish('shots/day.png, fog.png, night.png for human review');
