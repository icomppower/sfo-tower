// UI strings, English + Traditional Chinese (D7). Radio readbacks stay in aviation English.
export const STRINGS = {
  en: {
    title: 'SFO Tower', subtitle: 'San Francisco International — realism fork of Tower Control', start: 'Start shift', resume: 'Resume', pause: 'Pause', quit: 'End shift',
    difficulty: 'Difficulty', easy: 'Easy', normal: 'Normal', hard: 'Hard', weather: 'Weather', auto: 'Historical (random hour)', clear: 'Clear', fog: 'Fog', storm: 'Storm (Southeast Plan)',
    seed: 'Seed', assist: 'Conflict assist', on: 'On', off: 'Off', speed: 'Time', duration: 'Shift length', minutes: 'min', language: '中文',
    classic: 'Play the original arcade game', about: 'One airport, real runways (FAA NASR/CIFP), real separation rules (JO 7110.65), real weather (KSFO METAR history). Tap an aircraft, give it a heading, altitude, speed, an approach and a landing clearance; line departures up and launch them between the arrivals crossing 1L/1R.',
    hdg: 'Heading', alt: 'Altitude', spd: 'Speed', apch: 'Approach', land: 'Cleared to land', luaw: 'Line up and wait', takeoff: 'Cleared for takeoff', hold: 'Hold short', ga: 'Go around', direct: 'Direct', resumeSpeed: 'Resume normal speed',
    ils: 'ILS', rnav: 'RNAV', visual: 'Visual', left: 'Left', right: 'Right', cancel: 'Cancel', apply: 'Send', select: 'Tap an aircraft', arrivals: 'Arrivals', departures: 'Departures',
    score: 'Score', landed: 'Landed', departed: 'Departed', losses: 'Separation losses', wake: 'Wake', incursions: 'Runway incursions', crossings: 'Crossing conflicts', goarounds: 'Go-arounds', delay: 'Delay', collision: 'COLLISION — shift over',
    scope: 'Radar', surface: 'Surface', both: 'Both', range: 'Range', atis: 'ATIS', config: 'Runways', cond: 'Conditions', wind: 'Wind', vis: 'Visibility', ceil: 'Ceiling', arrRunways: 'Arr', depRunways: 'Dep',
    shiftOver: 'Shift complete', summary: 'Summary', again: 'New shift', keys: 'Keys: click aircraft · H heading · A altitude · S speed · C approach · L land · U line up · T takeoff · W hold short · G go around · Esc cancel · Space pause · 1/2/4 time',
    readback: 'Readback', alerts: 'Alerts', noAircraft: 'no aircraft selected', unable: 'Unable', typeIn: 'type a value, Enter to send', tcas: 'Conflict predicted', paired: 'Side-by pair', established: 'Established', tutorialTitle: 'How to work the shift',
    tut1: 'Arrivals come in on their STARs. Descend them, turn them onto a 30° intercept of the 28L/28R final, clear the approach, then clear them to land when the runway is free.',
    tut2: 'Departures wait at 1L/1R (heavies at 28L). Line up, then launch only when the next 28 arrival is more than about a minute from its threshold — the 1s cross the 28s.',
    tut3: 'Keep 3 NM or 1,000 ft between aircraft, the wake distances behind heavies (5+ NM), and 2 minutes behind a heavy departure on the same or crossing runway.',
  },
  zh: {
    title: 'SFO 塔台', subtitle: '舊金山國際機場 — Tower Control 擬真分支', start: '開始值班', resume: '繼續', pause: '暫停', quit: '結束值班',
    difficulty: '難度', easy: '簡單', normal: '普通', hard: '困難', weather: '天氣', auto: '歷史天氣（隨機時段）', clear: '晴朗', fog: '大霧', storm: '暴風（東南跑道方案）',
    seed: '種子', assist: '衝突預警', on: '開', off: '關', speed: '時間', duration: '值班長度', minutes: '分鐘', language: 'English',
    classic: '玩原版街機遊戲', about: '單一機場、真實跑道（FAA NASR/CIFP）、真實隔離規則（JO 7110.65）、真實天氣（KSFO METAR 歷史）。點選飛機，下達航向、高度、速度、進場許可與落地許可；把離場排到跑道上，在穿越 1L/1R 的 28 跑道到場之間放行。',
    hdg: '航向', alt: '高度', spd: '速度', apch: '進場', land: '可以落地', luaw: '進跑道等待', takeoff: '可以起飛', hold: '跑道外等待', ga: '重飛', direct: '直飛', resumeSpeed: '恢復正常速度',
    ils: 'ILS', rnav: 'RNAV', visual: '目視', left: '左轉', right: '右轉', cancel: '取消', apply: '發送', select: '點選一架飛機', arrivals: '到場', departures: '離場',
    score: '分數', landed: '落地', departed: '離場', losses: '隔離喪失', wake: '尾流', incursions: '跑道入侵', crossings: '交叉跑道衝突', goarounds: '重飛', delay: '延誤', collision: '相撞 — 值班結束',
    scope: '雷達', surface: '地面', both: '並列', range: '範圍', atis: 'ATIS', config: '跑道', cond: '天氣狀況', wind: '風', vis: '能見度', ceil: '雲底', arrRunways: '到場', depRunways: '離場',
    shiftOver: '值班結束', summary: '總結', again: '再值一班', keys: '快捷鍵：點選飛機 · H 航向 · A 高度 · S 速度 · C 進場 · L 落地 · U 進跑道 · T 起飛 · W 跑道外等待 · G 重飛 · Esc 取消 · 空白鍵 暫停 · 1/2/4 時間',
    readback: '複誦', alerts: '警示', noAircraft: '未選擇飛機', unable: '無法執行', typeIn: '輸入數值後按 Enter', tcas: '預測衝突', paired: '並排進場', established: '已建立', tutorialTitle: '如何值這一班',
    tut1: '到場沿 STAR 進入。先下降，再轉到 28L/28R 五邊 30° 切入航向，發進場許可，跑道淨空時發落地許可。',
    tut2: '離場在 1L/1R 等待（重型機在 28L）。先進跑道等待，只有在下一架 28 跑道到場距門檻超過約一分鐘時才放行——1 跑道會穿越 28 跑道。',
    tut3: '飛機之間保持 3 海里或 1,000 呎，重型機後方保持尾流距離（5 海里以上），同一或交叉跑道上重型機起飛後 2 分鐘。',
  },
};
export let lang = 'en';
try { lang = localStorage.getItem('sfo-lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en'); } catch { /* storage may be blocked */ }
export const t = (k) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
export function setLang(l) { lang = l; try { localStorage.setItem('sfo-lang', l); } catch { /* ignore */ } }
