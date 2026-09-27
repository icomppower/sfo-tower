#!/usr/bin/env bash
# Runs the SPEC §5 gates in order (T0..T9). Each gate must print `NEGATIVE n/n` with n>0 (its negative
# fixtures were all caught) and exit 0. Results are appended to RUNLOG.md and STATE.md is regenerated.
#   ./verify.sh          all gates
#   ./verify.sh t2 t4    just those
cd "$(dirname "$0")"
GATES=(t0 t1 t2 t3 t4 t5 t6 t7 t8 t9)
[ $# -gt 0 ] && GATES=("$@")
mkdir -p .verify
overall=0; summary=()
for g in "${GATES[@]}"; do
  f="gates/$g.mjs"
  if [ ! -f "$f" ]; then echo "== $g: no gate file"; summary+=("$g:missing"); overall=1; continue; fi
  echo "== $g =="
  out=".verify/$g.log"
  start=$(date +%s)
  if node "$f" >"$out" 2>&1; then rc=0; else rc=$?; fi
  cat "$out"
  neg=$(grep -E '^NEGATIVE [0-9]+/[0-9]+$' "$out" | tail -1 | awk '{print $2}')
  nn=${neg%/*}; nd=${neg#*/}
  if [ $rc -eq 0 ] && [ -n "$neg" ] && [ "$nn" = "$nd" ] && [ "$nn" -gt 0 ]; then st=PASS; else st=FAIL; overall=1; fi
  [ "$g" = "t9" ] && [ $st = FAIL ] && { st="FAIL(advisory)"; overall=$overall; }
  last=$(grep -E '^(PASS|FAIL) ' "$out" | tail -1 | sed -E 's/^(PASS|FAIL) [tT][0-9]+ //')
  echo "-- $g $st ($(( $(date +%s) - start )) s) negatives=$neg"
  summary+=("$g:$st:$neg:$last")
done
ts=$(date -u +%Y-%m-%dT%H:%MZ)
{ printf -- '- %s — ' "$ts"; for s in "${summary[@]}"; do printf '%s %s (neg %s); ' "$(echo "$s" | cut -d: -f1)" "$(echo "$s" | cut -d: -f2)" "$(echo "$s" | cut -d: -f3)"; done; printf '\n'; } >> RUNLOG.md
node tools/update-state.mjs "${summary[@]}" || true
echo; echo "OVERALL: $([ $overall -eq 0 ] && echo GREEN || echo RED)"
exit $overall
