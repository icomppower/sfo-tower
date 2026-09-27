# State

| Gate | Status | Last run | Notes |
|------|--------|----------|-------|
| T0 Data | PASS | 2026-09-27 | Data — 32 raw files checksummed, 26290 METARs, 15 approaches, 44 aircraft types (27 checks, 0 failed) (negatives 4/4) |
| T1 Sim split | PASS | 2026-09-27 | Sim split — hash 5cd3dede ×2, 135 events, classic byte-identical + playable (11 checks, 0 failed) (negatives 4/4) |
| T2 Airport geometry | PASS | 2026-09-27 | Airport geometry — thr 0.000 m, hdg 0.00°, OurAirports 1.9 m, CIFP 0.16 m (10 checks, 0 failed) (negatives 4/4) |
| T3 Flight model | PASS | 2026-09-27 | Flight model — 10 types × approach speed / glideslope / TCH / turns / climb (61 checks, 0 failed) (negatives 6/6) |
| T4 Separation rules | PASS | 2026-09-27 | Separation rules — 38 scenarios (legal + illegal), radar / wake / same-runway / crossing / collision (38 checks, 0 failed) (negatives 5/5) |
| T5 SFO runway ops | PASS | 2026-09-27 | SFO runway ops — 18 crossing / occupancy scenarios + bot shift (20 checks, 0 failed) (negatives 3/3) |
| T6 Weather | — | | |
| T7 Bot shift | — | | |
| T8 UI | — | | |
| T9 Look (advisory) | — | | |

## Current

T0–T5 green (2026-09-26). Bot: clean under light traffic; release throughput collapses above ~25 arrivals/h (being fixed before T6/T7).
