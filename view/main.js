// SFO Tower — view boot, game loop, HUD, command bar, hooks. The sim never touches the DOM; this file does all of it.
import { Shift } from '../sim/shift.js';
import { Bot } from '../sim/bot.js';
import { MODES } from '../sim/aircraft.js';
import { DIFFICULTY } from '../sim/traffic.js';
import { Scope } from './scope.js';
import { Surface } from './surface.js';
import { Radio } from './audio.js';
import { t, lang, setLang } from './i18n.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };

async function loadData() {
  const get = (f) => fetch(`data/derived/${f}`).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  const [airport, procedures, metarMin, traffic, aircraft, capacity] = await Promise.all(['ksfo-airport.json', 'ksfo-procedures.json', 'ksfo-metar.min.json', 'ksfo-traffic.json', 'aircraft.json', 'sfo-capacity.json'].map(get));
  const metar = { ...metarMin, records: metarMin.records.map(([tt, wd, ws, gust, vis, ceil, wx, temp, dew, altim, cat]) => ({ t: tt, wd, ws, gust, vis, ceil, wx: wx ? wx.split(' ') : [], temp, dew, altim, cat, raw: '' })) };
  return { airport, procedures, metar, traffic, aircraft, capacity };
}

const state = { data: null, shift: null, bot: null, scope: null, surface: null, radio: new Radio(), selected: null, timeScale: 1, paused: false, acc: 0, lastFrame: 0, eventIdx: 0, layout: 'both', picker: null, conflicts: [] };

// ---------------- DOM ----------------
function buildDom() {
  const app = $('app'); app.innerHTML = '';
  app.append(
    el('div', { id: 'hud' },
      el('span', { class: 'stat', id: 'clock' }, '00:00'), el('span', { class: 'stat', id: 'scoreStat' }), el('span', { class: 'stat ok', id: 'landedStat' }), el('span', { class: 'stat ok opt', id: 'depStat' }), el('span', { class: 'stat bad', id: 'lossStat' }),
      el('span', { class: 'stat opt', id: 'condStat' }), el('span', { id: 'atis' }), el('span', { class: 'spacer' }),
      el('button', { id: 'btnSpeed1', class: 'active', onclick: () => setTimeScale(1) }, '1×'), el('button', { id: 'btnSpeed2', onclick: () => setTimeScale(2) }, '2×'), el('button', { id: 'btnSpeed4', onclick: () => setTimeScale(4) }, '4×'),
      el('button', { id: 'btnPause', onclick: togglePause }, t('pause')), el('button', { id: 'btnLayout', onclick: cycleLayout }, t('both')), el('button', { id: 'btnMute', onclick: toggleMute }, '🔊')),
    el('div', { id: 'main', class: 'both' },
      el('div', { id: 'scopeWrap' }, el('canvas', { id: 'scope', class: 'view' }), el('span', { class: 'viewLabel' }, t('scope')), el('div', { id: 'rangeBtns' }, ...[15, 30, 45].map((r) => el('button', { onclick: () => setRange(r), 'data-range': r }, r)))),
      el('div', { id: 'surfaceWrap' }, el('canvas', { id: 'surface', class: 'view' }), el('span', { class: 'viewLabel' }, t('surface')))),
    el('div', { id: 'ticker' }),
    el('div', { id: 'cmdbar' }, el('div', { class: 'sel', id: 'selInfo' }, el('span', { class: 'dim' }, t('select'))), el('div', { id: 'cmdRow' }), el('div', { id: 'picker' })),
    el('div', { id: 'menu', class: 'overlay' }),
    el('div', { id: 'end', class: 'overlay hidden' }),
  );
  $('scope').addEventListener('pointerdown', (e) => onPointer(e, state.scope));
  $('surface').addEventListener('pointerdown', (e) => onPointer(e, state.surface));
  $('scope').addEventListener('wheel', (e) => { e.preventDefault(); setRange(Math.max(10, Math.min(60, state.scope.range * (e.deltaY > 0 ? 1.2 : 0.83)))); }, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resizeAll);
}
function menuDom() {
  const m = $('menu'); m.innerHTML = '';
  const opts = { difficulty: qs.get('difficulty') ?? 'normal', weather: qs.get('weather') ?? 'auto', seed: qs.get('seed') ?? String(Math.floor(Math.random() * 90000) + 10000), assist: true, durationMin: +(qs.get('minutes') ?? 60) };
  const seg = (key, values, labels) => { const box = el('div', { class: 'seg' }); for (const v of values) box.append(el('button', { class: opts[key] === v ? 'active' : '', 'data-opt': key, 'data-val': v, onclick: (e) => { opts[key] = v; for (const b of box.children) b.classList.toggle('active', b === e.currentTarget); } }, labels[v])); return box; };
  const seedInput = el('input', { id: 'seedInput', value: opts.seed, oninput: (e) => { opts.seed = e.target.value; } });
  const help = el('div', { class: 'hidden', id: 'helpText' }, el('p', {}, t('about')), el('h2', {}, t('tutorialTitle')), el('p', {}, t('tut1')), el('p', {}, t('tut2')), el('p', {}, t('tut3')), el('p', {}, t('keys')));
  m.append(el('div', { class: 'card' },
    el('h1', {}, '🗼 ' + t('title')), el('p', {}, t('subtitle')),
    el('div', { class: 'actions' }, el('button', { id: 'btnStart', class: 'primary', onclick: () => startShift(opts) }, t('start')), el('button', { id: 'btnLang', onclick: () => { setLang(lang === 'en' ? 'zh' : 'en'); location.reload(); } }, t('language')), el('button', { id: 'btnHelp', onclick: () => help.classList.toggle('hidden') }, '?')),
    el('div', { class: 'row' }, el('label', {}, t('difficulty')), seg('difficulty', ['easy', 'normal', 'hard'], { easy: t('easy'), normal: t('normal'), hard: t('hard') })),
    el('div', { class: 'row' }, el('label', {}, t('weather')), seg('weather', ['auto', 'clear', 'fog', 'storm'], { auto: t('auto'), clear: t('clear'), fog: t('fog'), storm: t('storm') })),
    el('div', { class: 'row' }, el('label', {}, t('assist')), seg('assist', [true, false], { true: t('on'), false: t('off') })),
    el('div', { class: 'row' }, el('label', {}, t('seed')), seedInput, seg('durationMin', [30, 60], { 30: '30 ' + t('minutes'), 60: '60 ' + t('minutes') })),
    help, el('p', {}, el('a', { href: 'classic/index.html' }, t('classic'))),
  ));
  return opts;
}

// ---------------- shift lifecycle ----------------
function startShift(opts) {
  state.radio.init();
  const shift = new Shift(state.data, { seed: opts.seed, difficulty: opts.difficulty, weather: opts.weather, durationMin: opts.durationMin, assist: opts.assist });
  state.shift = shift; state.bot = qs.has('bot') ? new Bot(shift) : null; state.eventIdx = 0; state.selected = null; state.acc = 0; state.paused = false; state.conflicts = [];
  state.scope = new Scope($('scope'), shift, { range: 30, assist: shift.assist }); state.surface = new Surface($('surface'), shift);
  $('menu').classList.add('hidden'); $('end').classList.add('hidden');
  if (qs.has('ff')) { const n = +qs.get('ff') || 60; for (let i = 0; i < n; i++) { state.bot?.tick(); shift.step(1); } }
  resizeAll(); renderCmdBar(); updateHud(); state.lastFrame = performance.now(); requestAnimationFrame(frame);
}
function endShift() {
  const s = state.shift; const sc = s.scoring.summary(); const e = $('end'); e.innerHTML = '';
  const row = (k, v, cls = '') => el('div', { class: 'row' }, el('label', {}, t(k)), el('b', { class: cls }, String(v)));
  e.append(el('div', { class: 'card' }, el('h1', {}, sc.gameOver ? t('collision') : t('shiftOver')), el('h2', {}, t('summary')),
    row('score', sc.score), row('landed', sc.LANDED), row('departed', sc.DEPARTED), row('losses', sc.SEP_LOSS, sc.SEP_LOSS ? 'bad' : ''), row('wake', sc.WAKE), row('incursions', sc.RUNWAY_INCURSION), row('crossings', sc.CROSSING_CONFLICT), row('goarounds', sc.GO_AROUND), row('delay', sc.delayMin + ' ' + t('minutes')),
    el('div', { class: 'actions' }, el('button', { class: 'primary', onclick: () => { $('end').classList.add('hidden'); $('menu').classList.remove('hidden'); } }, t('again')))));
  e.classList.remove('hidden');
}

// ---------------- loop ----------------
function frame(now) {
  const s = state.shift; if (!s) return;
  const dt = Math.min(0.25, (now - state.lastFrame) / 1000); state.lastFrame = now;
  if (!state.paused && !s.finished && !s.gameOver) {
    state.acc += dt * state.timeScale;
    while (state.acc >= 1) { state.acc -= 1; state.bot?.tick(); s.step(1); drainEvents(); }
    if (s.finished || s.gameOver) { drainEvents(); endShift(); }
  }
  computeConflicts();
  const localHour = Math.floor(((s.weather.t0 + s.t) / 3600 - 8) % 24 + 24) % 24; const look = { night: qs.has('night') || localHour >= 19 || localHour < 6, fog: s.weather.current.conditions !== 'VISUAL' && s.weather.current.fog, localHour: String(localHour).padStart(2, '0') + ':00' };
  state.scope.look = look; state.surface.look = look;
  state.scope.selected = state.selected; state.surface.selected = state.selected;
  state.scope.draw(state.paused ? 0 : state.acc, state.conflicts); state.surface.draw(state.paused ? 0 : state.acc);
  updateHud(); if (state.selected && !s.aircraft.get(state.selected)) { state.selected = null; renderCmdBar(); }
  if (state.selected) refreshSelInfo();
  requestAnimationFrame(frame);
}
function drainEvents() {
  const s = state.shift; const tick = $('ticker');
  for (const e of s.events.slice(state.eventIdx)) {
    if (e.type === 'COMMAND') { const a = s.aircraft.get(e.ac); if (a?.lastReadback) { tick.innerHTML = `<span class="rb">${a.lastReadback}</span>`; state.radio.readback(a.lastReadback); } }
    else if (['SEP_LOSS', 'WAKE', 'RUNWAY_INCURSION', 'CROSSING_CONFLICT', 'COLLISION'].includes(e.type)) { const a = s.aircraft.get(e.ac), b = s.aircraft.get(e.other); tick.innerHTML = `<span class="alert">${e.type.replace('_', ' ')}: ${a?.callsign ?? ''} ${b ? '/ ' + b.callsign : ''} ${e.nm != null ? e.nm + ' NM (' + e.reqNm + ' req)' : ''} ${e.how ?? ''}</span>`; state.radio.alert(); }
    else if (e.type === 'LANDED' || e.type === 'DEPARTED') state.radio.chime();
    else if (e.type === 'GO_AROUND') { const a = s.aircraft.get(e.ac); tick.innerHTML = `<span class="alert">${a?.callsign ?? ''} going around — ${e.reason}</span>`; }
  }
  state.eventIdx = s.events.length;
}
/** conflict prediction (assist): pairs predicted within 3 NM / 1,000 ft in the next 60 s, and current losses */
function computeConflicts() {
  const s = state.shift; const out = []; if (!s.assist) { state.conflicts = out; return; }
  const acs = [...s.aircraft.values()].filter((a) => !a.done && !a.onGround && a.mode !== MODES.QUEUE);
  for (let i = 0; i < acs.length; i++) for (let j = i + 1; j < acs.length; j++) {
    const a = acs[i], b = acs[j]; if (Math.abs(a.alt - b.alt) > 1500) continue;
    const va = { x: Math.sin(a.hdg * Math.PI / 180) * a.gs / 3600, y: Math.cos(a.hdg * Math.PI / 180) * a.gs / 3600 }, vb = { x: Math.sin(b.hdg * Math.PI / 180) * b.gs / 3600, y: Math.cos(b.hdg * Math.PI / 180) * b.gs / 3600 };
    const dx = b.x - a.x, dy = b.y - a.y, dvx = vb.x - va.x, dvy = vb.y - va.y; const v2 = dvx * dvx + dvy * dvy; let tc = v2 > 1e-9 ? -(dx * dvx + dy * dvy) / v2 : 0; tc = Math.max(0, Math.min(60, tc));
    const dmin = Math.hypot(dx + dvx * tc, dy + dvy * tc), dnow = Math.hypot(dx, dy);
    const bothFinal = a.mode === MODES.FINAL && b.mode === MODES.FINAL && s.airport.sameOrCloseParallel(a.runway, b.runway) && s.weather.current.visualOK;
    if (dnow < 3 && Math.abs(a.alt - b.alt) < 950 && !bothFinal) out.push([a, b, 'loss']); else if (dmin < 3 && !bothFinal && Math.abs(a.alt - b.alt) < 950) out.push([a, b, 'predict']);
  }
  state.conflicts = out;
}

// ---------------- HUD / controls ----------------
function fmtClock(sec) { const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function updateHud() {
  const s = state.shift; if (!s) return; const sc = s.scoring.summary();
  $('clock').textContent = fmtClock(s.t); $('scoreStat').innerHTML = `${t('score')} <b>${sc.score}</b>`; $('landedStat').innerHTML = `${t('landed')} <b>${sc.LANDED}</b>`; $('depStat').innerHTML = `${t('departed')} <b>${sc.DEPARTED}</b>`;
  const losses = sc.SEP_LOSS + sc.WAKE + sc.RUNWAY_INCURSION + sc.CROSSING_CONFLICT; $('lossStat').innerHTML = `${t('losses')} <b>${losses}</b>`; $('lossStat').classList.toggle('bad', losses > 0);
  $('condStat').innerHTML = `<b>${s.weather.current.conditions}</b> ${s.config.id}`; $('atis').textContent = s.weather.atis();
}
function setTimeScale(x) { state.timeScale = x; for (const v of [1, 2, 4]) $('btnSpeed' + v).classList.toggle('active', v === x); }
function togglePause() { state.paused = !state.paused; $('btnPause').textContent = state.paused ? t('resume') : t('pause'); }
function toggleMute() { state.radio.setMuted(!state.radio.muted); $('btnMute').textContent = state.radio.muted ? '🔇' : '🔊'; }
function cycleLayout() { const order = ['both', 'scope', 'surface']; state.layout = order[(order.indexOf(state.layout) + 1) % 3]; applyLayout(); }
function applyLayout() { const m = $('main'); m.className = state.layout; $('scopeWrap').classList.toggle('hidden', state.layout === 'surface'); $('surfaceWrap').classList.toggle('hidden', state.layout === 'scope'); $('btnLayout').textContent = t(state.layout); resizeAll(); }
function setRange(r) { state.scope.range = r; for (const b of $('rangeBtns').children) b.classList.toggle('active', +b.dataset.range === r); }
function resizeAll() { state.scope?.resize(); state.surface?.resize(); }
function onPointer(e, view) { if (!state.shift) return; const r = e.currentTarget.getBoundingClientRect(); const a = view.hit(e.clientX - r.left, e.clientY - r.top); if (a) { state.selected = a.id; state.picker = null; renderCmdBar(); state.radio.click(); } }
function selectedAc() { return state.selected ? state.shift.aircraft.get(state.selected) : null; }
function refreshSelInfo() { const a = selectedAc(); if (!a) return; const info = $('selInfo'); const mode = a.onGround ? a.mode : `${a.mode}${a.mode === MODES.FINAL ? ' ' + a.finalDistNm.toFixed(1) + ' NM' : ''}`; info.innerHTML = `<b>${a.callsign}</b> <span>${a.type}/${a.cwt} ${a.kind === 'ARR' ? t('arrivals') : t('departures')} ${a.runway ?? ''}</span> <span class="dim">${mode} · ${Math.round(a.alt)} ft → ${a.tgt.alt} · ${Math.round(a.ias)} kt · hdg ${Math.round(a.hdg)}°</span>`; }

function renderCmdBar() {
  const a = selectedAc(); const row = $('cmdRow'); row.innerHTML = ''; $('picker').classList.remove('open'); $('picker').innerHTML = '';
  if (!a) { $('selInfo').innerHTML = `<span class="dim">${t('select')}</span>`; return; }
  refreshSelInfo();
  const btn = (key, label, fn, cls = '') => row.append(el('button', { 'data-cmd': key, class: cls, onclick: fn }, label));
  const air = !a.onGround && a.mode !== MODES.TAKEOFF;
  if (air) { btn('heading', t('hdg'), () => openPicker('heading')); btn('altitude', t('alt'), () => openPicker('altitude')); btn('speed', t('spd'), () => openPicker('speed')); }
  if (a.kind === 'ARR' && air) { btn('approach', t('apch'), () => openPicker('approach')); btn('land', t('land'), () => send({ type: 'land', runway: a.runway }), 'primary'); btn('goaround', t('ga'), () => send({ type: 'goaround' })); }
  if (a.kind === 'DEP' && (a.mode === MODES.QUEUE || a.mode === MODES.LUAW)) { btn('luaw', t('luaw'), () => send({ type: 'luaw' })); btn('takeoff', t('takeoff'), () => send({ type: 'takeoff' }), 'primary'); btn('holdshort', t('hold'), () => send({ type: 'holdshort' })); }
}
function openPicker(kind) {
  const a = selectedAc(); if (!a) return; const p = $('picker'); p.innerHTML = ''; p.classList.add('open'); state.picker = kind;
  const b = (label, fn, cls = '') => p.append(el('button', { class: cls, 'data-pick': label, onclick: fn }, label));
  if (kind === 'heading') { for (const d of [-30, -10, 10, 30]) b((d > 0 ? '+' : '') + d + '°', () => send({ type: 'heading', hdg: ((Math.round(a.hdg) + d) % 360 + 360) % 360, turn: d < 0 ? 'L' : 'R' })); const inp = el('input', { type: 'number', min: 1, max: 360, placeholder: t('hdg'), 'data-pick': 'input' }); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send({ type: 'heading', hdg: +inp.value }); }); p.append(inp); b(t('apply'), () => send({ type: 'heading', hdg: +inp.value })); }
  if (kind === 'altitude') { for (const alt of [3000, 4000, 5000, 6000, 7000, 8000, 10000]) b((alt / 1000) + 'k', () => send({ type: 'altitude', alt }), a.tgt.alt === alt ? 'active' : ''); }
  if (kind === 'speed') { for (const v of [160, 170, 180, 190, 210, 250]) if (v >= a.perf.vApp && v <= a.perf.vMax) b(v + ' kt', () => send({ type: 'speed', ias: v })); b(t('resumeSpeed'), () => send({ type: 'speed', ias: null })); }
  if (kind === 'approach') { const s = state.shift; for (const rwy of s.config.arrivals) { const e = s.airport.ends[rwy]; if (e.ils) b(`${t('ils')} ${rwy}`, () => send({ type: 'approach', runway: rwy, kind: 'ILS' })); else b(`${t('rnav')} ${rwy}`, () => send({ type: 'approach', runway: rwy, kind: 'RNAV' })); if (s.weather.current.visualOK) b(`${t('visual')} ${rwy}`, () => send({ type: 'approach', runway: rwy, kind: 'VISUAL' })); } }
  b(t('cancel'), () => { p.classList.remove('open'); p.innerHTML = ''; state.picker = null; });
}
function send(cmd) {
  const a = selectedAc(); if (!a) return null; const r = state.shift.command(a.id, cmd);
  if (!r.ok) { $('ticker').innerHTML = `<span class="alert">${t('unable')}: ${r.readback}</span>`; state.radio.unable(); } else drainEvents();
  $('picker').classList.remove('open'); $('picker').innerHTML = ''; state.picker = null; renderCmdBar(); return r;
}
function onKey(e) {
  if (!state.shift || e.target.tagName === 'INPUT') return; const a = selectedAc(); const k = e.key.toLowerCase();
  if (k === ' ') { togglePause(); e.preventDefault(); return; } if (k === '1' || k === '2' || k === '4') return setTimeScale(+k); if (k === 'escape') { state.selected = null; renderCmdBar(); return; }
  if (!a) return;
  const map = { h: () => openPicker('heading'), a: () => openPicker('altitude'), s: () => openPicker('speed'), c: () => openPicker('approach'), l: () => send({ type: 'land', runway: a.runway }), g: () => send({ type: 'goaround' }), u: () => send({ type: 'luaw' }), t: () => send({ type: 'takeoff' }), w: () => send({ type: 'holdshort' }) };
  if (map[k]) { map[k](); e.preventDefault(); }
}

// ---------------- boot ----------------
(async function boot() {
  buildDom();
  try { state.data = await loadData(); } catch (err) { $('menu').innerHTML = `<div class="card"><h1>SFO Tower</h1><p>Data failed to load: ${err.message}</p></div>`; return; }
  const opts = menuDom();
  if (qs.has('debug') || qs.has('play')) window.__sfo = { state, send, select: (id) => { state.selected = id; renderCmdBar(); }, openPicker, renderCmdBar, MODES, get shift() { return state.shift; } };
  if (qs.has('play')) startShift(opts);
})();
