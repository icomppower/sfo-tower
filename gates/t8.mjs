// T8 UI: layout at 390×844, 844×390 and 1440×900 — no page scroll, every control inside the viewport and hit-testable (elementFromPoint),
// no overlapping controls, ≥ 40 px touch targets, and every command reachable by real clicks that change the sim. Negatives inject broken CSS.
import { Gate } from './_lib.mjs';
import { serve, launch } from '../tools/browser.mjs';

const g = new Gate('T8', 'UI');
const VIEWPORTS = [[390, 844, 'phone portrait'], [844, 390, 'phone landscape'], [1440, 900, 'desktop']];
const srv = await serve(); const browser = await launch();

async function audit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const menu = document.getElementById('menu'); const menuOpen = menu && !menu.classList.contains('hidden');
    const controls = [...document.querySelectorAll(menuOpen ? '#menu button, #menu input' : 'button, input')].filter(vis); // while the menu overlay is open only its own controls must be reachable
    const rects = controls.map((e) => ({ id: e.id || e.dataset.cmd || e.dataset.pick || e.dataset.range || e.textContent.trim().slice(0, 12), r: e.getBoundingClientRect(), e }));
    const inside = rects.filter((x) => x.r.left >= -0.5 && x.r.top >= -0.5 && x.r.right <= vw + 0.5 && x.r.bottom <= vh + 0.5).length;
    const outside = rects.filter((x) => !(x.r.left >= -0.5 && x.r.top >= -0.5 && x.r.right <= vw + 0.5 && x.r.bottom <= vh + 0.5)).map((x) => x.id);
    const unreachable = rects.filter((x) => { const cx = (x.r.left + x.r.right) / 2, cy = (x.r.top + x.r.bottom) / 2; const hit = document.elementFromPoint(cx, cy); return !(hit === x.e || x.e.contains(hit)); }).map((x) => x.id);
    const small = rects.filter((x) => x.r.width < 40 || x.r.height < 32).map((x) => `${x.id}(${Math.round(x.r.width)}×${Math.round(x.r.height)})`);
    const overlaps = []; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i].r, b = rects[j].r; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 1 && iy > 1) overlaps.push(rects[i].id + '×' + rects[j].id); }
    const canvases = [...document.querySelectorAll('canvas.view')].filter(vis).map((c) => c.getBoundingClientRect());
    const bar = document.getElementById('cmdbar')?.getBoundingClientRect();
    const canvasOverlap = bar ? canvases.some((c) => Math.min(c.bottom, bar.bottom) - Math.max(c.top, bar.top) > 1) : false;
    return { vw, vh, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, n: rects.length, inside, outside, unreachable, small, overlaps, canvasOverlap, canvases: canvases.length };
  });
}
const cmdButtons = (page) => page.evaluate(() => [...document.querySelectorAll('#cmdRow button')].map((b) => b.dataset.cmd));
const clickCmd = async (page, sel) => { const h = await page.$(sel); if (!h) return false; const box = await h.boundingBox(); if (!box) return false; await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); return true; };

async function runViewport([w, h, name], negativeCss = null) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${srv.url}/index.html?seed=t8&difficulty=normal&weather=clear&debug`, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 1200));
  const menu = await audit(page);
  await clickCmd(page, '#btnStart'); await new Promise((r) => setTimeout(r, 700));
  const started = await page.evaluate(() => !!window.__sfo?.shift);
  if (!started) { await page.close(); throw new Error('Start click did not start the shift'); }
  await page.evaluate(() => { const s = window.__sfo.shift; for (let i = 0; i < 90; i++) s.step(1); });
  if (negativeCss === 'COVER') await page.evaluate(() => { const bar = document.getElementById('cmdbar'); bar.style.position = 'relative'; const d = document.createElement('div'); d.id = 'cover'; d.style.cssText = 'position:absolute;inset:0;z-index:5;background:transparent'; bar.append(d); });
  else if (negativeCss) { await page.addStyleTag({ content: negativeCss }); await new Promise((r) => setTimeout(r, 200)); }
  const play = await audit(page);
  // arrival: select via hook, click Heading, click +10° → target heading changes
  const arrRes = await page.evaluate(() => { const s = window.__sfo.shift; const a = [...s.aircraft.values()].find((x) => x.kind === 'ARR' && !x.onGround && !x.done); window.__sfo.select(a.id); return { id: a.id, hdg: a.tgt.hdg }; });
  const arrBtns = await cmdButtons(page);
  await clickCmd(page, '#cmdRow button[data-cmd="heading"]'); await new Promise((r) => setTimeout(r, 200));
  const picker = await audit(page);
  await clickCmd(page, '#picker button[data-pick="+10°"]'); await new Promise((r) => setTimeout(r, 200));
  const arrAfter = await page.evaluate((id) => { const a = window.__sfo.shift.aircraft.get(id); return { hdg: a.tgt.hdg, assigned: a.tgt.hdgAssigned, mode: a.mode }; }, arrRes.id);
  await clickCmd(page, '#cmdRow button[data-cmd="altitude"]'); await clickCmd(page, '#picker button[data-pick="6k"]');
  const altAfter = await page.evaluate((id) => window.__sfo.shift.aircraft.get(id).tgt.alt, arrRes.id);
  for (const c of ['speed', 'approach']) { await clickCmd(page, `#cmdRow button[data-cmd="${c}"]`); await new Promise((r) => setTimeout(r, 100)); }
  const apchPick = await page.evaluate(() => [...document.querySelectorAll('#picker button')].map((b) => b.dataset.pick));
  await clickCmd(page, '#picker button'); // first approach option
  const apchAfter = await page.evaluate((id) => { const a = window.__sfo.shift.aircraft.get(id); return { cleared: a.clearedApproach, mode: a.mode }; }, arrRes.id);
  // departure: select, click line up → LUAW
  const depRes = await page.evaluate(() => { const s = window.__sfo.shift; const d = [...s.aircraft.values()].find((x) => x.kind === 'DEP' && x.mode === 'QUEUE'); if (!d) return null; window.__sfo.select(d.id); return d.id; });
  const depBtns = depRes ? await cmdButtons(page) : [];
  if (depRes) await clickCmd(page, '#cmdRow button[data-cmd="luaw"]');
  const depAfter = depRes ? await page.evaluate((id) => window.__sfo.shift.aircraft.get(id).mode, depRes) : 'none';
  const hudClicks = await page.evaluate(async () => { const before = window.__sfo.state.timeScale; document.getElementById('btnSpeed4').click(); const ts = window.__sfo.state.timeScale; document.getElementById('btnSpeed1').click(); document.getElementById('btnPause').click(); const paused = window.__sfo.state.paused; document.getElementById('btnPause').click(); return { before, ts, paused }; });
  await page.close();
  return { name, errors, menu, play, picker, arrBtns, arrRes, arrAfter, altAfter, apchPick, apchAfter, depBtns, depAfter, hudClicks };
}
const layoutOk = (a) => a.scrollW <= a.vw + 1 && a.scrollH <= a.vh + 1 && a.outside.length === 0 && a.unreachable.length === 0 && a.overlaps.length === 0 && !a.canvasOverlap;
const descr = (a) => `${a.n} controls, outside ${a.outside.join(',') || '-'}, unreachable ${a.unreachable.join(',') || '-'}, overlaps ${a.overlaps.join(',') || '-'}, scroll ${a.scrollW}×${a.scrollH} in ${a.vw}×${a.vh}${a.canvasOverlap ? ', cmdbar over canvas' : ''}`;

// ---- negatives (desktop) ----
await g.negativeAsync('a command bar overlapping the radar canvas is caught', async () => { const r = await runViewport([1440, 900, 'neg'], '#cmdbar{position:absolute;bottom:200px;left:0;right:0}'); return layoutOk(r.play); });
await g.negativeAsync('controls pushed off-screen (giant HUD font) are caught', async () => { const r = await runViewport([390, 844, 'neg'], '#hud button{min-width:220px}#hud{flex-wrap:nowrap}'); return layoutOk(r.play); });
await g.negativeAsync('command buttons covered by another layer are caught by the hit-test', async () => { const r = await runViewport([1440, 900, 'neg'], 'COVER'); return r.picker.unreachable.length === 0; });
await g.negativeAsync('an overlay that blocks the picker is caught', async () => { const r = await runViewport([1440, 900, 'neg'], '#picker{position:relative}#picker::after{content:"";position:absolute;inset:0;z-index:5}'); return r.picker.unreachable.length === 0; });

// ---- real ----
for (const vp of VIEWPORTS) {
  const r = await runViewport(vp);
  g.check(`${r.name}: no page errors`, r.errors.length === 0, r.errors.join('; '));
  g.check(`${r.name}: menu layout — start/lang/options inside, reachable, no overlaps, no scroll`, layoutOk(r.menu), descr(r.menu));
  g.check(`${r.name}: play layout — HUD, range, command buttons inside, reachable, no overlaps, cmd bar clear of canvases`, layoutOk(r.play) && r.play.canvases >= 1, descr(r.play));
  g.check(`${r.name}: touch targets ≥ 40×32 px`, r.play.small.length === 0 && r.picker.small.length === 0, [...r.play.small, ...r.picker.small].join(',') || '-');
  g.check(`${r.name}: arrival commands present [heading altitude speed approach land goaround]`, ['heading', 'altitude', 'speed', 'approach', 'land', 'goaround'].every((c) => r.arrBtns.includes(c)), r.arrBtns.join(','));
  g.check(`${r.name}: heading picker reachable and a real click changes the target heading (+10°)`, layoutOk(r.picker) && r.arrAfter.assigned && Math.abs(((r.arrAfter.hdg - r.arrRes.hdg) % 360 + 360) % 360 - 10) < 6, `${r.arrRes.hdg}→${r.arrAfter.hdg} ${descr(r.picker)}`);
  g.check(`${r.name}: altitude 6k by click, approach clearance by click`, r.altAfter === 6000 && r.apchAfter.cleared && r.apchAfter.mode === 'APPROACH', `alt ${r.altAfter}, ${JSON.stringify(r.apchAfter)}, options ${r.apchPick.join('|')}`);
  g.check(`${r.name}: departure commands [luaw takeoff holdshort] and line-up by click`, ['luaw', 'takeoff', 'holdshort'].every((c) => r.depBtns.includes(c)) && r.depAfter === 'LUAW', `${r.depBtns.join(',')} → ${r.depAfter}`);
  g.check(`${r.name}: HUD time-scale and pause buttons work`, r.hudClicks.ts === 4 && r.hudClicks.paused === true, JSON.stringify(r.hudClicks));
}
await browser.close(); await srv.close();
g.finish('3 viewports × layout / reachability / real-click commands');
