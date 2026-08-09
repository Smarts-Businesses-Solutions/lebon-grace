# Lebon Grace — Technical Guide for Evariste

**Last updated:** 2026-08-09 · Written to the standard in `.claude/skills/teacher/SKILL.md`.

---

## 1. TL;DR

A small e-commerce shop that sells hand-made laser-cut wooden puzzles, made to
order in Dubai, to UAE consumers, taking **live card payments**. Next.js 16 in a
container on a Hetzner box, Postgres behind it, Stripe for money, Resend for
email.

**Where the important parts live:**

| Thing | File |
|---|---|
| The money path | `src/app/checkout/page.tsx`, `src/app/api/checkout/route.ts` |
| The only code that can mark an order paid | `src/app/api/stripe-webhook/route.ts` |
| Every database read/write | `src/lib/store.ts` |
| Who is allowed to do what | `src/lib/admin-auth.ts` (all 3 lines of it) |
| The catalogue | `src/lib/products.generated.ts` (generated — do not hand-edit) |

**Main risk areas, honestly:** the checkout page (it has already told customers
"Order Confirmed" when nothing was charged), the webhook (double-processing), and
the fact that any new file under `src/app/api/` is public the moment it exists.

## 2. The Story

**The problem.** Selling something hand-made needs a shopfront that takes money
reliably and tells the workshop what to cut. Both halves have to be right: a
payment that succeeds but produces no work order is just as broken as one that
fails.

**The user.** Someone in the UAE buying a AED 15 personalised wooden puzzle for
a child, usually on a phone, usually once. Not a returning power user.

**What success looks like.** They pay, they get an email, the piece appears in
the workshop queue, they can check on it later with their phone number, and
after delivery they can leave a review.

**Out of scope, deliberately:** customer accounts, wholesale/B2B, marketplaces,
subscriptions. Arabic/RTL is wanted but deferred until the site is stable
(`docs/DECISION-ARABIC-RTL.md`).

## 3. Mental Model

Think of it as **a shop with a workshop behind it and a letterbox between them**.
The shop (the website) never makes anything — it takes an order and posts it
through the letterbox. The letterbox is the Stripe webhook: it is the *only* way
work arrives in the workshop. If the letterbox jams, the shop keeps selling and
the workshop stays idle, and nobody notices unless something is watching. That is
exactly the bug B-7 turned out to be.

## 4. Architecture

```
        Customer's phone
              │
              ▼
        Cloudflare
              │
              ▼
    coolify-proxy (Traefik)  ── on Hetzner cx53, ~128 containers
              │
              ▼
  ┌───────────────────────────┐
  │  lebon-grace container    │   Next.js standalone, :3000
  │  ─────────────────────    │
  │  Server Components  ──────┼──▶ Supabase / PostgREST  (catalogue, orders, reviews)
  │  Route handlers     ──────┼──▶ Stripe               (create session)
  │                     ──────┼──▶ Resend               (order email)
  │                     ──────┼──▶ umami:3000           (analytics, via rewrite)
  └───────────────────────────┘
              ▲
              │  POST /api/stripe-webhook  (signature-verified)
        Stripe servers
```

**What runs where.** Rendering and every database call happen **server-side** in
the container — the browser never talks to Postgres, and there is no anon key in
the bundle. The cart is the exception: it lives in the browser's `localStorage`
until checkout. There are no background jobs; the only asynchronous actor is
Stripe calling the webhook.

## 5. Codebase Tour

```
src/
  app/                     # routes — folder name == URL
    page.tsx               # home
    shop/[slug]/page.tsx   # product page
    checkout/page.tsx      # ⚠ the money path — read section 8 before touching
    admin/page.tsx         # workshop console (cutting queue, orders, products)
    track/ account/ review/# customer self-service
    api/                   # 13 route handlers; each decides its OWN auth
  lib/
    store.ts               # ⭐ every DB read/write. Start here.
    products.generated.ts  # the catalogue — GENERATED, do not hand-edit
    cart-context.tsx       # cart + delivery choice, persisted to localStorage
    email.ts               # templates; an unmapped status sends NOTHING on purpose
    admin-auth.ts          # HMAC session cookie; `role === "admin"` is the model
    rate-limit.ts          # DB-backed, survives a deploy
supabase/migrations/       # forward-only SQL, numbered
tests/e2e/                 # Playwright: navigation, money-path, failure-modes, mobile, a11y
scripts/verify-deploy.mjs  # proves a deploy actually reached production
```

**If you want to change X, go here:**

| Want to change | Go to |
|---|---|
| A price or product | Postgres, then regenerate `products.generated.ts` |
| What an order email says | `src/lib/email.ts` — `TEMPLATES` |
| Delivery cost / free threshold | `src/lib/cart-context.tsx` **and** `email.ts` (they must agree) |
| Order statuses | six places — grep first, see B-7 |
| Anything about who can access what | `src/lib/admin-auth.ts` + the route's own guard |

## 6. Tech Stack & Why

| Choice | Why | Trade-off accepted |
|---|---|---|
| **Next.js 16, App Router** | Server Components keep DB credentials server-side by default | `output: "standalone"` means `next start` does not work — the container runs `.next/standalone/server.js` |
| **Postgres via Supabase (self-hosted)** | Real constraints, real foreign keys; no vendor lock | We operate it |
| **Stripe Checkout (redirect)** | Card data never touches our servers | A redirect leaves the site, so the return path needs handling — missing that was B-2 |
| **Tailwind 4** | Design tokens in one place, which made the contrast audit mechanical | Utility soup if undisciplined |
| **Alpine base image** | glibc + sharp needs allocator tuning this host can't afford | musl edge cases |

**Deliberately not chosen:** customer accounts (section 7), an ORM (`store.ts`
is thin and explicit), a CMS (the catalogue is generated from Postgres), and
Vercel (the account is blocked; the estate is self-hosted).

## 7. Key Decisions

**No customer accounts.** A AED 15 impulse purchase does not justify a signup
step, and an account that never exists cannot leak, be credential-stuffed, or
need a reset flow. The cost is that identity is re-established per lookup, using
a phone number plus an order id or email. Full reasoning in `docs/QA/ACTORS.md`.

**Constraints pushed into the database.** A status `CHECK`, non-negative money,
`UNIQUE(order_id, product_slug)`, and a foreign key making "every review is
backed by a real order" *structural* rather than a promise a later edit can
forget. Note the sharp edge: a `CHECK` evaluates to *unknown* on `NULL` and
therefore **passes**, so every one needs a `NOT NULL` beside it.

**Silence is a valid output.** `email.ts` sends nothing for an unmapped status.
The previous `|| statusMap.confirmation` fallback guaranteed *something* was
sent, which is how refunded customers were told their order was confirmed.

**Version-skew protection.** `DEPLOYMENT_ID` becomes `?dpl=` on every asset, and
`verify:deploy` reads it back off the live site. It is the only first-hand
evidence that a deploy reached production.

## 8. Implementation Walkthrough — one full journey

Buying a puzzle, end to end:

1. **Browse.** `/shop` renders server-side from `products.generated.ts`.
2. **Add to cart.** `cart-context.tsx` writes to `localStorage`. Each line gets a
   `lineId`, so "Board engraved *Amira*" and "Board engraved *Yusuf*" stay
   distinct.
3. **Checkout.** `/checkout` posts to `/api/checkout`, which **re-prices every
   line from the catalogue**. This matters: an item posted without a slug used to
   skip the lookup and carry its own price (B-4). Both failure modes now answer
   400.
4. **Stripe.** We create a session and `location.assign(data.url)`.
5. **Payment.** Stripe charges the card and calls `/api/stripe-webhook`.
6. **The webhook is where the order becomes real.** It verifies the signature,
   checks idempotency *twice* (in-memory and in the database), writes the order
   with status `deposit_paid`, and sends the confirmation email.
7. **Return.** Stripe sends the customer to `/checkout?success=true`. The page
   reads that parameter, confirms, and clears the cart — gated on the cart
   provider being `ready`, because effects run child-before-parent and the two
   used to race.
8. **Workshop.** The order appears in `/admin`'s cutting queue.
9. **After delivery.** The customer can review, but only holding the order id and
   phone, only if it is delivered, and only for products actually in it.

**To extend safely:** if you add an order status, grep for the existing ones
first — there are six places that must agree, and the `CHECK` constraint is one
of them.

## 9. Bugs & Fixes

Twelve are written up in `docs/QA/BUGS.md` with evidence. The two that teach the
most:

**A failed payment said "Order Confirmed."** Both failure branches in
`checkout/page.tsx` called `clearCart()` and `setOrderPlaced(true)`. Symptom: a
confirmation screen and an empty basket after an error. Root cause: the only code
that cleared the cart was the code that ran when checkout *failed* — the two
directions were inverted. Debugging path: found by writing a browser test for the
error path, which nobody had ever exercised. Prevention: two regression tests,
both verified to fail against the original code.

**Paid orders were invisible to the workshop.** The webhook wrote `status:
"paid"` — a value in *none* of the six places that read statuses. Symptom: the
customer's timeline lit no step, and the order appeared in no column of the
queue. Found while writing a `CHECK` constraint and enumerating the real values.
Prevention: the constraint now rejects it.

## 10. Pitfalls & How to Avoid Them

- **Adding an API route is a security decision.** There is no `middleware.ts` —
  a new file under `src/app/api/` is public on creation. This has already bitten:
  `/api/variants?pid=` calls the CJ API on our key with no auth or rate limit.
- **`NEXT_PUBLIC_*` are baked at build time.** Changing one at runtime does
  nothing. Rebuild.
- **Module-scope SDK constructors break the build.** `new Resend(undefined)`
  throws during page-data collection, so builds need placeholder env values.
- **A `CHECK` passes on `NULL`.** Always pair it with `NOT NULL`.
- **`docker exec -i` eats the rest of a piped heredoc.** It inherits stdin.
- **PostgREST aliases `*` to `%`** in `like`/`ilike`, and `_` matches any single
  character. Never interpolate user input into a pattern (B-3).
- **Never `cat` a file that holds credentials.** Grep the key name and redact by
  shape. This has gone wrong twice.

## 11. Testing & Verification

```bash
npx tsc --noEmit          # types
npx vitest run            # 138 unit tests
npx eslint src/           # must be 0 — run it yourself; see D-013, there is no CI
npx playwright test       # 14 routes × 3 viewports + axe-core
npm run verify:deploy     # did the deploy actually reach production?
```

**The house rule:** a test that passes without the fix is decoration. Every guard
here was verified by removing it and watching its own test fail.

**Known gaps**, listed honestly in `tests/fixtures/USER_ACTIONS_INVENTORY.md`:
tracking a real order end-to-end needs a seeded fixture; removing a cart line is
undriven; and nobody clicks the admin status dropdown in a browser.

## 12. How Great Engineers Think

Habits this codebase actually demonstrates:

- **Assert the precondition, or you are asserting nothing.** "X is absent" needs
  a paired assertion proving X could have been present.
- **Measure it now; do not remember it.** A P0 finding here was once derived from
  a value remembered from three days earlier. It was stale, and everything
  downstream of it was wrong.
- **Fix the layer that makes the failure impossible.** A foreign key beats a code
  review comment.
- **A gate that is red on arrival is a gate people learn to ignore** — so lint
  shipped as `|| true` until it was clean, then hardened in the same change.
- **Search the whole repository, not just `src/`.** "Eight order statuses" was
  wrong; the admin dropdown has ten.

## 13. Quickstart

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev                    # http://localhost:3000
```

**Configuration checklist.** Six are genuinely required —
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` — plus the
`NEXT_PUBLIC_*` set at build time. Everything else degrades a feature rather than
breaking the shop. See `DEPLOYMENT-GUIDE.md`.

**First 3 things to check if it's broken:**

1. `npm run verify:deploy` — is the live build the one you think it is?
2. `docker ps --filter name=lebon-grace` on cx53 — is the container up?
3. Stripe dashboard → webhook deliveries — is the letterbox jammed?

## 14. Roadmap

**Small wins.** Gate `/api/variants`. Add a `middleware.ts` that denies
`/api/admin/*` by default. Seed an order fixture so the happy path of tracking
gets tested.

**Medium.** Finish the Coolify service→application migration so deploys build
from git. Cut the container's env surface from 67 variables to 25. Per-user admin
accounts once a second person works the workshop.

**Big.** Arabic/RTL — plausibly a legal obligation for a UAE storefront, and
deferred only until the site is stable. The clearance recount (A-16), blocked on
photographs. EN 71-1 assessment for toys labelled ages 1–3.

## 15. Glossary

| Term | Plain words |
|---|---|
| **`dpl`** | The build id Next stamps on every asset URL. How we prove which build is live. |
| **ISR** | Pages regenerated in the background after a delay, rather than on every request. |
| **Idempotency** | Processing the same webhook twice has the same effect as once. |
| **PostgREST** | The HTTP layer that turns Postgres tables into a REST API. |
| **Standalone output** | Next bundles only the files actually imported, so the image stays small. |
| **Coolify service vs application** | A *service* recreates a container from a fixed image. An *application* clones git and builds. We are moving from the first to the second. |
| **`deposit_paid`** | The status a new paid order gets. Not `paid` — that value appears nowhere else. |
| **Cutting queue** | The `/admin` view telling the workshop what to make today, in what order. |
