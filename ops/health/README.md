# Scheduled health checks

Two systemd timers on cx53. Free: a box that is already paid for, alerting into
the GlitchTip the app already reports to. No third-party service, no tier.

| Timer | Every | Answers |
|---|---|---|
| `lebon-grace-uptime` | 2 min | Is the shop **up**? |
| `lebon-grace-deploy-verify` | 15 min | Is it serving **what we shipped**? |

## Why the second one exists

Every fault found walking production on 2026-08-09 **would have passed the
uptime check**. All of them returned 200, with the right `<title>`, and a valid
`dpl=` build id:

- a deploy reported success and shipped nothing — the dead Clearance footer link
  survived a deploy that verified clean;
- a product that did not exist returned **200** with "Product Not Found" (B-13),
  so a broken product link was invisible to anything asserting `status < 400` —
  which is what the uptime check *and* `verify-deploy.mjs` both do;
- the live image had been built from a working tree, so no commit identified
  what was running.

Liveness and correctness are different questions. Asserting only the first is
how a shop stays "up" while selling nothing.

## What deploy-verify asserts

1. The homepage renders (`<title>Lebon Grace`).
2. The build id **never goes backwards** — `dpl` is a UTC stamp, so a decrease
   means a stale image or an unintended rollback. Optionally pins `EXPECTED_DPL`.
3. A known product returns 200 — **the precondition for 4**.
4. A non-existent product returns **404**, not a soft 404 (B-13 regression).
5. The catalogue resolved at render time, `/shop` and `/checkout` are reachable.
6. The Clearance footer link has not come back (A-16).

Check 3 exists because without it, "a bogus slug 404s" would also pass on a shop
that 404s *everything* — L-2, pair every absence assertion with proof the thing
could have been present.

## Install / update

```bash
scp ops/health/deploy-verify.sh root@116.203.242.215:/usr/local/bin/lebon-grace-deploy-verify.sh
ssh root@116.203.242.215 'bash -s' < ops/health/install.sh    # idempotent
```

Config is shared with the uptime check at `/etc/lebon-grace-uptime.env`
(`URL`, `SENTRY_DSN`, `ALERT_WEBHOOK_URL`, optional `EXPECTED_DPL`,
`KNOWN_PRODUCT`).

```bash
systemctl start lebon-grace-deploy-verify.service
journalctl -u lebon-grace-deploy-verify -n 20 --no-pager
```

## Verified in both directions

A monitor that cannot fail is decoration, so each was forced:

| Scenario | Result |
|---|---|
| Healthy production | **exit 0** |
| `EXPECTED_DPL` wrong | exit 1 — "serving build …, expected …" |
| Build id forced backwards | exit 1 — "build id WENT BACKWARDS" |
| Host unresolvable | exit 1, no hang |

## Two traps this script already fell into

**`set -o pipefail` + `grep -q` is a false-negative factory.** `printf '%s' "$html" | grep -q X`
— grep exits the moment it matches, `printf` dies of SIGPIPE, and pipefail
reports the pipeline as failed. The first run claimed the homepage had no
`<title>` while reading the build id out of that same response. Conditions now
use bash `case` matching: faster, and it cannot SIGPIPE.

**You cannot count products on `/shop` with curl.** That page is a client
component; its server HTML contains zero product markup — no "Add to cart", no
"AED", no slugs. A curl grid-count can only ever read 0. And the homepage's
product image is embedded **URL-encoded** (`%2Fimages%2Flasercut%2F…`) inside a
`next/image` query parameter, so matching `/images/lasercut/` finds nothing
either.

Both produced confident, wrong alerts against a perfectly healthy shop before
being caught. Any assertion added here should be tested against the live site
in both directions before it is trusted.

## What this cannot tell you

It runs **on cx53**, so it cannot report that cx53 itself has died — a monitor
cannot alert about its own host. Set `HEARTBEAT_URL` in the shared config: the
uptime check pings it only on healthy runs, so an external free service notices
when the pings *stop*. Silence becomes the failure signal.
