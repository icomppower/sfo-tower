# 🗼 SFO Tower

Realism fork of [Tower Control](https://github.com/icomppower/airtrafficcontrollergame): one airport (San Francisco International, KSFO), real controller instructions (heading / altitude / speed / approach clearance / line up and wait / takeoff / landing / hold short / go-around), FAA JO 7110.65 separation and runway rules, and METAR-driven runway configuration.

- `sim/` — zero-DOM, seeded, deterministic simulation (runs headless in Node).
- `view/` — radar scope, surface map, HUD, synthesized audio.
- `classic/` — the original arcade game, unchanged (`index.html?classic`).
- `data/` — cached source data checksums and derived JSON; `tools/fetch-data.mjs` re-downloads the raw sets.
- `gates/` + `verify.sh` — the T0–T9 gates from the spec; `STATE.md` is the resume point.

Spec, status and decisions: Notion (owner) + `DECISIONS.md`.
