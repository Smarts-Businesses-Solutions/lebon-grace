#!/usr/bin/env bash
# Deployment CORRECTNESS check for shop.lebon-grace.com.
#
# Sibling to lebon-grace-uptime.sh, not a replacement. That one runs every two
# minutes and answers "is the shop up?" — it asserts the page renders and
# carries a dpl= build id. This one runs every fifteen and answers a different
# question: "is the shop serving what we think we shipped?"
#
# ── Why a second check exists ────────────────────────────────────────────────
#
# Every fault found walking production on 2026-08-09 would have passed the
# uptime check. All of them returned 200 with the right <title> and a valid
# dpl=:
#
#   * a deploy reported success and shipped nothing — the dead Clearance footer
#     link survived a deploy that verified clean;
#   * a product that does not exist returned 200 with "Product Not Found"
#     (B-13), so a broken product link was invisible to anything asserting
#     status < 400 — which is what both this file's sibling and
#     verify-deploy.mjs do;
#   * the live image had been built from a working tree, so no commit
#     identified what was running.
#
# Liveness and correctness are different questions. Asserting only the first is
# how a shop stays "up" for hours while selling nothing.
#
# ── Configuration ────────────────────────────────────────────────────────────
#   /etc/lebon-grace-uptime.env          (shared with the uptime check)
#     URL=https://shop.lebon-grace.com
#     SENTRY_DSN=...                     reuses the app's existing alerting
#     ALERT_WEBHOOK_URL=...              optional JSON POST
#     EXPECTED_DPL=20260809135800        optional; exact build id to require
#     KNOWN_PRODUCT=abc-jigsaw-board     a slug that must resolve
#
# Everything it needs is already paid for: systemd on the box, and the
# self-hosted GlitchTip the app already reports to. No third-party service, no
# tier to outgrow.
# NOTE: deliberately NOT `set -o pipefail`.
#
# `printf '%s' "$html" | grep -q PATTERN` is a false-negative factory under
# pipefail: grep exits the moment it matches, printf is killed by SIGPIPE, and
# pipefail then reports the whole pipeline as failed. The first run of this
# script claimed the homepage had no <title> while simultaneously reading the
# build id out of that same response. Conditions below use bash pattern
# matching instead of pipes wherever possible, which is faster and cannot
# SIGPIPE.
set -u

CONF=${CONF:-/etc/lebon-grace-uptime.env}
[ -f "$CONF" ] && . "$CONF"

URL=${URL:-https://shop.lebon-grace.com}
# Own state file. The shared conf sets STATE for the uptime check, so this must
# NOT inherit it — the two would overwrite each other's counters.
STATE=/var/lib/lebon-grace-deploy-verify.state
KNOWN_PRODUCT=${KNOWN_PRODUCT:-abc-jigsaw-board}
CURL="curl -sS --max-time 20"

problems=()
note() { problems+=("$1"); }

bust="_dv=$(date +%s)$$"
get()  { $CURL -o /dev/null -w '%{http_code}' "$1"; }
body() { $CURL "$1"; }

# ── 1. the shop renders ──────────────────────────────────────────────────────
home=$(body "${URL}/?${bust}")
case "$home" in
  *"<title>Lebon Grace"*) ;;
  *) note "homepage did not render (no <title>Lebon Grace)" ;;
esac

# ── 2. the build id is not going backwards ───────────────────────────────────
# Catches the failure this project actually had: a deploy that reports success
# while the container keeps serving the previous image. dpl is a UTC stamp, so
# it must only ever increase.
dpl=$(printf '%s' "$home" | grep -oE 'dpl=[0-9]+' | head -1 | cut -d= -f2)
if [ -z "$dpl" ]; then
  note "no dpl= build id served — version-skew protection is off"
else
  last=$(cat "$STATE" 2>/dev/null || echo 0)
  case "$last" in ''|*[!0-9]*) last=0 ;; esac
  if [ "$dpl" -lt "$last" ]; then
    note "build id WENT BACKWARDS: serving ${dpl}, previously ${last} — a stale image or an unintended rollback"
  else
    echo "$dpl" > "$STATE"
  fi
  if [ -n "${EXPECTED_DPL:-}" ] && [ "$dpl" != "$EXPECTED_DPL" ]; then
    note "serving build ${dpl}, expected ${EXPECTED_DPL}"
  fi
fi

# ── 3. a real product resolves — the PRECONDITION for check 4 ────────────────
# Without this, "a bogus slug 404s" would also pass on a shop that 404s
# everything, i.e. a completely broken deploy. L-2: pair every absence
# assertion with proof the thing could have been present.
known=$(get "${URL}/shop/${KNOWN_PRODUCT}?${bust}")
[ "$known" = "200" ] || note "known product /shop/${KNOWN_PRODUCT} returned ${known}, expected 200"

# ── 4. a product that does not exist is a real 404, not a soft one (B-13) ────
bogus=$(get "${URL}/shop/there-is-no-such-product-zzq?${bust}")
[ "$bogus" = "404" ] || note "non-existent product returned ${bogus}, expected 404 (soft 404 has regressed — B-13)"

# ── 5. the money path is reachable, and the catalogue actually loaded ───────
# NOT a count of product links on /shop: that page is a client component and
# its server HTML contains no product markup at all — zero "Add to cart", zero
# "AED", zero slugs. A curl-based grid count can only ever read 0, which is how
# the first version of this check "failed" against a perfectly healthy shop.
#
# The homepage DOES server-render a preload for the lead product's image, so
# that is a real signal the catalogue was resolved at render time.
# Match "lasercut", not "/images/lasercut/": next/image rewrites the path into
# a URL-ENCODED query parameter (%2Fimages%2Flasercut%2F...), so the literal
# slashed form never appears in the served HTML. Checking for it reported a
# missing catalogue on a perfectly healthy homepage.
case "$home" in
  *lasercut*) ;;
  *) note "homepage server-rendered no product image — the catalogue may have failed to load" ;;
esac
shop=$(get "${URL}/shop?${bust}")
[ "$shop" = "200" ] || note "/shop returned ${shop}, expected 200"
co=$(get "${URL}/checkout?${bust}")
[ "$co" = "200" ] || note "/checkout returned ${co}, expected 200"

# ── 6. withdrawn stock stays withdrawn (A-16) ───────────────────────────────
# The dead Clearance link survived a deploy that verified clean; nothing looked.
case "$home" in
  *"category=Clearance"*)
    note "the Clearance footer link is back — withdrawn stock is being advertised again (A-16)" ;;
esac

# ── report ───────────────────────────────────────────────────────────────────
if [ ${#problems[@]} -eq 0 ]; then
  echo "deploy-verify: OK ${URL} (build ${dpl:-unknown})"
  exit 0
fi

msg="shop.lebon-grace.com is UP but INCORRECT: $(printf '%s; ' "${problems[@]}")"
echo "deploy-verify: FAIL — ${msg}"

# Same alert path as the uptime check: reuse the routing that exists rather
# than invent a channel. Envelope endpoint, not the deprecated /store/.
if [ -n "${SENTRY_DSN:-}" ]; then
  key=$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https?://([^@]+)@.*#\1#')
  host=$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https?://[^@]+@([^/]+)/.*#\1#')
  proj=$(printf '%s' "$SENTRY_DSN" | sed -E 's#.*/([0-9]+)$#\1#')
  eid=$(tr -d '-' < /proc/sys/kernel/random/uuid 2>/dev/null)
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  if [ -n "$key" ] && [ -n "$host" ] && [ -n "$proj" ] && [ -n "$eid" ]; then
    payload=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '{"event_id":"%s","sent_at":"%s"}\n{"type":"event"}\n{"event_id":"%s","timestamp":"%s","platform":"other","level":"error","logger":"deploy-verify","server_name":"cx53","message":{"formatted":"%s"}}\n' \
      "$eid" "$ts" "$eid" "$ts" "$payload" \
    | curl -fsS --max-time 15 -o /dev/null \
        -X POST "https://${host}/api/${proj}/envelope/" \
        -H "Content-Type: application/x-sentry-envelope" \
        -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_client=deploy-verify/1.0, sentry_key=${key}" \
        --data-binary @- || echo "deploy-verify: sentry notify failed" >&2
  fi
fi

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  curl -fsS --max-time 15 -o /dev/null -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"level\":\"error\",\"text\":$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')}" \
    || echo "deploy-verify: webhook notify failed" >&2
fi

exit 1
