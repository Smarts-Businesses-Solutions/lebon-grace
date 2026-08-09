# Lebon Grace — Operations Index

**Last Updated:** 2026-08-09

Not a runbook — a table of contents for everything operational, so you can find
the right document in one hop. The runbooks themselves are linked.

---

## Core documents

| Document | Answers |
|---|---|
| [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) | How to build, deploy, verify and roll back |
| [docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md](docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md) | Why deploys never built from git, and how to finish the fix |
| [docs/QA/ACTORS.md](docs/QA/ACTORS.md) | Who can use the platform and what each can do |
| [docs/QA/BUGS.md](docs/QA/BUGS.md) | Every bug found, with customer impact and its regression test |
| [docs/QA/LESSONS_LEARNED.md](docs/QA/LESSONS_LEARNED.md) | The patterns that produced those bugs |
| [ACTION_PLAN.md](ACTION_PLAN.md) | The 26-item remediation tracker |

## Routine commands

```bash
npm run verify:deploy          # is the live build the one you think it is?
bash scripts/verify-migrations.sh   # does the migration set still reproduce production?
npm run qa:report              # regenerate the derivable QA artifacts
npm run audit:contrast         # WCAG arithmetic over the declared colour pairs
```

## Monitoring

| What | Where | Cadence |
|---|---|---|
| Uptime | `ops/selfhost/scripts/uptime-check.sh`, systemd timer on cx53 | every 2 min → Sentry/GlitchTip |
| Errors | GlitchTip (Sentry protocol) | on event |
| Analytics | Umami, proxied through a `next.config` rewrite | continuous |
| Deploy freshness | `npm run verify:deploy` | every deploy — **not optional** |

## Incident quick reference

**The shop is down.**
1. `docker ps --filter name=lebon-grace` on cx53 — is the container up?
2. If it restarted into the wrong image, check the tag: after a Docker restart,
   host ports can serve the *wrong app*. Restart the container; do not rebuild.
3. Cloudflare **Error 1010** is a bot-signature block returning a uniform 403
   regardless of backend state — the origin may be perfectly healthy.

**Orders are being paid but not appearing in the workshop.**
The Stripe webhook is the only thing that can mark an order real. Check Stripe →
webhook deliveries first. This exact failure was B-7.

**A deploy "succeeded" but nothing changed.**
Expected, until the migration finishes — see the deployment guide's first
caveat. Confirm with `npm run verify:deploy`.

**A Coolify deploy fails in seconds with no build log.**
That is an infrastructure failure, not a build failure. Check
`private_key_id` on the application before reading a line of the Dockerfile.

## Access and credentials

- Coolify SaaS token: `COOLIFY_CLOUD_API_TOKEN` in `supabase.local`
- SSH to cx53: `~/.ssh/hetzner_ed25519`, `root@116.203.242.215`
- `supabase.local` is **append-only** — read the *last* occurrence of a key

**Never `cat` a credential file.** Grep the key name and redact by shape:

```bash
grep -inE "<key>" supabase.local | sed -E 's#[A-Za-z0-9_+/|.-]{28,}#<REDACTED>#g'
```

Delimiter-based redaction fails on PEM bodies, JWTs and base64. This has gone
wrong twice.

## Open operational debt

| Item | Impact |
|---|---|
| Secret rotation outstanding | Live Stripe keys, Supabase service-role key, PATs, one RSA key were exposed in session output |
| 67 env vars in a public web container | 36 unread credentials, incl. `GitHub_PAT_classic` (A-0b) |
| No `middleware.ts` | New API routes are public on creation; already produced the `/api/variants` hole |
| Admin is one shared password | No attribution for order-status changes, which email customers |
