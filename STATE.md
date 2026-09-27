# State

| Gate | Status | Last run | Notes |
|------|--------|----------|-------|
| T0 Data | PASS | 2026-09-27 | Data — 28 raw files checksummed, 26290 METARs, 15 approaches, 44 aircraft types (27 checks, 0 failed) (negatives 4/4) |
| T1 Sim split | PASS | 2026-09-27 | Sim split — hash 9115c045 ×2, 284 events, classic byte-identical + playable (11 checks, 0 failed) (negatives 4/4) |
| T2 Airport geometry | — | | |
| T3 Flight model | — | | |
| T4 Separation rules | — | | |
| T5 SFO runway ops | — | | |
| T6 Weather | — | | |
| T7 Bot shift | — | | |
| T8 UI | — | | |
| T9 Look (advisory) | — | | |

## Current

T0–T1 green (2026-09-26). `sim/` = rng, geo, airport, procedures, perf, aircraft, commands, weather, traffic, rules, scoring, shift, bot. Next: T2 geometry gate, then T3–T7 with the bot as the oracle.
