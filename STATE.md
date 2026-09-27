# State

| Gate | Status | Last run | Notes |
|------|--------|----------|-------|
| T0 Data | PASS | 2026-09-27 | Data — 32 raw files checksummed, 26290 METARs, 15 approaches, 44 aircraft types (27 checks, 0 failed) (negatives 4/4) |
| T1 Sim split | PASS | 2026-09-27 | Sim split — hash fd412c17 ×2, 205 events, classic byte-identical + playable (11 checks, 0 failed) (negatives 4/4) |
| T2 Airport geometry | PASS | 2026-09-27 | Airport geometry — thr 0.000 m, hdg 0.00°, OurAirports 1.9 m, CIFP 0.16 m (10 checks, 0 failed) (negatives 4/4) |
| T3 Flight model | PASS | 2026-09-27 | Flight model — 10 types × approach speed / glideslope / TCH / turns / climb (61 checks, 0 failed) (negatives 6/6) |
| T4 Separation rules | PASS | 2026-09-27 | Separation rules — 38 scenarios (legal + illegal), radar / wake / same-runway / crossing / collision (38 checks, 0 failed) (negatives 5/5) |
| T5 SFO runway ops | PASS | 2026-09-27 | SFO runway ops — 18 crossing / occupancy scenarios + bot shift (20 checks, 0 failed) (negatives 3/3) |
| T6 Weather | PASS | 2026-09-27 | Weather — VISUAL 73 ops/h (31 arr), INSTRUMENT 64 ops/h (24 arr) (25 checks, 0 failed) (negatives 3/3) |
| T7 Bot shift | PASS | 2026-09-27 | Bot shift — easy ×9 clean, normal ×3 bounded, hard ×3 measurable losses (13 checks, 0 failed) (negatives 3/3) |
| T8 UI | PASS | 2026-09-27 | UI — 3 viewports × layout / reachability / real-click commands (27 checks, 0 failed) (negatives 4/4) |
| T9 Look (advisory) | — | | |

## Current

T0–T7 green (2026-09-26) once the full ladder run below confirms. Bot = landing-slot sequencer (sim/bot.js). Next: T8 UI (radar scope + surface map + command menu, zh/en, 390×844 / 844×390 / 1440×900), then T9 look, deploy, Notion status page.
