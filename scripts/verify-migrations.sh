#!/usr/bin/env bash
# Prove that baseline + every forward migration reproduces production exactly.
#
# ACTION_PLAN.md A-8 / finding D-4. The schema used to be a single baseline dump
# with no incremental history, and it had silently drifted four tables, a view
# and three columns behind production before anyone regenerated it. Numbered
# forward migrations only fix that if they are actually equivalent to what is
# running — otherwise the drift returns, just with more files.
#
# So: build the schema from scratch in a throwaway database, dump both, diff.
# A green run means the migration set IS the schema. A red one means production
# has changed underneath the repo, and the diff says exactly where.
#
#   bash scripts/verify-migrations.sh
#
# Override any of these if the estate moves:
#   DB_HOST   ssh target                (default root@116.203.242.215)
#   SSH_KEY   identity file             (default ~/.ssh/hetzner_ed25519)
#   DB_CONT   postgres container name   (default db-ezkokajmmqcv8bw8jy970l91)
#   PROD_DB   database to compare with  (default postgres)
#
# Safety: production is only ever READ (pg_dump --schema-only). All writes go to
# a scratch database that is dropped on exit, including on failure — see the
# trap below. Requires the Supabase superuser, which is `supabase_admin`; the
# `postgres` role is NOT a superuser here and cannot read every object.
set -euo pipefail

DB_HOST="${DB_HOST:-root@116.203.242.215}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hetzner_ed25519}"
DB_CONT="${DB_CONT:-db-ezkokajmmqcv8bw8jy970l91}"
PROD_DB="${PROD_DB:-postgres}"
SCRATCH="migration_check_$$"

cd "$(dirname "$0")/.."
MIGRATIONS=(supabase/migrations/*.sql)
if [ ${#MIGRATIONS[@]} -eq 0 ]; then echo "no migrations found" >&2; exit 1; fi

ssh_do() { ssh -i "$SSH_KEY" "$DB_HOST" "$@" < /dev/null; }
# `docker exec` WITHOUT -i for anything that needs no stdin. With -i it inherits
# this script's stdin and silently eats the rest of a piped heredoc.
psql_do() { ssh_do "docker exec $DB_CONT sh -c 'PGPASSWORD=\$POSTGRES_PASSWORD psql -U supabase_admin -d $1 -q -v ON_ERROR_STOP=1 -c \"$2\"'"; }

cleanup() {
  ssh_do "docker exec $DB_CONT sh -c 'PGPASSWORD=\$POSTGRES_PASSWORD psql -U supabase_admin -d $PROD_DB -q -c \"DROP DATABASE IF EXISTS $SCRATCH\"'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▸ scratch database $SCRATCH"
psql_do "$PROD_DB" "DROP DATABASE IF EXISTS $SCRATCH"
psql_do "$PROD_DB" "CREATE DATABASE $SCRATCH TEMPLATE template0"
# The baseline contains `CREATE SCHEMA public`, which collides with the one every
# new database already has. Drop it so the baseline can create its own.
psql_do "$SCRATCH" "DROP SCHEMA IF EXISTS public CASCADE"

echo "▸ applying ${#MIGRATIONS[@]} files in order:"
printf '    %s\n' "${MIGRATIONS[@]}"
cat "${MIGRATIONS[@]}" | ssh -i "$SSH_KEY" "$DB_HOST" \
  "docker exec -i $DB_CONT sh -c 'PGPASSWORD=\$POSTGRES_PASSWORD psql -U supabase_admin -d $SCRATCH -q -v ON_ERROR_STOP=1 -f -'" >/dev/null

echo "▸ diffing public schema against $PROD_DB"
# `\restrict`/`\unrestrict` carry a token pg_dump randomises per invocation, so
# they differ on every run and say nothing about the schema. Everything else is
# compared verbatim.
ssh -i "$SSH_KEY" "$DB_HOST" "bash -s" < /dev/null <<REMOTE
set -e
d() {
  docker exec $DB_CONT sh -c "PGPASSWORD=\\\$POSTGRES_PASSWORD pg_dump -U supabase_admin --schema-only --no-owner --no-acl --schema=public -d \$1" < /dev/null \
    | grep -vE '^--|restrict |^\$|^SET |^SELECT pg_catalog.set_config' || true
}
d $PROD_DB  > /tmp/$SCRATCH.prod
d $SCRATCH  > /tmp/$SCRATCH.check
if diff -u /tmp/$SCRATCH.prod /tmp/$SCRATCH.check; then
  echo "✓ IDENTICAL — the migration set reproduces production (\$(wc -l < /tmp/$SCRATCH.prod) lines)"
else
  echo ""
  echo "✗ DRIFT. Production does not match baseline + migrations."
  echo "  '-' is production, '+' is what the repo would build."
  echo "  Either a change was applied by hand and never written down, or a"
  echo "  migration does something different from what was actually run."
  rm -f /tmp/$SCRATCH.prod /tmp/$SCRATCH.check
  exit 1
fi
rm -f /tmp/$SCRATCH.prod /tmp/$SCRATCH.check
REMOTE
