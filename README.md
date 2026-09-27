# 🗼 SFO Tower

**Play:** https://icomppower.github.io/sfo-tower — one airport, real rules. A realism fork of [Tower Control](https://github.com/icomppower/airtrafficcontrollergame) (the original arcade game is untouched at `classic/`, reachable with `?classic`).

- **San Francisco International only**, with its real runway layout from FAA NASR (thresholds to the metre) and the 28L/28R arrivals crossing the 1L/1R departures.
- **Real controller instructions:** heading, altitude, speed, ILS / RNAV / visual approach clearance, line up and wait, takeoff and landing clearance, hold short, go-around. Pilot readbacks in aviation English; synthesized radio audio, no voice files.
- **Real separation rules** from FAA Order JO 7110.65BB: 3 NM radar / 1,000 ft, 2.5 NM inside 10 NM on final, Consolidated Wake Turbulence tables, same-runway and intersecting-runway separation, wake time intervals — every paragraph quoted in `docs/RULES.md`.
- **Real weather:** three years of KSFO METARs drive the runway plan (West / Southeast / 28RT), the approach type and the side-by vs in-trail throughput. Fog is fog.
- **Real traffic shape:** hourly arrival and departure counts from the BTS on-time data, carrier mix, 44 aircraft types with FAA approach speeds and wake categories.
- Desktop and phone (2D radar scope + surface map), English and 中文, time compression 1×/2×/4×, seeded and deterministic (replays are byte-identical).

## Layout

| Path | What |
|---|---|
| `sim/` | Zero-DOM, seeded simulation: flight model, commands, weather, traffic, rules, scoring, the bot controller. Runs headless in Node. |
| `view/` | Canvas radar scope, surface map, HUD, command bar, audio, i18n. |
| `classic/` | The original Tower Control, byte-identical to the pinned commit. |
| `data/derived/` | Compact JSON built from the raw sources; `data/checksums.json` pins the raw files (`tools/fetch-data.mjs`). |
| `gates/`, `verify.sh` | The T0–T9 gates from the spec; each runs its negative fixtures first. `STATE.md` is the resume point, `RUNLOG.md` the run history, `DECISIONS.md` the decisions. |
| `docs/RULES.md`, `docs/FLIGHT-MODEL.md` | The rules and flight-model parameters with their sources. |

## Run locally

```
npm run serve            # http://localhost:8643
node tools/fetch-data.mjs   # re-download the raw sources (≈ 500 MB, gitignored) and verify checksums with --check
node tools/derive.mjs       # rebuild data/derived/
./verify.sh                 # all gates (T8/T9 need Google Chrome; puppeteer-core is a dev dependency)
```

Test hooks: `?play` auto-starts, `?seed=`, `?difficulty=easy|normal|hard`, `?weather=auto|clear|fog|storm`, `?ff=N` fast-forwards N seconds, `?bot=1` lets the bot controller work the shift, `?debug` exposes `window.__sfo`.

## Data and licences

FAA NASR, CIFP, JO 7110.65BB, JO 7360.1K, the Aircraft Characteristics Database, the SFO Airport Capacity Profile, the AIM and the Instrument Flying Handbook are US Government works (public domain). OurAirports data is public domain. KSFO METAR history comes from the Iowa Environmental Mesonet ASOS archive (NWS observations). Hourly traffic counts come from the US DOT BTS On-Time Performance data. No live flight-tracking feed is used. Details per file in `data/checksums.json`.
