# Decisions

Spec: Notion "SFO Tower — realism fork SPEC (Opus 5.5)" (3e81f269eaea81cd998cfae508a5107f). D1–D7 are the spec's own. Each new decision is one line.

- **D1–D7** — as in SPEC §3 (new repo, sim/view split, KSFO only, command menu, realism scoring, difficulty = rate+weather+assist, desktop+phone, zh+en).
- **D8** (2026-09-26) Fork pinned at `airtrafficcontrollergame` commit `706a5d145890ddb6f04ee8fda21709c96d4542d0`; the original files live unchanged in `classic/` and `index.html?classic` redirects there (T1 requires it, so the owner's open question "keep ?classic?" is answered yes).
- **D9** (2026-09-26) Time compression 1×/2×/4× is offered (owner's second open question): the sim steps a fixed dt, so speed is a view-side multiplier and replays stay byte-identical.
- **D10** (2026-09-26) METAR history comes from the Iowa Environmental Mesonet ASOS archive (redistributed NWS METARs, public domain); aviationweather.gov only serves the last few days, so it is used for the live option with the cached history as fallback.
- **D11** (2026-09-26) FAA Order JO 7110.65BB is cached from the FAA HTML edition (`atc_html/`); the PDF URL returns 404. Paragraphs used are quoted in `docs/RULES.md` with paragraph numbers.
- **D12** (2026-09-26) Wake turbulence uses the Consolidated Wake Turbulence (CWT) categories A–I of 7110.65BB 5-5-4 g/h (the tables the paragraph text calls TBL 5-5-1 and TBL 5-5-2; the HTML headings label them TBL 5-5-3/5-5-4). Per-type category assignments come from FAA Order JO 7360.1.
- **D13** (2026-09-26) Raw datasets (~450 MB, mostly BTS) are cached in `data/raw/` (gitignored) and pinned by `data/checksums.json`; only compact derived JSON is committed. Same pattern as Bay Crossing.
- **D14** (2026-09-26) Airport geometry source of truth is NASR `APT_RWY_END.csv` (28-day cycle effective 2026-09-03); T2 cross-checks OurAirports and the CIFP `PG` runway records.
