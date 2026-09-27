# State

| Gate | Status | Last run | Notes |
|------|--------|----------|-------|
| T0 Data | PASS | 2026-09-27 | Data — 32 raw files checksummed, 26290 METARs, 15 approaches, 44 aircraft types (27 checks, 0 failed) (negatives 4/4) |
| T1 Sim split | PASS | 2026-09-27 | Sim split — hash 9115c045 ×2, 284 events, classic byte-identical + playable (11 checks, 0 failed) (negatives 4/4) |
| T2 Airport geometry | PASS | 2026-09-27 | Airport geometry — thr 0.000 m, hdg 0.00°, OurAirports 1.9 m, CIFP 0.16 m (10 checks, 0 failed) (negatives 4/4) |
| T3 Flight model | PASS | 2026-09-27 | Flight model — 10 types × approach speed / glideslope / TCH / turns / climb (61 checks, 0 failed) (negatives 6/6) |
| T4 Separation rules | PASS | 2026-09-27 | Separation rules — 38 scenarios (legal + illegal), radar / wake / same-runway / crossing / collision (38 checks, 0 failed) (negatives 5/5) |
| T5 SFO runway ops | — | | |
| T6 Weather | — | | |
| T7 Bot shift | — | | |
| T8 UI | — | | |
| T9 Look (advisory) | — | | |

## Current

T0–T4 green (2026-09-26). Bot (sim/bot.js, fix-stack release flow) clean under light traffic, loses separation above ~20 arrivals/h — being fixed for T6/T7. Next: T5 crossing-runway gate.
