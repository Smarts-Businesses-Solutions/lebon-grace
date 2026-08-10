# Scheduled health checks

Three systemd timers on cx53. Free: a box that is already paid for, alerting into
the GlitchTip the app already reports to. No third-party service, no tier.

| Timer | Every | Answers |
|---|---|---|
| `lebon-grace-uptime` | 2 min | Is the shop **up**? |
| `lebon-grace-deploy-verify` | 15 min | Is it serving **what we shipped**? |
| `lebon-grace-ci-freshness` | 30 min | Is the CI gate still **watching**? |

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

## Why the third one exists

`.forgejo/workflows/ci.yml` was committed, and described in four documents as
this project's quality gate. **It had never executed once.** The repository did
not exist in Forgejo, so nothing was listening.

Nothing reported that, and nothing could have: a pipeline that never runs
produces no failures — and neither does a healthy one. The two are
indistinguishable from the outside, which is the same shape as the uptime check
passing on a shop that sells nothing.

So this check deliberately does **not** ask "did the last run pass". A red run
is loud and someone is looking at it. It asks whether the gate is still
connected to anything:

1. Forgejo answers, the repo exists, and it has run the workflow **at least
   once** — the precondition, without which every assertion below is vacuously
   true on a repo that does no work at all.
2. A runner is **online**. With none, jobs are accepted and queue forever; the
   UI shows them pending and nothing ever fails.
3. The **mirror is not stale** — a commit that has been on GitHub longer than
   `MAX_MIRROR_LAG_MIN` must have reached Forgejo. If the mirror breaks, CI goes
   on passing against whatever it last pulled, which is worse than no CI: it
   reports success about code nobody is running.
4. **Nothing is stuck** — a job waiting or running past `MAX_STUCK_MIN` will
   never turn red by itself.

It does *not* assert "there is a run for the current HEAD": `ci.yml` has a
`paths-ignore` for `docs/**` and `**.md`, so a documentation commit correctly
produces no run, and asserting otherwise would cry wolf on every markdown edit.

Staleness is compared by **commit age**, not "the SHAs differ", so a push thirty
seconds ago does not read as a broken mirror.

## Install / update

```bash
scp ops/health/deploy-verify.sh root@116.203.242.215:/usr/local/bin/lebon-grace-deploy-verify.sh
scp ops/health/ci-freshness.sh root@116.203.242.215:/usr/local/bin/lebon-grace-ci-freshness.sh
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

`ci-freshness.sh`, forced the same way on 2026-08-09:

| Scenario | Result |
|---|---|
| Healthy | **exit 0** — "2 runs, mirror current" |
| Repo absent from Forgejo (*the original fault*) | exit 1 — "does not exist in Forgejo" |
| Forgejo API unreachable | exit 1 — "the CI gate cannot be running" |
| A run stuck (threshold forced to 0m) | exit 1 — "will never go red by themselves" |
| Mirror stale (HEADs differ, commit 36m old) | exit 1 — "CI is checking code nobody is running" |
| Token missing | exit 1 — "UNVERIFIED this run", not a silent skip |
| Real repo at a 1-minute lag threshold | **exit 0** — no false alarm |

That last row matters as much as the failures: the first attempt to force the
stale path reported OK, and the script was right — the commit was 40 minutes old
against a 45-minute threshold. The test was wrong, not the check. Re-run at a
1-minute threshold it failed correctly, and the real repo still passed.

### It cried wolf once, on 2026-08-10

`ci-freshness` reported **"no Forgejo runner is registered at all"** while the
runner was up and had been for two days. The runner was fine; the monitor was
wrong.

`db()` swallowed every failure into an empty string, and every caller read empty
as *the thing does not exist*. A transient `database is locked` — the box was
running a deploy and a CI job at once — therefore became a confident claim that
CI was dead. That is an absence assertion with no proof the check could have
succeeded (L-2), inside the monitor written to enforce L-2.

Now `db()` retries three times and, if it still cannot read, emits a sentinel so
callers say **UNVERIFIED** instead of inventing a cause. The distinction matters
because a monitor that cries wolf is one people learn to ignore (L-5).

**The first attempt at this fix was dead code.** It set a global flag inside
`db()` — which is always called as `$(db ...)`, a subshell, so the assignment
never reached the caller. It was caught by running the script, not by reading
it. The sentinel travels on stdout precisely because stdout crosses a subshell
and a variable does not.

| Scenario | Result |
|---|---|
| Unreadable database | exit 1 — "CI state UNVERIFIED this run (NOT a claim that CI is broken)" |
| Repo genuinely absent | exit 1 — still detected, not masked by the new branch |
| Healthy | exit 0 |

**Runner-offline is the one path not forced**, deliberately: the act_runner is
shared with seven other projects, and stopping it to prove a message would take
their CI down too.

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
