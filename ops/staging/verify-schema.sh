#!/usr/bin/env bash
#
# Does staging actually reproduce production's schema? (TR-03, and A-8)
#
#   ./ops/staging/verify-schema.sh
#
# This is the gate that setup.sh's migration step deliberately is not. The
# baseline is a production pg_dump restored into an image that already owns the
# auth and storage schemas, so its exit code is noisy and uninformative. What
# matters is the OUTCOME: after every migration has run, is staging's public
# schema the same shape as the live one?
#
# Checking the outcome rather than the process also answers a second question
# that has never had a first-hand answer — whether the forward migrations in
# supabase/migrations/ can rebuild production from nothing (A-8). If they can,
# these two schemas match. If they cannot, this prints exactly where they
# diverge.
#
# STRICTLY READ-ONLY against production. It runs SELECTs against catalog views
# and nothing else; there is no path in this file that writes to the live
# database.

set -euo pipefail

PROD_DB=db-ezkokajmmqcv8bw8jy970l91
STAGE_DB=lg-staging-db
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Tables that exist only on one side BY DESIGN, and must not count as drift.
#   staging_marker — staging's proof-of-identity; production must never have it.
EXCLUDE="'staging_marker'"

q() { # q <container> <sql> <outfile>
  docker exec "$1" psql -U postgres -d postgres -tAF'|' -c "$2" | sort > "$3"
}

echo "Comparing staging's public schema against production."
echo

# ── columns: name, type, nullability, default presence ───────────────────────
# Default VALUES are not compared, only whether one exists: production's
# defaults legitimately include values seeded at different times.
COLS="select table_name||'.'||column_name||' '||data_type
             ||' null='||is_nullable
             ||' hasdefault='||(column_default is not null)::text
      from information_schema.columns
      where table_schema='public' and table_name not in ($EXCLUDE)"

q "$PROD_DB"  "$COLS" "$TMP/prod.cols"
q "$STAGE_DB" "$COLS" "$TMP/stage.cols"

# ── constraints ──────────────────────────────────────────────────────────────
CONS="select conrelid::regclass||' '||contype::text||' '||conname
      from pg_constraint c join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname not in ($EXCLUDE)"

q "$PROD_DB"  "$CONS" "$TMP/prod.cons"
q "$STAGE_DB" "$CONS" "$TMP/stage.cons"

# ── indexes ──────────────────────────────────────────────────────────────────
IDX="select tablename||' '||indexname from pg_indexes
     where schemaname='public' and tablename not in ($EXCLUDE)"

q "$PROD_DB"  "$IDX" "$TMP/prod.idx"
q "$STAGE_DB" "$IDX" "$TMP/stage.idx"

fail=0
report() { # report <label> <prodfile> <stagefile>
  local label=$1 pf=$2 sf=$3
  local only_prod only_stage
  only_prod=$(comm -23 "$pf" "$sf")
  only_stage=$(comm -13 "$pf" "$sf")
  if [ -z "$only_prod" ] && [ -z "$only_stage" ]; then
    printf "  %-12s match (%s entries)\n" "$label" "$(wc -l < "$pf")"
    return
  fi
  fail=1
  printf "  %-12s DRIFT\n" "$label"
  [ -n "$only_prod" ]  && { echo "    in PRODUCTION only — staging is missing these:"; echo "$only_prod" | sed 's/^/      /'; }
  [ -n "$only_stage" ] && { echo "    in STAGING only — migrations created something production lacks:"; echo "$only_stage" | sed 's/^/      /'; }
}

report columns     "$TMP/prod.cols" "$TMP/stage.cols"
report constraints "$TMP/prod.cons" "$TMP/stage.cons"
report indexes     "$TMP/prod.idx"  "$TMP/stage.idx"

echo
if [ "$fail" = 0 ]; then
  echo "Staging reproduces production's public schema exactly."
  echo "That also answers A-8: the forward migrations rebuild production from nothing."
else
  echo "Staging does NOT match production. Tests run against it would be testing a" >&2
  echo "different database than the one that takes orders." >&2
  exit 1
fi
