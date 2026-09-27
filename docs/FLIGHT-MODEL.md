# Flight model parameters and sources (T3)

The sim is a kinematic model (sim/aircraft.js, sim/perf.js), not a flight simulator. Every number the model flies to comes from one of the rows below; T3 (`gates/t3.mjs`) measures the model against them.

| Parameter | Value | Source | T3 tolerance (frozen) |
|---|---|---|---|
| Final approach speed per type (`vApp`) | FAA Aircraft Characteristics Database `Approach_Speed_knot` (e.g. B738 144, A320 136, B77W 149, E75L 126, C172 62) | `data/raw/aircraft/FAA-Aircraft-Char-Database.xlsx` (checksummed) | measured IAS at 3 NM = table ± 2 kt |
| Approach category (AAC) and wake category (CWT), SRS class | FAA ACD + FAA Order JO 7360.1K cross-check | same + `FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf` | exact match |
| Glideslope angle per runway | CIFP localizer records: ISFO 28L 2.85°, IGWQ 28R 3.00°, ISIA 19L 3.00°; NASR VGSI for the others (19R 3.15°, 10L/10R 3.0°) | `data/derived/ksfo-procedures.json`, `ksfo-airport.json` | altitude on final at 10 NM and 5 NM within 60 ft of TDZE + TCH + d·tan(angle) |
| Threshold crossing height | NASR `THR_CROSSING_HGT` (28R 68 ft, 28L 67 ft, 19L 71 ft) | `ksfo-airport.json` | crossing altitude within 40 ft |
| Standard rate turn | 3° per second | FAA Instrument Flying Handbook FAA-H-8083-15B, Ch. 7 "Standard Rate Turns" ("The standard rate of turn, 3° per second") | measured 3.0 ± 0.1 °/s at ≤ 180 kt |
| Bank-limited turn rate | ω = 1091·tan(φ)/TAS °/s with φ = 25° (20° small aircraft) — the coordinated-turn relation ω = g·tan φ / V in knots and degrees | physics; 1091 = g·(180/π)·3600/1852·… as used in TERPS/PANS-OPS turn construction | measured within 5 % of the formula at 250 kt |
| Speed limit below 10,000 ft | 250 kt IAS | 14 CFR 91.117(a), restated in AIM 4-4-12 | departures never exceed 250 kt below 10,000 ft |
| Climb rate (initial / to 10,000 ft) | jets 2,500 fpm (heavies 2,000), turboprops 1,500, small pistons 700 | **Documented assumption (D21)** — typical published initial climb figures for the classes; no free, scriptable per-type source was found (EUROCONTROL's performance pages load by script) | measured within 5 % of the table |
| Descent rate cap | 1,800 fpm jets/turboprops, 1,000 small | documented assumption (D21) | measured within 5 % |
| Acceleration on the roll | 4.0 kt/s jets, 3.3 heavies, 3.5 small; rotation at 1.05·Vapp (jets) | documented assumption (D21): gives 4,500–7,000 ft rolls, in the range of published takeoff field lengths | liftoff roll 3,000–8,000 ft |
| Runway occupancy after landing | touchdown ≈ 1,000–1,500 ft, braking 2.6 kt/s, exit at ≤ 45 kt | FAA SFO Capacity Profile assumes ≤ 50 s average runway occupancy for 2.5 NM (7110.65 5-5-4 i) | mean occupancy 35–60 s |
