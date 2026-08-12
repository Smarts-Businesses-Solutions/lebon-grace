# Lebon Grace — Deployment Guide

**Last Updated:** 2026-08-09

How this shop gets from a commit to serving customers, and how to tell whether it
actually did. Read `docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md` alongside this —
the deployment model is mid-change.

---

## Where it runs

```
Cloudflare ──▶ coolify-proxy (Traefik) ──▶ lebon-grace container :3000
                                              on Hetzner cx53, 116.203.242.215
```

Public name: **`shop.lebon-grace.com`**. The container's Traefik router matches
`Host('lebon-grace.axiomsynapse.com')`. `lebon-grace.com` is a **different site
entirely** — do not point anything at it by accident.

Control plane: **Coolify SaaS**, `app.coolify.io`. cx53 runs only
`coolify-sentinel` and `coolify-proxy`; there is no local Coolify.

## The important caveat about "Deploy"

The app is registered as a Coolify **service**, which recreates the container
from a compose file pinning the image tag `lebon-grace:cx53`. **Coolify does not
clone and does not build.** Pressing Deploy recreates the container from whatever
image was last built by hand — so a commit can sit unshipped while every deploy
reports success.

Until the migration finishes, **deploying means building the image yourself.**

## Deploy, today

```bash
# 1. tag a rollback before anything
ssh -i ~/.ssh/hetzner_ed25519 root@116.203.242.215 \
  "docker tag lebon-grace:cx53 lebon-grace:rollback-$(date +%Y%m%d)"

# 2. get the source onto the box (/root/build/lebon-grace)

# 3. build — real values for NEXT_PUBLIC_* and UMAMI_ORIGIN, placeholders for the rest
docker build \
  --build-arg BUILD_ENV="$(cat /tmp/buildenv.txt)" \
  --build-arg DEPLOYMENT_ID=$(date -u +%Y%m%d%H%M%S) \
  -t lebon-grace:cx53 .

# 4. trigger Coolify to recreate the container from the new tag
```

Two build-arg rules learned the hard way:

- **`UMAMI_ORIGIN` must be a real URL.** A placeholder produces `Invalid rewrite`
  from `next.config`, and the build fails late.
- **Server-side keys no longer need placeholders.** ~~Module-scope SDK
  constructors (`new Resend(undefined)`) throw during page-data collection.~~
  **Fixed 2026-08-09:** clients are built lazily (`mailer()` in `src/lib/email.ts`),
  so the build needs no runtime secrets at all — which is how CI builds it. Any
  placeholders you do pass live in the builder stage only and never reach the
  runner. Construct SDK clients inside a function, never at module scope.

## Prune the staged tarballs

Every deploy leaves an `lg-<sha>.tar.gz` in `/root/build`. Thirteen had
accumulated by 2026-08-12 — **12 GB** to hold the same few megabytes of
application, repeatedly.

```bash
ssh -i ~/.ssh/hetzner_ed25519 root@116.203.242.215   'cd /root/build && ls -t lg-*.tar.gz | tail -n +3 | xargs -r rm -f'
```

Keep the newest two: the live build, and the one before it to roll back to.
Everything older is reproducible with `git archive <sha>` — verify the SHA is
still in git before deleting anything you are unsure of.

The archives are also **half the size they were**: `.gitattributes` now marks
`originals/`, `screenshots/`, `audits/`, `docs/`, `tests/` and `ops/` as
`export-ignore`, all of which `.dockerignore` already excluded from the build.
`git archive` does not read `.dockerignore`, so they were being shipped and
discarded — 912 MB became 441 MB.

**A caveat that follows from that:** the deploy tarball no longer contains
`ops/`, `tests/` or `docs/`. It is an input to `docker build` and nothing else.
If you need those on the server — `ops/staging/setup.sh`, for instance — use a
separate checkout, which is what `/root/lg-staging` already is.

## The `lebon-grace:cx53` tag must always exist

The compose file pins `image: 'lebon-grace:cx53'`. A running container does not
need that tag — it is already on the image — so the tag can go missing without
anything appearing wrong. **The next recreation is when you find out**, and by
then the container is stopped.

Found in this state on 2026-08-11: `docker ps` showed the container up and
healthy on `lebon-grace:cx53`, while `docker images` had no such tag — it had
been moved to `pending-2519eff` by an earlier session. Pressing Deploy in
Coolify, or any `up --force-recreate`, would have taken the shop down with no
image to start.

**So: tag the rollback by ADDING a tag, never by renaming `cx53`.**

```bash
# right — cx53 keeps pointing at the live image
docker tag lebon-grace:cx53 lebon-grace:rollback-$(date +%Y%m%d)

# check before and after any deploy that the tag the compose pins still exists
docker images --format '{{.Repository}}:{{.Tag}}' | grep -x 'lebon-grace:cx53'   || echo 'DANGER: compose pins a tag that does not exist'
```

Rolling back is retagging plus a recreate of the one service:

```bash
ssh -i ~/.ssh/hetzner_ed25519 root@116.203.242.215   "docker tag lebon-grace:rollback-YYYYMMDD lebon-grace:cx53 &&    cd /data/coolify/services/lixqbqbkz39l0bnz9xv2227t &&    docker compose up -d --force-recreate --no-deps lebon-grace"
```

`--no-deps` and the explicit service name matter: cx53 is shared infrastructure
and a deploy must never touch anything but this app's container.

## Verify — never trust a green deploy

```bash
npm run verify:deploy
npm run verify:deploy -- --changed-from <previous-dpl>
```

Next stamps `DEPLOYMENT_ID` into every asset URL as `?dpl=`. That is the only
first-hand evidence of which build is live. Then check the surfaces the change
was supposed to affect — not just that the site is up. A verified-clean deploy
still left a dead clearance link in the footer, because nothing checked for it.

```bash
ssh -i ~/.ssh/hetzner_ed25519 root@116.203.242.215 \
  "docker ps --filter name=lebon-grace --format '{{.Status}} {{.Image}}'"
curl -s -o /dev/null -w '%{http_code}\n' https://shop.lebon-grace.com/
```

## Environment

Six are genuinely required — the shop is broken without them:

```
SUPABASE_SERVICE_ROLE_KEY   STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET       RESEND_API_KEY
ADMIN_PASSWORD              ADMIN_SESSION_SECRET
```

Build-time (inlined into the browser bundle — changing them at runtime does
nothing):

```
NEXT_PUBLIC_SUPABASE_URL   NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_UMAMI_WEBSITE_ID   NEXT_PUBLIC_APP_URL   UMAMI_ORIGIN
```

Optional — each has a guard or fallback verified in source, so omitting one
degrades a feature rather than breaking the shop: `SENTRY_AUTH_TOKEN`,
`CJDS_API_KEY`, `CONTACT_EMAIL`, `CONTACT_PHONE_DISPLAY`, `CONTACT_WHATSAPP`,
`MAIL_FROM_ADDRESS`, `RESEND_FROM_ADDRESS`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`.

> **The live container currently carries 67 variables and the code reads 25.**
> 36 of the unread ones are credentials that have no business in a public web
> container. Fix this during the migration — do not copy them forward.

## Database migrations

Forward-only, numbered, in `supabase/migrations/`. Prove the set still
reproduces production before relying on it:

```bash
bash scripts/verify-migrations.sh
```

`supabase_admin` is the only superuser — `postgres` is not.

## Rollback

```bash
# the previous image is still on the host
docker tag lebon-grace:rollback-20260809 lebon-grace:cx53
# then recreate the container from Coolify
```

No rebuild, no restore. Keep the old service **stopped, not deleted**, until a
real order has completed end to end.

## After the migration (target state)

The git-backed application `m11i6a5ekwhbflhnfb9ipr48` clones `main` and builds
with `build_pack=dockerfile`. `DEPLOYMENT_ID` defaults to a UTC stamp, so
`verify:deploy` keeps working with no extra wiring.

**Before cutting the domain across:**

1. `git rev-list --count origin/main..HEAD` must be `0` — otherwise the cut-over
   is a silent rollback, not a deploy.
2. Rotated secrets entered in the UI.
3. Verified on its throwaway FQDN first.
4. Auto-deploy enabled only after a real order completes.
