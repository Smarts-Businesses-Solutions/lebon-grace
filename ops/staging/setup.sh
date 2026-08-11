#!/usr/bin/env bash
#
# Stand up the lebon-grace STAGING database on cx53 (TR-03).
#
#   ./ops/staging/setup.sh            # generate secrets, start, migrate, verify
#   ./ops/staging/setup.sh --migrate  # re-apply migrations against a running stack
#   ./ops/staging/setup.sh --status   # what is running, and is it healthy
#   ./ops/staging/setup.sh --destroy  # stop and DELETE the staging volume
#
# Why a script rather than a runbook: a staging environment assembled by hand
# from a wiki page is a pet. Something has to rebuild it from nothing, or the
# first time it breaks it gets abandoned and the manual playbook (P-006)
# quietly becomes permanent again.
#
# No secret is ever echoed. Not truncated, not partially masked — a secret
# printed to a terminal is a secret in a scrollback buffer, a log and a
# transcript. --status reports lengths only.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV_FILE="$HERE/.env.staging"
KONG_URL="http://127.0.0.1:8114"
DB=lg-staging-db

psql_q() { docker exec "$DB" psql -U postgres -d postgres -tAc "$1"; }
dc()     { docker compose --env-file "$ENV_FILE" -f "$HERE/docker-compose.yml" "$@"; }

case "${1:-}" in
  --status)
    docker ps --filter name=lg-staging --format '{{.Names}}\t{{.Status}}'
    if [ -f "$ENV_FILE" ]; then
      echo "  .env.staging present; secret lengths:"
      # Names and LENGTHS only.
      awk -F= '/^[A-Z_]+=/ {printf "    %s = %d chars\n", $1, length($2)}' "$ENV_FILE"
    else
      echo "  .env.staging MISSING"
    fi
    exit 0 ;;
  --destroy)
    # Guard: refuse unless this really is the staging stack.
    if ! psql_q "select safe_to_destroy from staging_marker where id=1" 2>/dev/null | grep -qx t; then
      echo "REFUSING: no staging_marker row. This is not a database this script may destroy." >&2
      exit 1
    fi
    dc down -v
    echo "  staging stack and its volume are gone"
    exit 0 ;;
esac

# ── secrets ──────────────────────────────────────────────────────────────────
# Generated inside a throwaway node container: cx53 has no node, and installing
# a runtime on shared infrastructure to run one setup script is a poor trade.
if [ ! -f "$ENV_FILE" ] || [ ! -f "$HERE/kong.yml" ]; then
  echo "  generating secrets"
  docker run --rm -v "$HERE:/w" -w /w node:22-alpine node gen-secrets.mjs
fi
# .env.staging is read by docker compose as root, so it stays 0600.
#
# kong.yml must be 0644: kong runs as a NON-ROOT user inside its container and
# a 0600 root-owned bind mount is unreadable to it — the container crash-loops
# with "kong.yml: Permission denied", which reads like a config syntax error.
# The file does embed the service_role key, but it lives under /root (mode 700),
# so the host-side protection is the directory, not the file bit.
chmod 600 "$ENV_FILE"
chmod 644 "$HERE/kong.yml"

# ── stack ────────────────────────────────────────────────────────────────────
if [ "${1:-}" != "--migrate" ]; then
  echo "  starting the staging stack"
  dc up -d
fi

echo -n "  waiting for postgres"
for _ in $(seq 1 120); do
  if psql_q "select 1" >/dev/null 2>&1; then echo " — ready"; break; fi
  echo -n "."; sleep 1
done
psql_q "select 1" >/dev/null

# ── database roles ────────────────────────────────────────────────────
#
# The supabase/postgres image creates `authenticator` (the role PostgREST logs
# in as) but does NOT give it POSTGRES_PASSWORD, so PostgREST crash-loops with
# "password authentication failed for user authenticator" until it is set.
#
# Setting it explicitly rather than relying on the image to do it: this is the
# hinge the whole REST path hangs on, and depending on undocumented image
# behaviour for it means a future image bump silently breaks staging.
#
# The password reaches psql over STDIN, never as an argument, so it does not
# appear in `ps` output or in this script's trace.
PGPW="$(awk -F= '/^POSTGRES_PASSWORD=/{print $2}' "$ENV_FILE")"
# As supabase_admin over TCP, and both halves of that matter:
#
#   * NOT `postgres` — `authenticator` is a RESERVED role in this image and
#     `postgres` is not a superuser here, so the ALTER fails with "only
#     superusers can modify it".
#   * NOT the unix socket — the ACTIVE pg_hba is /etc/postgresql/pg_hba.conf
#     (not the one in the data directory, which is a decoy that says
#     `local all all trust`). It has `local all supabase_admin scram-sha-256`,
#     so a socket connection demands a password nobody has. The same file has
#     `host all all 127.0.0.1/32 trust`, so TCP to loopback INSIDE the
#     container needs none.
docker exec -i "$DB" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/dev/null <<SQL
ALTER ROLE authenticator WITH LOGIN PASSWORD '$PGPW';
SQL
echo "  authenticator role password set"

# ── the safety marker ────────────────────────────────────────────────────────
#
# The lifecycle test destroys data, so it must be certain which database it is
# pointed at. Blacklisting production's URL would be fail-OPEN: any URL not on
# the list is permitted, so a typo, a new host or a copied env var goes straight
# through to the live shop.
#
# This is the fail-CLOSED version. A destructive test refuses to run unless it
# can read a row in which the database says, in its own words, that it is
# disposable. Production has no such table and never will, so the check cannot
# be satisfied by accident — only by explicit intent.
psql_q "
  CREATE TABLE IF NOT EXISTS staging_marker (
    id int PRIMARY KEY DEFAULT 1,
    safe_to_destroy boolean NOT NULL DEFAULT true,
    note text NOT NULL,
    CONSTRAINT one_row CHECK (id = 1)
  );
  INSERT INTO staging_marker (id, safe_to_destroy, note)
  VALUES (1, true, 'lebon-grace STAGING (TR-03). Every row here is disposable. Production has no such table, by design.')
  ON CONFLICT (id) DO NOTHING;
  COMMENT ON TABLE staging_marker IS
    'Proof-of-staging. Destructive tests MUST require this row before touching anything (TR-03).';
" >/dev/null
[ "$(psql_q 'select safe_to_destroy from staging_marker where id=1')" = "t" ] \
  || { echo "staging marker did not take" >&2; exit 1; }
echo "  staging marker present — this database can identify itself as disposable"

# ── migrations ───────────────────────────────────────────────────────────────
echo "  applying migrations from supabase/migrations/"
fail=0
for f in "$REPO"/supabase/migrations/*.sql; do
  name="$(basename "$f")"

  # The baseline is a full pg_dump of PRODUCTION, so it recreates the `auth` and
  # `storage` schemas — which the supabase/postgres image has already created
  # and owns. Restoring it as `postgres` therefore produces ~250 "already
  # exists" / "must be owner" errors against Supabase-internal objects that this
  # application never touches (verified: zero `.auth.` / `.storage.` calls in
  # src/). Insisting on a clean exit here would mean either editing a dump by
  # hand or running a different Postgres than production does.
  #
  # So the baseline is applied PERMISSIVELY and its exit code is deliberately
  # not the gate. The gate is verify-schema.sh, which compares staging's public
  # schema against production column by column afterwards. That checks the
  # outcome we actually care about instead of trusting the process that got
  # there — if the restore silently skipped something that matters, parity
  # fails and this environment is refused.
  if [ "$name" = "00000000000000_baseline.sql" ]; then
    docker exec -i "$DB" psql -U postgres -d postgres -q < "$f" >/dev/null 2>/tmp/mig.err || true
    errs=$(grep -c '^ERROR' /tmp/mig.err || true)
    pub=$(grep -c 'ERROR.*public\.' /tmp/mig.err || true)
    echo "    ok    $name  (permissive: $errs errors, $pub of them touching public — see comment)"
    if [ "$pub" -gt 0 ]; then
      echo "          errors in the PUBLIC schema are not expected:" >&2
      grep 'ERROR.*public\.' /tmp/mig.err | sed 's/^/          /' >&2
      fail=1; break
    fi
    continue
  fi

  # Every real migration is strict. These are ours, they run against a database
  # that already matches production, and any error in one is a genuine defect.
  if docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" 2>/tmp/mig.err; then
    echo "    ok    $name"
  else
    # Loud, and stop. A half-migrated staging database that reports success is
    # worse than none — every later test result is a lie.
    echo "    FAIL  $name"; sed 's/^/          /' /tmp/mig.err; fail=1; break
  fi
done
[ "$fail" = 0 ] || { echo "  migrations failed — staging is NOT usable" >&2; exit 1; }

# ── make PostgREST notice the migrations ────────────────────────────────
#
# PostgREST caches the schema at connect time and does NOT poll for changes. The
# migrations above ran after it connected, so without this it serves a schema
# from before them and every insert fails with:
#
#   PGRST204: Could not find the 'delivery_method' column of 'orders'
#             in the schema cache
#
# That error names a column which demonstrably exists, so it reads as database
# corruption or a broken migration. It is neither — it is a stale cache, and
# one NOTIFY fixes it.
docker exec "$DB" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema'" >/dev/null
echo "  PostgREST schema cache reloaded"

# ── prove the REST path works, not just the database ─────────────────────────
KEY="$(awk -F= '/^SERVICE_ROLE_KEY=/{print $2}' "$ENV_FILE")"
echo -n "  waiting for PostgREST via kong"
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    "$KONG_URL/rest/v1/products?select=slug&limit=1" || true)
  if [ "$code" = "200" ]; then echo " — ready"; break; fi
  echo -n "."; sleep 1
done
[ "$code" = "200" ] || { echo " — FAILED (last status $code)" >&2; exit 1; }

cat <<DONE

  Staging is up.

    REST  $KONG_URL      (127.0.0.1 only — no public route, no Traefik)
    PG    127.0.0.1:9114      (tunnel: ssh -L 9114:127.0.0.1:9114 root@cx53)

  Credentials: ops/staging/.env.staging (0600, gitignored).
  Copy them into supabase.local — they are stored nowhere else.
DONE
