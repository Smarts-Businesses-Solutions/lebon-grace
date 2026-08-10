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

### Server errors reach GlitchTip — and that is guarded (B-31, fixed)

For the whole life of this project `Sentry.init` never ran on the server:
`instrumentation.ts` was at the repo root, and because this app uses `src/app`
the hook must be **`src/instrumentation.ts`**. Next ignores a root-level file in
that layout without any warning. GlitchTip stayed populated by the browser
bundle and the uptime check, so its not being empty proved nothing.

`npm run build` now **fails** if the compiled Sentry init is missing from the
standalone output. That is a proxy for "the chain is intact", not proof of
delivery.

### Proving an event reached GlitchTip, without GlitchTip access

`SENTRY_DEBUG=1` makes the app report the ingest's own status code to stdout, so
`docker logs` answers the question. Use it when you need certainty rather than
inference — after a Sentry upgrade, a DSN change, or any doubt that reporting
still works.

```bash
# add SENTRY_DEBUG=1 to the compose env, then
cd /data/coolify/services/lixqbqbkz39l0bnz9xv2227t
docker compose up -d --force-recreate --no-deps lebon-grace

curl -X POST -H 'Content-Type: application/json' -d '{}'   https://shop.lebon-grace.com/api/stripe-webhook          # 400, creates nothing

docker logs --since 2m lebon-grace-lixqbqbkz39l0bnz9xv2227t | grep sentry-transport
#   [sentry-transport] accepted, status=200
```

Then **remove the variable and recreate again** — it is verbose and prints on
every event.

Two things it also proves, which nothing else here does: `Integration installed:
CaptureConsole` and `SDK successfully initialized` appear in the same output, so
a silent B-31 regression is visible immediately.

It is a runtime variable, so flipping it costs a container recreate, not a
rebuild. `debug` alone was not enough — it logs startup but nothing per event,
which is why the transport is wrapped.

For proof of delivery, count envelopes:

```bash
NEXT_PUBLIC_SENTRY_DSN="http://abc123@127.0.0.1:9999/1" npm run build
node scripts/prove-sentry-init.mjs     # exit 0 = an event actually left the server
```

`NEXT_PUBLIC_*` are inlined, so the DSN must be set for the **build**. The proof
runs from an isolated copy of `.next/standalone` with no parent `node_modules`,
because a local run inside the repo resolves externals the container does not
have — that mistake shipped a crash-looping image once (L-26).

> **Never repair this by copying build artefacts into `.next/standalone`.** It
> was tried and crash-looped the container on a missing external. Fix the input.

Edge-runtime init is not covered by that proof.

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

## What is left, and what it needs

Every audit finding settleable in code is fixed and deployed. Four remain, each
blocked on a decision rather than on effort — options, trade-offs, a
recommendation and the single question that unblocks each are in
[`docs/QA/REMAINING_WORK.md`](docs/QA/REMAINING_WORK.md).

In short: **AD-02** identity (will anyone besides you use `/admin`?), **OP-02**
engraving read-back (has one ever been cut wrong?), **TR-03** (wants a staging
database, not more automation), and **#19/#20** (commercial briefs).

## Open operational debt

| Item | Impact |
|---|---|
| **`RESEND_API_KEY` rotation outstanding** | 30 of its 36 characters were printed in session output on 2026-08-10. E-mail delivery works, so rotate deliberately: create the replacement, update `buildenv.txt` **and** the compose file, recreate the container, prove a send still arrives, and only then revoke the old key. |
| Other secrets exposed in session output | Live Stripe keys, Supabase service-role key, PATs, one RSA key. Rotate on the same pattern as the Resend key above. |
| **Redact env vars by LENGTH, never by pattern** | `sed 's/.*@//'` leaves a value with no `@` completely intact. That is how `RESEND_API_KEY` leaked on 2026-08-10: the redaction assumed an e-mail shape and the value was an API key, so `cut -c1-30` printed 30 of its 36 characters. Print `${#VAL}` and nothing else. |
| 67 env vars in a public web container | 36 unread credentials, incl. `GitHub_PAT_classic` (A-0b) |
| ~~No `middleware.ts`~~ | **Closed 2026-08-09.** `src/proxy.ts` denies any unlisted `/api/*` path with a 404, and a test fails the build if a route exists without being listed. Produced the `/api/variants` hole (B-25) before that. |
| Admin is one shared password | No attribution for order-status changes, which email customers |

## Backups

Nightly `backup-cx53.timer` → restic → Cloudflare R2 (14 daily / 8 weekly / 36
monthly, self-checking with `restic check --read-data-subset=2%`).

**It backs up only the stacks listed in `STACK_REFS` inside
`/usr/local/bin/backup-cx53.sh`.** Not in the list = not backed up, and the run
still exits 0 with a green heartbeat.

**lebon-grace was not in that list.** Confirmed 2026-08-10 by counting dumps in
the repository, not by reading the config: the latest snapshot held exactly two
`.dump` files for exactly two refs, and this shop's was not among them — so a
shop taking live Stripe payments had never had its database backed up. Ref
`ezkokajmmqcv8bw8jy970l91` added; the next snapshot carried three dumps, and the
copy pulled back out of R2 was confirmed readable by `pg_restore` with `orders`,
`order_items`, `products`, `product_reviews` and `newsletter_subscribers` in it.

Two traps when checking this: dumps are named `<ref>.dump` rather than by
project, so searching for "lebon" finds nothing either way; and `pg_restore` is
not installed on the host, so inspecting a dump from there silently reports zero
tables. Verify inside the db container.

## What the operator is told about

Every alert goes to `ORDER_NOTIFY_EMAIL`, falling back to `CONTACT.email`.
`ORDER_NOTIFY_EMAIL` is currently **unset in production**, so the fallback is
what is actually in use.

> **Delivering as of 2026-08-10, and proven rather than assumed.** Until that
> date the sending domain was unverified, so every e-mail the shop had ever
> attempted came back 403 — and the code reported success, because the Resend
> SDK returns errors instead of throwing (B-30). A seeded review alert has since
> been confirmed `delivered` end to end, and a refusal is now logged with the
> provider's own message rather than mistaken for a delivery.

| Event | Channel |
|---|---|
| Order paid | E-mail with the pieces to cut, plus a one-tap WhatsApp button to the customer |
| Refund | E-mail — amount returned vs charged, flagged when partial, "stop work on it" |
| Refund with **no matching order** | E-mail — the only signal that will ever exist for it |
| Paid order with **no line items** | E-mail naming the Stripe session to repair by hand |
| New review published | E-mail with the rating and the comment; reviews go live unmoderated |
| Any server `console.error` | GlitchTip issue |

**Deliberately not alerted:** newsletter signups (visible on the admin
subscribers page; one e-mail each would be noise) and failed admin logins
(rate-limited by A-21 — an alert per attempt is a self-inflicted flood).

Alerts are **fire-and-forget**. `sendOperatorNotice` resolves `false` rather
than throwing, so a mail outage can never fail a Stripe webhook — a failed
webhook is retried, and the retry hits the idempotency guard and does nothing.
The trade is explicit: an undelivered alert is silent. GlitchTip is the backstop.

### Checking it still works

There is no synthetic notification test in production, because sending real mail
to prove mail works costs a real e-mail every run. The unit tests hold the
wiring (`src/lib/email.test.ts`, `route.test.ts` in the webhook and reviews
routes). To check the live path end to end, refund a 1 AED test payment in the
Stripe dashboard and confirm the e-mail arrives.

## WhatsApp to customers — PARKED by decision (2026-08-10)

> **Not being worked on.** Deliberately deferred, not forgotten. The operator can
> already message any customer in one tap from the new-order alert email, which
> covers the need at current volume — and enabling the API properly costs Meta
> onboarding plus template approval (below). Revisit when order volume makes
> manual messaging tedious, or when a template is wanted for shipping updates.

### What it would take, if picked up

`WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are **unset**, so
`sendWhatsAppMessage()` returns false and no customer WhatsApp is ever sent.
(`CONTACT_WHATSAPP` is a different thing — the shop's own number for `wa.me`
links on the site.)

**The trap: obtaining credentials is necessary but not sufficient.**
`src/lib/whatsapp.ts` sends `type: "text"` — a *free-form* message. Meta only
delivers free-form messages inside a **24-hour customer service window** that the
customer opens by messaging or calling the business first. An order confirmation
is **business-initiated**, so for most customers no window is open and the send
is rejected. Business-initiated messages require a **pre-approved template**
(`type: "template"`).

So enabling this is three pieces of work, not one:

1. **Meta onboarding** — a Business account, a WhatsApp Business Platform app, and
   a phone number not already registered to the consumer WhatsApp app. Take the
   **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`, and a permanent token from a
   System User → `WHATSAPP_ACCESS_TOKEN`.
2. **Message templates**, submitted to Meta for approval — utility category for
   order confirmed / shipped / out for delivery / delivered. Approval is not
   instant and templates can be rejected.
3. **A code change** in `sendWhatsAppMessage()` to send `type: "template"` with
   the template name and parameters, keeping `type: "text"` only for replies
   inside an open window.

**Until then, the operator alert carries the link.** `notifyWhatsApp()` already
produced a manual `wa.me` link and then `console.log`ged it, while both callers
discarded the return value — so it reached a server console nobody reads: the
customer got no message and the operator was never told. As of 2026-08-10 the
new-order alert email contains a **"Message the customer on WhatsApp"** button
plus a line saying automatic sending is off. That line is driven by the
environment, so it stops appearing the day the credentials are added.
