# Production environment: what the shop actually needs

The live container carries **56 environment variables**. The application code
reads **19** of them. The other 37 include **24 credentials for services this
shop has nothing to do with** — OpenAI, Anthropic, Shopify, Vercel, Twitter,
Cloudflare, Postiz.

Every one of those is readable by anything that can see the container's
environment: a compromised dependency, a debug endpoint, a stack trace that
dumps `process.env`. None of them is needed to sell a wooden puzzle.

This is the list, and — more importantly — **what was checked before anything
was called dead**, because the first two attempts at this analysis were both
wrong.

## How "unused" was determined, and how it was wrong twice

`grep -rhoE "process\.env\.[A-Z_0-9]+"` over the source. Two mistakes came out
of it:

**First sweep missed the root-level Sentry configs.** `sentry.client.config.ts`,
`sentry.server.config.ts` and `sentry.edge.config.ts` are not under `src/`.
Including them moved `NEXT_PUBLIC_SENTRY_DSN`, `PORT` and `HOSTNAME` from "dead"
to "used". Three variables one directory-glob away from being wrongly deleted.

**A grep cannot see an SDK reading its own convention.** `SENTRY_DSN` never
appears as `process.env.SENTRY_DSN` anywhere, and the Sentry SDK reads it
regardless. So does Next with `PORT` and `HOSTNAME`. **Absence from the source
is evidence, not proof.**

That is why the table below has a *checked* column rather than a verdict.

## Verified relationships

Rather than trust the grep, each suspicious name was compared against the
variable it might be a stale alias of — equality only, no value printed:

| Candidate | Compared with | Result |
|---|---|---|
| `STRIPE_SECRET_KEY_LIVE` | `STRIPE_SECRET_KEY` | **identical** — stale alias |
| `STRIPE_WEBHOOK_SECRET_LIVE` | `STRIPE_WEBHOOK_SECRET` | **identical** — stale alias |
| `SENTRY_DSN` | `NEXT_PUBLIC_SENTRY_DSN` | **identical** — but the SDK reads it implicitly, so **KEEP** |
| `STRIPE_PUBLISHABLE_KEY_LIVE` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **DIFFERENT** — do not assume dead |

That last row is the reason this document exists. Three of four looked alike;
the fourth was not, and deleting it on the pattern would have been a guess
dressed as a cleanup.

## Tier 1 — remove, nothing in this repo can reach them

Credentials for services the shop does not integrate with. No `process.env`
reference, no SDK convention, no alias relationship.

```
ANTHROPIC_API_KEY            KIMI_API_KEY                MINIMAX_API_KEY
MINIMAX_CODE_API_KEY         OPENAI_API_KEY              SHOPIFY_ADMIN_TOKEN
VERCEL_PERSONAL_ACCESS_TOKEN TWITTERAPI_IO_API_KEY       ZERNIO_API_KEY
POSTIZ_API_KEY               POSTIZ_CLI_CLAUDE_CODE_MCP  POSTFORME_ONE_API_KEY
CLOUDFLARE_API_TOKEN         CLOUDFLARE_WORKERS_API_TOKEN CLOUDFLARE_ZONE_NAME
POSTHOG_PERSONAL_API_TOKEN   SENTRY_PAT                  SUPABASE_DB_PASSWORD
```

**18 variables, 17 of them credentials.** Removing them is the single largest
reduction in blast radius available here, and it costs nothing — the shop cannot
call these services because no code references them.

`SUPABASE_DB_PASSWORD` deserves a note: the app reaches Postgres through
PostgREST with a JWT, never with the database password. That password sitting in
the web container buys nothing and would hand over direct database access.

## Tier 2 — remove after a moment's thought

```
STRIPE_SECRET_KEY_LIVE        identical to STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET_LIVE    identical to STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_POSTHOG_KEY       PostHog was decommissioned (A-19b)
NEXT_PUBLIC_POSTHOG_HOST      same
UMAMI_API_URL                 the app posts to UMAMI_ORIGIN, not this
SITE_PASSWORD                 no reference; likely from a pre-launch gate
CRON_SECRET                   no reference; check nothing external posts with it
REVALIDATE_SECRET             no reference; check no webhook uses it
NEXT_PUBLIC_STRIPE_PRICE_HERO / _LEGEND   product ids from a different pricing model
```

The two Stripe `_LIVE` names are safe **because they were compared and found
identical**, not because of the naming. If anything outside this repo reads them
— a script, a webhook, a cron — that is where to look first.

`CRON_SECRET` and `REVALIDATE_SECRET` are the two worth pausing on: both are the
kind of thing an *external* caller presents, and a grep of this repo cannot see
an external caller.

## Tier 3 — keep, despite looking unused

```
SENTRY_DSN          read implicitly by the Sentry SDK
PORT, HOSTNAME      read by Next's server
COOLIFY_*           Coolify's own bookkeeping
SERVICE_NAME_*      Coolify service discovery
NEXT_PUBLIC_SUPABASE_ANON_KEY   public by design; harmless, and RLS assumes it exists
STRIPE_PUBLISHABLE_KEY_LIVE     DIFFERENT from the NEXT_PUBLIC one — investigate before touching
```

## Tier 1 has already been tested — on staging, by accident

Asked to "remove Tier 1 from staging first", the answer turned out to be that
there is nothing to remove: **the staging git app has 0 of the 18.** It was
built from this repository with only the variables someone deliberately set, and
nobody ever set a Shopify token on it.

That makes staging an unplanned but complete experiment. It has been running the
pruned configuration since it was created, and on 2026-08-12, with **zero Tier 1
credentials present**:

| Check | Result |
|---|---|
| `/`, `/shop`, `/cart`, `/checkout`, `/track`, `/account`, `/contact`, `/faq`, `/terms`, `/privacy`, `/review`, `/about` | **all 200** |
| a server-rendered product page | **200** |
| container logs | **no errors, nothing "not configured"** |
| `/api/admin/login` | answers JSON, route intact |

So every one of the 18 can be removed from production without affecting
rendering, routing, the catalogue, or the API surface. That is not an inference
from a grep any more; it is a running container.

**What this does NOT yet prove.** Staging is still missing the eight real
secrets, so the payment, e-mail and database-write paths cannot be exercised on
it. A Tier 1 variable and a missing `STRIPE_SECRET_KEY` are indistinguishable on
those paths today. None of the 18 is plausibly involved — they are keys for
OpenAI, Shopify, Vercel, Twitter — but "not plausible" is weaker than "tested".

Once the eight secrets are in, staging becomes **exactly** the post-prune
configuration: the 19 the code reads and nothing else. Phase 3's real order then
closes the gap, and Tier 1 can come off production with the evidence already in
hand rather than as an experiment on the live shop.

## Doing it safely

Environment changes are not covered by any test, so sequence matters:

1. Remove **Tier 1 only**. Recreate the container. Verify: the shop serves, an
   order can be placed and refunded, an e-mail arrives, `/admin` opens.
2. Wait a week. Anything that breaks from a missing credential tends to break on
   a schedule — a nightly job, a weekly digest — not immediately.
3. Then Tier 2, same verification.
4. **Rotate every Tier 1 credential afterwards.** They have been sitting in a
   web container's environment; removing them does not un-expose them. The
   Resend key was rotated for exactly this reason on 2026-08-11.

Do this on the **staging git app first** if the migration is still in flight —
it is the same image with none of the consequences.

## The number that matters

**56 → 19.** The shop needs nineteen variables. Everything else is either
Coolify's bookkeeping or a key for a service the shop has never called.
