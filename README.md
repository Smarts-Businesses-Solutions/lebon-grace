# Lebon Grace

Hand-made laser-cut wooden puzzles, made to order in Dubai and sold to UAE
consumers. Next.js 16 storefront with live Stripe payments, a self-hosted
Postgres behind it, and a workshop console that tells the maker what to cut.

---

## Start here

| If you want to | Read |
|---|---|
| Understand the whole system | [FOR-EVARISTE.md](FOR-EVARISTE.md) — the guided tour, 15 sections |
| Deploy or roll back | [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) |
| Find an operational document | [OPERATIONS.md](OPERATIONS.md) |
| Know why something is the way it is | [DECISIONS.md](DECISIONS.md) |
| See what shipped and what is in flight | [PROGRESS.md](PROGRESS.md) |
| Know what is next | [whatnext.md](whatnext.md) — the ranked queue · [ENHANCEMENTS.md](ENHANCEMENTS.md) — parked ideas |
| Change how it looks | [DESIGN.md](DESIGN.md) |
| Know who can do what | [docs/QA/ACTORS.md](docs/QA/ACTORS.md) |

## Develop

```bash
npm install
cp .env.example .env.local     # then fill it in — see DEPLOYMENT-GUIDE.md
npm run dev                    # http://localhost:3000
```

Six environment variables are genuinely required: `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET`. The rest degrade a feature rather than breaking the shop.

## Verify

```bash
npx tsc --noEmit          # types
npx vitest run            # 276 unit tests
npx eslint src/           # must be 0
npx playwright test       # 231 tests across 3 viewports, incl. axe-core
npm run verify:deploy     # did a deploy actually reach production?
```

> **CI runs on Forgejo, not GitHub.** `kairos/lebon-grace` on the cx53 Forgejo
> is a pull mirror of this repo (10-minute interval); a sync fires
> `.forgejo/workflows/ci.yml` — lockfile gate, typecheck, unit, lint, build,
> Playwright × 3 viewports. So a push is checked **within about ten minutes**,
> not instantly, and the result is not visible on GitHub: there is no
> `.github/workflows` and no git hooks. The `Vercel` check you may see failing
> on a PR is a dead integration and carries no signal.
>
> Run the commands above yourself before pushing if you want the answer now.
> See [DECISIONS.md](DECISIONS.md) D-014 — and D-013 for why this had never run
> at all until 2026-08-09.

## Deploy

Self-hosted. Not Vercel, not Supabase cloud, not Hostinger.

The app runs as a Docker container on a Hetzner **cx53** (`116.203.242.215`)
behind Coolify's Traefik proxy, with Postgres reached through PostgREST.
Analytics go to a self-hosted **Umami**; errors to GlitchTip.

> **Read the deployment guide before deploying.** The app is registered in
> Coolify as a *service*, not a git-backed application, so "Deploy" recreates the
> container from an image built by hand — it does not build from source. That is
> being fixed; see [docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md](docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md).

The public shop is **`shop.lebon-grace.com`**. `lebon-grace.com` is a different
site entirely.

## A note on stale history

Earlier revisions of this file described a Hostinger deploy backed by a JSON
store at `.data/store.json`, and later a Caddy/SSH-tunnel setup with PostHog.
Neither is how anything works now: the JSON store was replaced by Postgres, the
Hostinger move was abandoned, PostHog was purged, and the estate moved to
Coolify. If a document here disagrees with the deployment guide, the deployment
guide is newer.
