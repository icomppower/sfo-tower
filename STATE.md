# State

| Gate | Status | Last run | Notes |
|------|--------|----------|-------|
| T0 Data | PASS | 2026-09-27 | Data — 28 raw files checksummed, 26290 METARs, 15 approaches, 44 aircraft types (27 checks, 0 failed) (negatives 4/4) |
| T1 Sim split | — | | |
| T2 Airport geometry | — | | |
| T3 Flight model | — | | |
| T4 Separation rules | — | | |
| T5 SFO runway ops | — | | |
| T6 Weather | — | | |
| T7 Bot shift | — | | |
| T8 UI | — | | |
| T9 Look (advisory) | — | | |

## Current

T0 green (2026-09-26). Next: T1 — build `sim/` (seeded, zero-DOM, fixed-step) with the KSFO model from `data/derived/`, `index.html?classic` redirect, replay hash gate.
