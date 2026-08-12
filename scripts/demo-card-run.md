# Running the money path with a demo card

Proves the whole chain — cart → our checkout → **real Stripe Checkout session** →
demo card → redirect → webhook → order in the database — without charging
anything.

## Why it is set up this way

Two constraints shape it, and both were verified rather than assumed:

**A demo card cannot run on the live shop.** `4242…` is rejected outright in live
mode. Running it there proves only that Stripe rejects test cards.

**Stripe cannot reach the staging app.** cx53's 80/443 are firewalled to
Cloudflare and the staging app has no Cloudflare hostname — its FQDN answers
`000` from outside. So Stripe has nowhere to POST the webhook. `stripe listen`
forwards events from Stripe to a local port instead, which is why this runs
against a local server rather than staging.

## What it does and does not prove

Proves: the redirect works, metadata survives the round trip to Stripe and back,
the signature verifies, the webhook writes an order with the status every other
surface filters on, and the phone from our own form wins over Stripe's empty one.

Does **not** prove: that the *live* keys and *live* signing secret are correct.
The live keys and webhook endpoint have been verified to authenticate
(`acct_1SqVU2Pb9MPAYUIq`, charges and payouts enabled, endpoint enabled at
`shop.lebon-grace.com/api/stripe-webhook`), so what remains is the live signing
secret. Only one real card closes that.

## The one thing needed from you

A **test-mode secret key** — `sk_test_…`, from the Stripe Dashboard with the
test/live toggle set to test. Nothing else: the publishable key is unused (the
server creates the session and the browser is redirected to `session.url`), and
`stripe listen` prints its own webhook secret.

Keep it out of your shell history — put it straight into `.env.local`, which is
gitignored.

## Steps

**1. Open a tunnel to the staging database** (its ports bind to 127.0.0.1 on
cx53 by design, so it is not reachable otherwise):

```bash
ssh -i ~/.ssh/hetzner_ed25519 -N -L 8000:127.0.0.1:8000 root@116.203.242.215
```

**2. Put the test key and the staging database into `.env.local`.** The staging
values are in `supabase.local` under the staging block:

```
STRIPE_SECRET_KEY=sk_test_...
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_SERVICE_ROLE_KEY=<the staging service role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**3. Start the webhook forwarder.** `--api-key` avoids the interactive browser
login, and the secret it prints is the one the app must use:

```bash
stripe listen --api-key sk_test_... --forward-to localhost:3000/api/stripe-webhook
```

Copy the `whsec_…` it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then
start the app in a third terminal:

```bash
npm run dev
```

**4. Run it.** The spec is opt-in — without `DEMO_CARD_RUN` it skips itself, so
it can live in the suite without breaking CI, which has none of this:

```bash
DEMO_CARD_RUN=1 STAGING_REST_URL=http://127.0.0.1:8000/rest/v1 STAGING_SERVICE_KEY=<staging service role key> npx playwright test tests/e2e/money/demo-card-purchase.spec.ts --project=desktop
```

`--project=desktop` matters. The suite runs three device projects, so without it
this makes **three** purchases and writes three orders. One is the point.

## Reading the result

A pass means the money path works. The assertion that matters is the last one:
everything before it proves a customer can pay, and only that one proves the
shop found out.

`no order was created for cs_… — the webhook never wrote it` means the chain
broke after payment. Check the `stripe listen` terminal: it prints every event
and the status your endpoint returned. A `400` there is a signing-secret
mismatch — the commonest launch failure, and the reason the webhook logs a hash
of the secret in use when verification fails.

## Afterwards

Delete `.env.local` or at least the key from it, and stop `stripe listen`. Test
keys are far less dangerous than live ones, but the habit is what keeps the live
ones safe.
