# Lebon Grace — Technical Guide for Evariste

**Last updated:** 2026-08-19 · Written to the standard in `.claude/skills/teacher/SKILL.md`.

---

## 1. TL;DR

A small e-commerce shop that sells hand-made laser-cut natural raw MDF puzzles,
made to order in the United Arab Emirates, to UAE consumers, taking **live card payments**. Next.js 16 in a
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

**The user.** Someone in the UAE buying a AED 15 personalised raw MDF puzzle for
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
    rate-limit.ts          # IN-MEMORY, resets on deploy. login-throttle.ts is the DB-backed one
    artwork.ts             # re-encodes an upload into a JPEG we made ourselves
    design-requests.ts     # the photo/logo conversation (section 19)
supabase/migrations/       # forward-only SQL, numbered
tests/e2e/                 # Playwright: navigation, money-path, failure-modes, mobile, a11y
scripts/verify-deploy.mjs  # proves a deploy actually reached production
scripts/deploy-cx53.sh     # build origin/main on cx53, swap the container, verify
scripts/sweep-expired-artwork.mjs  # deletes customer artwork past its 90 days
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

Twenty-eight are written up in `docs/QA/BUGS.md` with evidence. The two that
teach the most:

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

### What the 2026-08-09/10 role walkthroughs added (B-21 … B-32)

Six roles were driven through the live site — returning customer, reviewer,
newsletter subscriber, admin, operator — one at a time, asking "what can this
person actually do, and does it work?". Six findings worth carrying:

**A credential that got weaker the less you typed.** The phone half of the
order lookup compared `ca.endsWith(cb.slice(-8))`. `slice(-8)` of a *short*
string is the whole string, so `"7"` matched any number ending in 7 — and
exactly one digit matches, so **ten guesses beat a ten-per-hour rate limit**.
The general rule: *any comparison whose strictness depends on the length of the
input is controlled by whoever supplies the input.* Fix the window; refuse to
compare below it (B-21).

**Green tests next to a broken build.** 201 unit tests passed the whole time
`next build` was failing, because `email.test.ts` mocks `resend` — so the
module-scope `new Resend(...)` that broke the build never ran in the suite. *If
your test replaces the thing that would have failed, it is not testing that
thing.* (B-25's sibling; see L-17.)

**A repository that could not build itself.** `playwright.config.ts` imported
`../ops/qa/…` — a path *outside* the repo, present only on this workstation. The
216-test E2E suite had never been runnable on any other machine. A green suite on
the author's machine says the author's machine works (L-18).

**The alert that was never wired up (B-29).** Asking "is the operator told about
everything that happens?" turned up three `console.error` calls treated as the
alarm — one of them explaining, in a comment, that `console.error` reaches
GlitchTip. It does not, unless `captureConsoleIntegration` is configured, and it
never was. So B-18's *paid order with nothing to cut* had been reporting to
nobody while the code, a comment and a BUGS entry all said it was loud. Same
shape as the CI pipeline that had never run and the backup that never covered
this database: **a mechanism producing no output looks exactly like a healthy
one.** Four events now e-mail the operator; the reasoning is L-22.

**Three mechanisms that reported success while doing nothing (B-29 … B-32).**
Asking "is the operator told about everything?" turned up a chain where *every
link* was broken and *every link looked fine*:

- `console.error` was believed to reach GlitchTip. It doesn't unless you
  configure `captureConsoleIntegration` (B-29).
- Every e-mail the shop ever sent was refused with a 403, and returned `true`,
  because the Resend SDK resolves `{data, error}` instead of throwing (B-30).
- `Sentry.init` had never run at all, because `instrumentation.ts` was at the
  repo root while the app uses `src/app` (B-31).
- And the webhook's "hashed" fingerprint was six literal characters of the
  signing secret (B-32).

Four separate faults, one shape: **the failure mode of a reporting mechanism is
silence, and silence is also what success looks like.** Each was found by asking
"did the thing that was supposed to happen, happen?" — an e-mail delivered, an
envelope received — never by reading the code, which looked right every time.

**Documented is not fixed.** `/api/variants` was written up in *two* documents as
the textbook example of "a new API route is public on creation" — and stayed open
for months, an unauthenticated proxy onto a metered paid API (B-25). The CI
workflow was described in four documents as the quality gate while never having
executed once. Writing a hole down does not close it.

The last one is the reason this guide is worth keeping honest: a document that
describes a problem in the present tense, after it is fixed, sends the next
reader hunting for something that is not there. Several files were corrected in
that pass for exactly that reason.

## 10. Pitfalls & How to Avoid Them

- **Adding an API route is a security decision** — and since 2026-08-09 the
  default enforces it. `src/proxy.ts` answers **404** for any `/api/*` path not
  listed in it, and `src/proxy.test.ts` fails the build if a route exists on
  disk without an entry, so you find out before anyone else can reach it. Before
  that, a new file under `src/app/api/` was public the moment it was created. This has already bitten:
  `/api/variants?pid=` called the CJ API on our key with no auth or rate limit.
  **Closed 2026-08-09** by deleting the passthrough rather than gating it: no
  product carries a `cjPid`, so it served nobody but an attacker, and the
  dropship model it belonged to was abandoned. A gate on dead code is a thing
  to maintain; deletion is not.
- **`console.error` does not reach your error tracker unless you say so.**
  Sentry's `captureConsoleIntegration` is opt-in. Without it a `console.error`
  is only a *breadcrumb* — attached to some later event, and thrown away if no
  later event happens. This code carried a comment saying the opposite
  ("console.error so it reaches GlitchTip"), and I believed it three times
  before checking. **Fixed 2026-08-10** (B-29): the integration is configured at
  `error` level, and the four events that mattered — refund, refund with no
  matching order, paid order with no line items, new review — now also send the
  operator an e-mail. The wider lesson is L-22: *a comment asserting that
  something works is not evidence that it does*, and a considered-looking
  comment is believed more readily, not less.
- **`sampleRate` and `tracesSampleRate` are different things.** `sampleRate`
  governs **errors**; `tracesSampleRate` governs **transactions**. Both configs
  had `sampleRate: 0.25`, one of them under a comment about request volume — so
  three of every four real errors were discarded to control something the other
  setting controls.
- **`void somePromise` is one edit away from killing the process.** It attaches
  no rejection handler, and Node terminates on an unhandled rejection. In a
  Stripe webhook that is worse than it sounds: a failed webhook is retried, and
  the retry hits the idempotency guard and does nothing. Fire-and-forget calls
  carry an explicit `.catch`.
- **`NEXT_PUBLIC_*` are baked at build time.** Changing one at runtime does
  nothing. Rebuild. That is also why the Sentry DSN must be present for the
  *build*, not just the run — set it at runtime and Next has already inlined
  `undefined`.
- **If you use `src/`, `instrumentation.ts` must be `src/instrumentation.ts`.**
  Ours sat at the repo root, so Next silently ignored it and `Sentry.init` never
  ran — for the entire life of the project. No warning anywhere. If you ever ask
  "why is nothing being reported", check that file's folder first (B-31).
- **Check whether it works in ANY configuration before explaining why it fails
  in one.** I spent two attempts blaming `output: "standalone"` and Turbopack,
  with evidence that all fitted. Running the same test against `next start` —
  two minutes — showed it failed there too, so standalone was never the
  variable. Measuring only inside your hypothesis can never contradict it
  (L-27).
- **"It works locally" is a different claim from "it works in the image."** A
  fix that passed a real behavioural test — fake Sentry ingest, envelope counted
  — still crash-looped production, because I ran the standalone server from the
  project root where Node walks up into the full `node_modules`. The container
  has only the pruned copy. Run the proof against the artefact you ship (L-26).
- **A library that returns errors instead of throwing will lie to a
  `try/catch`.** `Resend.emails.send` resolves `{data, error}`. Every send path
  here was written for throw-on-error, so a 403 came back as success and the
  shop's e-mail silently did nothing for months (B-30). Check the error
  convention of anything you `await`; the installed `.d.ts` answers it in
  seconds.
- **Module-scope SDK constructors break the build.** `new Resend(undefined)`
  throws during page-data collection — Next evaluates every route module at build
  time — so the *build* ends up needing runtime secrets. **Fixed 2026-08-09:**
  clients are constructed lazily (`mailer()` in `src/lib/email.ts`, matching
  `db()` in `store.ts`), so no placeholders are needed. Build SDK clients inside
  a function, never at module scope. Worth knowing how it was found: 201 unit
  tests were green the entire time it was broken, because `email.test.ts` mocks
  `resend` and a mock is registered before resolution, so the real constructor
  never ran. The bug lived in the gap between "unit tests pass" and "it builds",
  which is why `module-import-safety.test.ts` deliberately mocks nothing.
- **A `CHECK` passes on `NULL`.** Always pair it with `NOT NULL`.
- **`docker exec -i` eats the rest of a piped heredoc.** It inherits stdin.
- **PostgREST aliases `*` to `%`** in `like`/`ilike`, and `_` matches any single
  character. Never interpolate user input into a pattern (B-3).
- **Never `cat` a file that holds credentials.** Grep the key name and redact by
  shape. This has gone wrong twice.

## 11. Testing & Verification

```bash
npx tsc --noEmit          # types
npm run typecheck:e2e     # the E2E harness — the line above does NOT cover it
npx vitest run            # 276 unit tests
npx eslint src/           # must be 0
npx playwright test       # 231 tests × 3 viewports + axe-core
npm run verify:deploy     # did the deploy actually reach production?
```

**CI runs these on every push** — on Forgejo, not GitHub, within about ten
minutes of a push reaching `main` (D-014). It had never executed once until
2026-08-09 (D-013), which is why an earlier version of this section told you to
run them yourself.

Run them yourself anyway before pushing. Three consecutive CI rounds were burned
discovering one failing step at a time, each costing six minutes to learn
something ninety seconds would have shown (L-19).

`typecheck:e2e` is listed separately because `tsc --noEmit` genuinely does not
cover it: `tsconfig.json` excludes `ops/qa`, `playwright.config.ts` and `tests/**`
so the app build does not choke on code it does not own, and Playwright
transpiles specs without type-checking them. That gap existed, unnoticed, until
CI ran.

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

**Small wins.** ~~Gate `/api/variants`~~ (done — the passthrough is deleted).
~~Add a `middleware.ts` that denies~~ (done — `src/proxy.ts`; Next 16 renamed
the convention). Formerly: deny
`/api/admin/*` by default. Seed an order fixture so the happy path of tracking
gets tested.

**Medium.** Finish the Coolify service→application migration so deploys build
from git. Cut the container's env surface from 67 variables to 25.
~~Per-user admin accounts once a second person works the workshop~~ (done —
`ADMIN_USERS`, see §15). A staging database, so the returned-order lifecycle
can be tested without writing to the live shop (TR-03).

**Big.** Arabic/RTL — plausibly a legal obligation for a UAE storefront, and
deferred only until the site is stable. The clearance recount (A-16), blocked on
photographs. EN 71-1 assessment for toys labelled ages 1–3.

## 15. Who did that? — named operators, and why the password lives in an env var

This is the newest piece of the system and the one with the most reasoning
packed into the smallest amount of code, so it is worth walking through properly.

### The problem

The audit trail records *what* changed and *when*. It could not record *who*,
because there was one shared password — so "the admin" was the only possible
answer, and it was the same answer for everyone. With two people working the
shop, "who cancelled this order?" had no answer at all.

Notice what the earlier migration did about that. It shipped the table with
**no `actor` column**, and said so in its own comment. That is the instinct
worth stealing: an empty column you would have to fill with a guess is worse
than a column that does not exist, because the guess looks like a record.

### Where credentials live, and why it is not the database

The obvious design is a table — `admin_users`, one row per person, add and
remove through the UI. It was rejected, and the reason generalises far beyond
this project:

> **A login that depends on the database stops working when the database does.**

Think about when you actually open `/admin` in a hurry. Something is wrong. An
order is stuck, a customer is asking, you need to see what happened. If Supabase
is having a bad morning, a database-backed login locks you out during precisely
the incident you needed it for.

So the credentials live in the environment — read once at startup, from a
variable, with no network call anywhere in the login path.

This is not a comforting theory. The test that verified the feature ran against
a server with **no database configured at all**; its logs say
`[store] Supabase not configured`, and the login worked anyway. That is the
property, demonstrated rather than asserted. When you make a design claim, look
for the test that would embarrass you if it were false.

### What is actually stored

```
ADMIN_USERS="you@example.com:<salt>$<hash>"
```

No passwords — hashes. A hash is a one-way transformation: easy to compute
forwards, infeasible to reverse. Given the hash you cannot recover the password,
which is why the file is safe to hold this and would not be safe to hold the
password itself.

Two details matter more than they look:

**The salt.** Random text mixed in before hashing, different per person. Without
it, two people who chose the same password would have identical hashes — which
leaks that fact, and lets an attacker crack both at once.

**scrypt, not SHA-256.** A general-purpose hash is designed to be *fast*, which
is exactly wrong here: fast means an attacker with your leaked env can try
billions of guesses. scrypt is deliberately slow *and* memory-hungry, so guessing
at scale costs real hardware. It is built into Node, so this cost nothing in
dependencies — and the auth path is the last place you want a supply chain.

### The bug that nearly shipped

The natural way to write the check is: hash what they typed, compare against
each stored hash, and if any matches, let them in.

That authenticates correctly. It also **attributes the action to the wrong
person** — because it never checked that the matching hash belongs to the
address they claimed. Bob's password against Alice's e-mail logs Bob in *as
Alice*, and everything he does is filed under her.

An audit trail that names the wrong person is worse than one that names nobody,
because it gets believed. The e-mail has to be part of the comparison, not a
label dropped once a match is found. There is a test that fails if it ever is,
and it was proven by deliberately breaking the code and watching it fail — the
only way to know a test is real.

### Carrying the name around

Once you are logged in, a cookie holds:

```
admin.<your e-mail, encoded>.<expiry>.<signature>
```

The signature is computed over the name **and** the expiry. Edit your own cookie
to say a colleague's address and the signature no longer matches, so the session
is rejected. Without that, attribution would be a suggestion.

The actor is read from *that cookie*, never from the request body — the body is
whatever the caller typed, so trusting it would let anyone file actions under
anyone.

### Two deliberate refusals

**The old shared password still works.** It looks untidy. It is the reason a
typo in `ADMIN_USERS` does not lock you out of a shop taking live payments with
no way back but a redeploy. It stops working the moment you remove
`ADMIN_PASSWORD` — do that once you have logged in with a named account and
know it works, not before.

**Old sessions were not invalidated.** Anyone already logged in stayed logged
in; their actions record as unattributed, which is honest, because they are.
Shipping an auth change that signs everyone out is how a small shop ends up with
nobody able to reach `/admin` on a Saturday.

### The engraving, and the control that was not built

The same batch made the engraved name bigger and gave it its own row in the
cutting queue. What is interesting is what was *rejected*: a tick-box confirming
you read it, and a field making you type it back.

Both sound responsible. Neither was built, because nothing has ever been
mis-cut — and a confirmation nobody asked for becomes a reflex click within a
week. Then it *looks* like a safeguard while being none, which is worse than an
honest absence.

The rule worth keeping: **do not buy friction before you have the failure.** If
a piece is ever actually cut wrong, that is the day typing-back becomes worth it,
and the day everyone using it will understand why.

### 15.4 The bug that only happens some of the time

This one is worth studying, because the *shape* of it will come back.

Setting up the two operators, everything reported success. The `.env` on the
server held all 383 characters. Both entries had a 32-character salt and a
128-character hash. Then the last check failed: one operator signed in, the
other got a 401.

The temptation is to suspect the password. It was not the password.

The container's copy of `ADMIN_USERS` was **254** characters, not 383. Same
emails, same salts, and the second hash had length **zero**. It had been deleted
somewhere between the file and the running program.

**Why.** A credential looks like `email:<salt>$<hash>`. A `.env` sitting next to
a `docker-compose.yml` is not a plain list of `KEY=VALUE` — Compose reads it to
fill in `${...}` placeholders, so a `$` in a *value* is a variable reference.
`$abc123...` was read as "the variable named abc123...", which does not exist,
so it became nothing.

**Now the interesting part.** Why had this never happened before? Because a
variable name cannot start with a digit. A hash is hex, so it starts with a
digit ten times in sixteen and gets left alone — it works. Start with `a`-`f`
and it is destroyed. The first operator's hash happened to start with a digit.

So the same script, run twice, with the same password, can succeed and then
fail, because the random salt changed. That is the worst kind of bug: it looks
like a typo, and re-running "fixes" it about 40% of the time.

**Two fixes, and the second is the one that matters.**

The direct fix is to write `$$`, which is how Compose spells a literal `$`.
That closes this cause.

The fix that will still be working in a year is different: the script now takes
a SHA-256 of the value it *meant* to send, takes a SHA-256 of what the container
actually has, and refuses to continue if they differ.

```
container holds exactly what was written : yes
```

That one line does not care *why* a value got mangled. Quoting, encoding, a
different orchestrator, something nobody has thought of — it all comes out as
the same loud failure at the moment it happens, instead of a mysterious 401 six
weeks later.

**The transferable lesson:** "the file is correct" and "the program has the
value" are two different claims. Everything in between — a shell, a compose
file, an orchestrator, a container runtime — is allowed to rewrite what passes
through it. When the value is a credential, check that it arrived. It costs one
command.

## 16. The day the shop opened — 2026-08-13

The first real order went through today. Payment, webhook, order record,
customer confirmation, operator alerts to three addresses. Everything in this
section either came out of that order or was found while getting ready for it.

Read this one for the pattern, not the list.

### 16.1 The bug that only a real order could find

Order ids are uuids: `c6568cbb-c503-4b91-924f-39ccd7cf135c`. Every place a
customer sees an order — the confirmation e-mail, the success page, the account
page — prints the first eight characters with a hash: `#c6568cbb`.

You placed an order, took the number the shop gave you, typed it into Track
Order, and got **"Order not found"**.

The shop was handing out a reference it then refused to accept. Every customer
would have hit it, arriving from the "Track Your Order" button in their own
confirmation e-mail. Four hundred and sixty tests were passing at the time.

**Why no test caught it.** Each half was correct on its own. The e-mail template
correctly shortens the id. The lookup correctly matches an id. Nobody had tested
the two together, because that requires an actual order to exist.

### 16.2 The fix that shipped broken, and why that is the more useful story

I fixed it, tested it, deployed it, and told you it was done.

It was not. I tested it against the real order afterwards and the short
reference still failed.

The cause: `id` is a **uuid column**, and my fix matched short references with
`ilike("id", "c6568cbb%")`. Postgres has no `ilike` for uuid:

```
operator does not exist: uuid ~~* unknown
```

PostgREST reported that as an error, and the code read the error as "no rows
found" and returned null. The query never ran. The failure was completely
silent. And every unit test still passed, because they exercised the string
parsing and never touched a database.

That is the same shape as the bug it was fixing: **something that cannot work,
failing quietly, verified by tests that could not see it.**

The real fix uses a uuid range. uuid comparison is bytewise, so a hex prefix is
a contiguous span: pad with zeros for the low bound, `f`s for the high. No cast,
exact, and the primary key index still applies.

**The lesson, and it is the main one in this document:** a passing test tells you
the code does what the test says. It does not tell you the code does what you
need. The only thing that caught either bug was using the real thing, on the
live site, with real data.

### 16.3 Things that were true once and quietly stopped being true

Three separate findings today share a cause. Each was a correct decision that
became wrong when something around it changed, and nothing failed when it did.

**The admin reported a business model that no longer exists.** Four of six
headline tiles showed Deposits Collected, COD Pending, COD Collected — from the
50% deposit and cash-on-delivery flow that was deleted from checkout. Stripe
takes the full amount now, so "deposits" restated revenue and both COD figures
were permanently zero. Thirteen references across three files.

**A public API leaked supplier cost prices.** `GET /api/products` was
unauthenticated while PUT and DELETE were gated — and `proxy.ts` had a comment
saying exactly that, so it read as considered. It *was* considered: a shop's
catalogue is public information. Then supplier columns were added to the same
rows, and it started returning 611 records with `cj_price` on 515 of them.
Anyone could compute your margin on almost everything.

**The e-mail told one person.** Operator alerts went to a single address. With
two operators that means one of them learns about an order and the other does
not, decided by an environment variable nobody looks at.

The pattern: **"it looked deliberate" is not the same as "it is still right."**
When you change a model, hunt for everything that described the old one.

### 16.4 Zero and unknown are different claims

The dashboard said "Delivery Success 0%" when nothing had been delivered yet.
Arithmetically true. It reads as *every delivery failed*, which on a
made-to-order shop with a 2-3 day lead time is exactly backwards.

The 14-day charts floored every bar at 2% height, so a quiet week drew a row of
slivers — indistinguishable from a chart that failed to load.

Three components were making the first claim while meaning the second. They now
show an em dash or a plain sentence, with the basis named: "none delivered yet",
"2 customers", "no orders in the last 14 days".

### 16.5 The value of a test that fails first

Several fixes today were verified by running the NEW tests against the OLD
production site and watching them fail — then passing after deploy.

The SEO specs failed on missing og:image, missing canonical, and an indexable
unlisted product. The legal specs failed 3-of-4. Then both passed.

That is worth more than a green run. A test that has never failed has not been
shown to test anything.

The same discipline applies to absence. "The unlisted product is not in the
sitemap" would pass on an **empty** sitemap, so every such check is paired with
a precondition proving a real product IS there.

### 16.6 What is still true and unfinished

- **The 17 pruned credentials are removed, not rotated.** They sat in a web
  container's environment for months. Removing them does not un-expose them;
  anything that read them still holds them.
- **Sending domains and DMARC** are DNS changes on infrastructure shared with
  other projects, so they need a decision rather than a commit.
- The admin's cosmetic layer — typography, spacing, palette — is deliberately
  untouched until you have used the corrected version.

## 17. The launch, and the day we found out deploys were broken — 2026-08-14

This section covers one session: getting the launch films postable, adding
campaign tracking, changing the phone number, and discovering along the way that
the shop had not been able to deploy for a day and a half. Read the last part
even if you skip the rest. It is the most important thing in this document.

### 17.1 Why a link needs a code

The films were finished and the upload kits told you to paste
`https://shop.lebon-grace.com` into every post. Post that, and you learn nothing.
Someone arrives; you have no idea whether from TikTok, LinkedIn or a friend.

The instinct is "the referrer will tell us". It will not. When someone taps a
link inside the TikTok, Instagram or Facebook app, the page opens in that app's
own browser, which usually sends no referrer at all or a generic one. On top of
that this site sends `Referrer-Policy: strict-origin-when-cross-origin`, which
trims what little there is. Referrer data for exactly the traffic we care about
is close to worthless.

**UTM parameters** solve it because they travel *in the URL* rather than in a
header a browser can withhold. Umami has a UTM report built in.

But you do not want to paste this into a caption:

```
https://shop.lebon-grace.com/?utm_source=tiktok&utm_medium=social&utm_campaign=launch-2026&utm_content=bio
```

That reads like a marketing funnel, which is the opposite of how these films are
written. So we added short codes that redirect:

```
shop.lebon-grace.com/go/tt   ->   /?utm_source=tiktok&utm_medium=social&...
```

Seven of them, in `next.config.ts`. Two details worth understanding:

- **They are 307, not 308.** A 308 is *permanent*, and browsers cache permanent
  redirects more or less forever. Reuse `/go/yt` for a campaign next year and
  anyone who clicked the first one would still land on the old parameters. A
  temporary redirect costs nothing and keeps the codes reusable.
- **`/go/` is a namespace.** Bare `/yt` would one day collide with a product
  slug. `/go/bogus` returns 404, which is what you want: an unknown code should
  fail loudly, not silently redirect somewhere.

### 17.2 Two files that both claim to be the kit

`UPLOAD-KITS.md` and `upload-kits.html` are maintained by hand, and they had
already drifted **in both directions**: Instagram and Facebook were once written
into the HTML and never back-ported to the markdown, then the `/go/` links went
into the markdown and never reached the HTML — which is the file you actually
read when posting. You noticed before I did.

The fix is not "be more careful". It is `scripts/social/check-kits.mjs`, which
fails if a posted link has no code, if the two files disagree, or if a code has
no matching redirect in `next.config.ts`. That last check matters most: a code
with no redirect 404s, and the click vanishes with no trace anywhere.

### 17.3 Why the videos went to their own R2 bucket

Post for Me takes media as `{ url }`. There is no upload endpoint, so the films
must be publicly fetchable before anything can post.

`R2_BUCKET` in `supabase.local` points at `mirrortales-trailers` — another
project's bucket, and also the home of the `restic-cx53` backup repo. Putting
launch video there would mix three unrelated things into one blast radius: a
lifecycle rule, a quota or a mistaken purge aimed at any one would hit the other
two. So `lebon-grace-media` was created, and the flywheel reads its own
`LEBON_GRACE_R2_*` variables.

**Uploading and being publicly fetchable are different problems**, and
`r2-upload.mjs` treats them separately. It stores the bytes, verifies them with a
signed `HEAD` comparing byte length against the source file, then verifies public
reachability *anonymously* — exactly as Post for Me will. It writes its manifest
only when every URL is proven fetchable, because a partial manifest would let the
flywheel post some assets and silently skip others.

A lesson that generalises: **a 200 from a PUT only proves the storage accepted
the bytes.** It says nothing about whether anyone else can read them.

### 17.4 The chapter trap

Printing the publish payloads before sending caught something a code review would
not. The YouTube description ended with:

```
0:00 This puzzle is in stock
0:14 We ship it the same day
0:25 The engraving costs extra
0:47 A machine made this
```

Those are the four struck-through claims from The Correction. In the film they
are crossed out. But YouTube builds a **chapter rail** from any timestamp list
starting at `0:00`, and chapter titles render as plain text with no strikethrough.
The chapter rail under your launch video would have asserted that you ship
same-day, charge for engraving, and that a machine made the puzzles — beneath a
film whose entire purpose is denying exactly that.

Removed. The habit worth keeping: **render the thing before you send it.**

### 17.5 The phone number, and why it left the source code

`src/lib/contact.ts` already had a good design: server-side only, never imported
by a client component, handed out through a rate-limited `/api/contact/reveal`.
Its comments correctly explained that this defeats the cheap harvesting — regex
over static HTML, `mailto:` scrapers, crawlers that never run JavaScript.

What it missed: **this repository is public on GitHub.** The number sat as a
default in that file, in indexed searchable source, and GitHub code search is
itself a harvesting channel. Protecting the response while publishing the repo
protects nothing.

The number now comes only from the environment. Three literals were removed and
all three looked harmless in review:

1. the default in `contact.ts`,
2. a hardcoded `wa.me` link in the cart-recovery email, which is precisely the
   one place a phone change gets missed,
3. the *retired* number left in a comment. A dead number in a comment is still a
   real number in public source.

A test now walks `src/` and fails on any `971`-prefixed number in non-test files,
comments included. I proved it fails by planting one, because **a guard that has
only ever seen clean code has not been tested.**

Unset degrades rather than breaks: phone and WhatsApp are simply not offered,
email still is, and the reveal endpoint *omits* the keys rather than returning
nulls that would render as `href="null"`.

### 17.6 The important part: deploys had been silently broken

The shop had been serving commit `ea52944` for 22 hours. Two commits sat
unshipped. Nobody knew, because `npm run build` and `tsc` both passed locally
every single time.

The error only appears inside the container:

```
remotion-launch/src/Root.tsx: error TS2307: Cannot find module 'remotion'
```

`remotion-launch/` is a **separate npm project** with its own `package.json` and
its own `node_modules` — and that `node_modules` is gitignored. Its sources
import `remotion`, which the shop has never depended on. The root `tsconfig.json`
included it, so `next build` type-checked it. On your machine the film
workspace's `node_modules` is sitting right there and everything resolves. In the
image it does not exist, so the build dies.

**Green locally, broken in production, nothing in between.** That is the worst
failure signature there is.

Worse: this was the *second* time. `ops/qa` was excluded for exactly this reason
back in August, and the Dockerfile still carries the note. So the fix is not just
the exclusion — `src/lib/sibling-projects.test.ts` now walks the repo for
directories with their own `package.json` and fails if the root tsconfig does not
exclude them. Proved by un-excluding `remotion-launch`; it names the offender.

**The transferable rule: if a directory has its own `package.json`, it has its
own dependencies, and the root tsconfig must not type-check it.**

### 17.7 The bigger surprise: I was deploying to the wrong machine

Three deploys "succeeded" and changed nothing. The real path:

```
customer
  -> Caddy on an AWS VPS in ap-south-1 (3.111.1.0)   [TLS terminates here]
  -> 127.0.0.1:8080
  -> SSH reverse tunnel originating FROM cx53
  -> container alias lebon-grace-app:3000
  -> Coolify SERVICE lixqbqbkz39l0bnz9xv2227t, image lebon-grace:cx53
```

**There is a drawn version of this**, which is easier to hold in your head than
the arrows above: [`docs/architecture-production-topology.html`](docs/architecture-production-topology.html).
Open it in a browser. It is a single self-contained file, no build step. The
detail worth looking at is the dashed arrow pointing *backwards*: the tunnel is
opened from cx53 outward, which is why the Hetzner box needs no public port.

The Coolify **application** called `lebon-grace-git` is a different resource that
serves nothing public. Deploying it does exactly nothing to the shop.

Both written sources were wrong. `ops/selfhost/PROJECT-CONTEXT.md` describes this
app as deploying via the Coolify UI on cx53, and the edge Caddyfile's own comment
still says the origin is your workstation — it was, once, and the tunnel now
comes from cx53 instead.

How it was actually found, and this is the method worth copying: stop reading
documentation and follow the packets. `nslookup` the public hostname. Read the
Caddyfile. Look at what is *listening* on the port it proxies to. Trace the SSH
tunnel back to its origin. Find which container answers to the network alias.

**Documentation describes intent. The running system is the truth.**

The real deploy is now recorded in `supabase.local`, including the part that is
easy to get wrong: every `NEXT_PUBLIC_*` value is inlined into the browser bundle
at **build** time, so the image must be built with them passed as `BUILD_ENV` or
the shop silently loses Stripe, Sentry and Umami in the browser.

### 17.8 The phone number, and two traps in Coolify

In Coolify, a **hardcoded** value in a compose file reaches the container but is
invisible to the environment system. Only `${VAR}` placeholders become editable
variables. Everything else follows from that:

- `PATCH /services/{uuid}/envs` returns 404 — the key is not managed
- a `POST` creates a variable, and `docker inspect` proves it never reaches the
  container, because the compose's literal shadows it
- editing the file on disk is reverted, because Coolify regenerates it
- `GET /services/{uuid}` **does not return `docker_compose_raw` at all**, even
  though `PATCH` accepts it

That last asymmetry is a trap. You can write the compose through the API but not
read it, so you would be sending a document you reconstructed from somewhere
else. I nearly did, using the generated file on cx53 as the source. **That would
have corrupted the service**, because the two are not the same document:

```yaml
# the RAW source, what Coolify stores        # the GENERATED file on disk
- CONTACT_WHATSAPP=971588286630              CONTACT_WHATSAPP: '971588286630'
```

List syntax versus mapping syntax. Writing the second over the first changes the
structure of the file, not just the values. **If you cannot read the current
value, you cannot safely write the next one** — there is no backup and no undo.

The way through was the Coolify UI, driven through a browser that already held
a logged-in session. The UI can read the raw compose, which is exactly the
capability the API withholds.

**And then a second trap.** The first save reported "Saving new docker compose…"
and persisted nothing. Alongside it were two errors about a *description* field.
The service description contained a **semicolon**, which Coolify's validator
rejects, and the validation is form-wide: one invalid field silently blocks the
whole save, including the compose. That semicolon had been quietly failing every
save on this service. Changing it to a comma unblocked everything.

The lesson is not about semicolons. **A success toast is not persistence.**
Reload and read the value back — that is the only thing that proves a save.

The final state, live and verified:

```yaml
      - CONTACT_WHATSAPP=${CONTACT_WHATSAPP}
      - 'CONTACT_PHONE_DISPLAY=${CONTACT_PHONE_DISPLAY}'
```

### 17.9 What I would do differently, plainly

**The links shipped before the redirects did.** The `/go/` codes went into the
kits, you posted to LinkedIn, and every click from that post 404'd until the
deploy was fixed. The ordering should have been: deploy the redirects, verify
them in production, *then* put them in the kits. A link is a promise that
something exists at the other end, and I made that promise early.

The general rule, worth more than the incident: **anything published externally
must depend only on what is already live.** Not what is committed. Not what is
merged. What is live, and verified live.

### 17.10 Habits from this session

- **Prove a guard can fail.** Every check added here was tested by planting a
  violation. A test that has only seen clean code proves nothing.
- **Verify from outside.** The R2 uploads were confirmed by a separate client
  fetching the public URLs, and a nonexistent key was checked to 404 — otherwise
  a bucket answering 200 to everything would look like success.
- **A green deploy status is not a deployed change.** Coolify reported
  "finished" while the old container was still serving. Check the running image,
  then check the behaviour.
- **Verify memory against the system.** A saved note said to deploy with
  `build-apps.sh`. Its own header says it does not target production, so I
  discarded it — and it turned out to be closer to right than the official doc.
  Neither was authoritative. The running system was.

## 18. What machines see, and the day the sitemap pointed nowhere

Everything so far has been about what a person sees. This section is about the
other audience: Google, and increasingly an assistant answering "where can I buy
a personalised puzzle in the UAE". They read different things from the same page.

### 18.1 The sitemap had been lying to every crawler

Found while auditing something else entirely. Every URL in the live sitemap read:

```
<loc>https://build-time-placeholder.invalid</loc>
```

All 48 of them, and `robots.txt` pointed crawlers at a sitemap on that same dead
host. The sitemaps protocol **drops cross-host entries**, so Google could
discover nothing through it.

The cause is worth understanding because it will happen again. `getAppUrl()`
reads `APP_URL` at call time, which is correct. But Next **prerenders**
`robots.ts` and `sitemap.ts` during `next build`, and at build time those
variables do not reliably reach the builder, so the function fell through to its
placeholder default. That value was then frozen into a static file.

The fix is one line in each:

```ts
export const dynamic = "force-dynamic";
```

That removes the build-time dependency altogether rather than chasing the right
variable into the image. Both files are tiny and fetched by crawlers, not
customers, so there is nothing worth caching.

**The check that proves it:** the build output lists them as dynamic rather than
static. Not the source, the build output.

The general lesson: **anything that reads configuration must be evaluated where
that configuration exists.** Two HTTP 200s hid this for days. A page returning
200 tells you the server answered, not that it answered correctly.

### 18.2 An escape that escaped nothing

The product page emitted its JSON-LD with a replace of `<` against a
single-backslash `u003c` literal. In TypeScript source that literal **is** the
character `<`. So the call replaced `<` with `<`. An identity operation, wearing
the costume of a security fix, under a comment claiming `JSON.stringify` handled
the closing-tag sequence. It does not escape `<` at all.

Doubling the backslash emits the six literal characters into the JSON string.
Any parser decodes them back to `<`, so nothing changes for a reader, but
`</script>` can no longer appear in the markup and close the tag early.

The payload is our own catalogue rather than user input, so this was unlikely to
ever be reached. It was fixed anyway, because **a comment claiming a protection
that does not exist is worse than no comment**: it stops the next reader
checking.

The guard added for it is deliberately **behavioural**. It runs the transform
against a hostile string and asserts `</script>` cannot appear, rather than
grepping for the right characters, because the bug read as correct in review.
Proved it fails by reverting to the buggy literal.

A smaller lesson from the same hour: the guard initially failed on the *fixed*
file, because the explanatory comment I wrote **quoted the buggy call verbatim**
and the source check found it there. If a test scans source, the prose in that
source is part of the input.

### 18.3 Delivery cost is half of what a buyer compares

The price was machine-readable. The delivery was not.

AED 20 flat, free over AED 150, existed only as prose on the cart and in the
FAQ. A shopping surface or an assistant could quote the AED 15 and had nothing
to say about what it costs to receive it, which is most of the decision on a
low-value item.

Now two `OfferShippingDetails` entries, because the free tier is conditional on
order value and `eligibleTransactionVolume` is how that condition is expressed.
The numbers are **imported from `lib/delivery`**, the same module checkout
charges from, so the structured data cannot drift from what is actually billed.
Returns are declared at 7 days, which is what `/terms` and the FAQ both say.

`material` and `audience` emit only when the catalogue holds them. An absent
field is honest; a guessed one is a claim the shop cannot stand behind.

### 18.4 The phone number that is deliberately missing

Site-wide `Organization` and `WebSite` markup now sits in the root layout, so
search engines and assistants have a publisher behind the per-product facts, and
a declared search endpoint.

It has **no `telephone` property**, and that omission is the interesting part.

`lib/contact.ts` keeps the number out of the served HTML and hands it over only
through a rate-limited endpoint. The number is not in this repository at all,
because the repository is public. Adding `telephone` to `Organization` would
publish it on every page of the site and undo that arrangement completely.

It is exactly the sort of change that reads as an improvement. "More complete
structured data" is a good instinct that would, here, have quietly defeated a
deliberate protection. The layout carries a comment saying so, so the next
person does not helpfully add it.

A security hook also blocked the first attempt at that file, for using React's
raw-HTML escape hatch. That is the documented way to emit JSON-LD in the App
Router and the product page already does it, so the guard was firing on the
right pattern for the wrong reason. It still did its job, and the change went in
only after you confirmed. Prefer a noisy guard to a silent one.

### 18.5 Where the shop actually stands for agents

Researched against primary sources rather than blog summaries:

- **Discoverable, not transactable.** An assistant can read a product page and
  describe it. It cannot check stock, price delivery, or place an order without
  driving a browser.
- **Nothing is ineligible.** Every Google-*required* field was already present
  before this work; all the gaps closed above sit in the recommended tier.
- **The agentic commerce options are mostly closed to you.** Stripe's agentic
  suite excludes AE. OpenAI Instant Checkout is approved-partners-only. Google
  UCP is a US/CA/AU waitlist. MCP is not a sales channel: no ratified discovery,
  no payments spec, and Anthropic's directory policy bars transacting connectors.
- **So the practical surface in 2026 is a Merchant Center feed plus complete
  structured data.** UAE and AED are supported there. That is the whole list.

Full working in `docs/RESEARCH-agentic-commerce-2026-08-19.md`.

## 19. The photograph problem — 2026-08-19

You asked for a photo and logo path, and then said the thing that decided the
whole design:

> "a discussion needs to happen with the customer ahead in order to agree on the
> design and when it is final and approved then we do the work."

That one sentence rules out the obvious build. The obvious build is an upload
box at checkout, next to the name field. It is obvious because the name field
works that way: someone types "Layla", we cut "Layla", done. A photograph is not
like that. It has to be looked at, cropped, sometimes redrawn, sometimes refused
because it will not survive being burned into a 3mm board. If we take the money
first we end up with one of two bad outcomes: cutting something the customer
never approved, or holding a paid order hostage while we argue about it.

So the flow is **quote and approve BEFORE the order exists**. There is no file
upload anywhere in the checkout. There is a separate page, `/custom`, where
someone sends a picture and a description, and a separate table holding that
conversation. Only when the design is agreed does a normal AED 15 order get
placed, the same as any other puzzle. The price never changes — you were clear
about that too. Photo and logo are further personalisation on the existing
catalogue, not a second product, so there is no quote, no payment link and no
second price anywhere in the schema.

### What actually got built

| Piece | File | What it is for |
|---|---|---|
| The table | `supabase/migrations/0012_design_requests.sql` | The conversation. Holds a *pointer* to the image, never the image. |
| The address column | `supabase/migrations/0013_design_requests_submitter_ip.sql` | So the throttle has something to count. |
| The sanitiser | `src/lib/artwork.ts` | Turns whatever arrived into a plain JPEG we made ourselves. |
| Private storage | `src/lib/artwork-storage.ts` | A separate R2 bucket that answers 401 to the public. |
| The store | `src/lib/design-requests.ts` | Reference generation, reads, writes. |
| The throttle | `src/lib/design-request-throttle.ts` | 3 an hour, 8 a day, per address. |
| The public route | `src/app/api/custom/route.ts` | Eight steps, in an order that matters. |
| The page | `src/app/custom/page.tsx` + `CustomClient.tsx` | Where a customer starts. |
| The operator's queue | `src/components/DesignQueue.tsx` | A tab in `/admin`. |
| The admin API | `src/app/api/admin/design-requests/` | Listing, status changes, and the artwork viewer. |
| The sweep | `scripts/sweep-expired-artwork.mjs` | Deletes photographs that have outlived their purpose. |

### Four ideas worth carrying to other projects

**Re-encoding is the guarantee, not sniffing.** A file that starts with the
right magic bytes can still be a payload. Checking the first few bytes tells you
what a file *claims* to be. The only reliable move is to decode the image and
write a new one from the pixels, which is what `sharp(...).jpeg()` does here —
anything hidden in the original does not survive the round trip. SVG is refused
outright, because SVG is a document that can contain script, not a picture.

**Store the pointer, not the thing.** Postgres is not a blob store. The table
holds an R2 object key; the bucket holds the bytes. The operator's queue query
stays fast because it is reading text, and a database backup does not quietly
become a megabyte-per-row archive of other people's children.

**Delete storage first, then the row.** This one is genuinely counterintuitive.
If you clear the database pointer first and the storage delete then fails, you
have an object in the bucket that *no row references* — so no future sweep can
ever find it. That is how a private bucket silently fills with photographs
nobody can account for. The other order fails safe: if the delete throws, the
row still points at a real object and the next run retries. The same order is
used when the operator declines a request, and there is a test that asserts the
sequence, not just the outcome.

**A signed URL is a password.** The operator's viewer mints a URL that lives for
sixty seconds. Anyone holding that string can fetch the photograph with no login
at all. So it is fetched one row at a time rather than embedded in the queue
listing — a list response would mint a working key for every open request at
once and leave them in browser history and in any screenshot of the queue. It is
rendered into an `<img>` rather than opened in a tab, because a navigation
writes the URL into history and an image load does not. And `next/image` is
deliberately *not* used: the optimiser caches by URL on disk, which would put a
copy of the photograph outside the private bucket the entire design rests on.

### Two things that cost real time

**The credentials had a different name.** The sweep died on
`SUPABASE_SERVICE_ROLE_KEY missing`. The shared secrets file holds a dozen
Supabase instances for different projects, and this project's keys are prefixed
`LG_SELFHOSTED_`. An unprefixed name does not say which database it opens, which
is exactly why the prefix exists. Every credential is now checked at the top of
the script, including the R2 ones a `--dry` run never touches, because a dry run
that passes and a real run that dies halfway is the worst possible split — the
dry run is the thing that tells you it is safe to schedule.

**`process.exit()` can abort a script that already succeeded.** The sweep
finished its work and then died with a C-level libuv assertion on Windows. The
cause is a known Node bug: calling `exit()` while the HTTP client still holds a
socket. A timer would have read that as a failed sweep and alerted on a run that
worked perfectly. The fix is `process.exitCode = n`, which lets the event loop
drain and the process end on its own. The commonly published workaround is to
sleep 100ms before exiting; draining is the same fix without a magic number.

### And the test that could not have failed

The first sweep run reported "0 requests with artwork past expiry" against an
empty table, and it would have reported exactly that if the query had the wrong
column name, the wrong operator, or the wrong table. **An absence proves nothing
unless you show the thing could have been present.** So there is now a proof
that seeds a row past its expiry with a real object in the bucket, checks the
object is readable, runs the dry sweep and asserts it *lists* the row and
*leaves the object alone*, runs the real sweep, and then checks the photograph
is gone from R2 and the row kept its brief but lost the key, the type, the size
and the address. It cleans up after itself either way.

### A stale mask, found by accident

While adding the `/custom` link to the footer, the phone line read
`+971 58 ••• ••30`. The shop's number changed to +971 52 839 9804 and the mask
kept advertising the old one's first and last digits. Four real digits are not
enough for a customer to dial and are plenty for a scraper to correlate, so it
was costing accuracy to buy nothing. It is now the `ContactInfo` reveal, which
fetches the number from the one place it lives. There is no copy left in that
file to go stale.

### The sweep runs at 03:17, and we watched it delete something

The 90 day promise on `/custom` is only worth what runs it. The sweep ships
inside the runtime image and a systemd timer on cx53 `docker exec`s it daily.

The image is where it lives because of where the CREDENTIALS are. Deleting a
photograph needs the service role key and the R2 secret; the container already
holds both, and cx53 has no node runtime, so every host-side alternative meant
installing node *and* writing those two secrets into a second file on the same
box. Both operations would have added a place to leak from and bought nothing.

Two things nearly shipped broken. `aws4fetch` is absent from the standalone
bundle, because Next only traces what the app imports at runtime and nothing
the server renders touches R2 — the sweep would have died on a missing import
at 03:00, silently. And the timer script exits 0 when the container is simply
not running: a deploy in progress is not a privacy incident, and a unit that
goes red every time you ship is a unit people stop reading.

It was proved the same way as everything else here: seed a row past its expiry
with a real object in the bucket, run `systemctl start`, then check the object
is gone from R2 and the row kept its brief but lost the key, the type, the size
and the address. `journalctl -u lebon-grace-artwork-sweep` is the record.

### The credentials were not in production

Worth reading twice, because the site looked completely fine.

`/custom` deployed, the page rendered, the form posted, the tests passed. But
the container had no `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ACCOUNT_ID` or `LEBON_GRACE_R2_ARTWORK_BUCKET`. The first real customer to
send a photograph would have got a 500 *after* their row was written, with no
artwork and no e-mail to you.

Nothing that reads HTML could have caught it. What caught it was listing the
environment variable NAMES in the running container and noticing four that
should have been there were not. What now proves it works is a smoke test that
posts an actual PNG at production and checks four things: the route answered
200, the row points at an object, the stored type is JPEG — so the re-encode
really ran rather than the bytes passing through — and an unauthenticated
request to the bucket does not get the photograph. It deletes the row and the
object afterwards.

### Deploying is one command now

`./scripts/deploy-cx53.sh`. It builds from **origin/main on GitHub**, not from
your working tree, so what ships is exactly the commit that was pushed and the
image can always be traced to a SHA. It tags a rollback before overwriting,
replaces only this app's container, and refuses to claim success unless the live
site serves back the exact `dpl` it just built. Read §17 for why every one of
those steps is there.

## 20. Two rules that only became true when a test enforced them

Both of these were already written down. Neither was actually happening.

### "Wooden" was doing work it had not earned

The title, the OpenGraph card and the homepage headline all said **Wooden
puzzles**. Everything is cut from 3mm MDF, which is a wood-based panel rather
than solid timber. The product page had always disclosed the material; the front
door had not, and a search result or a shared link IS the front door.

That matters more than tidiness. UAE consumer regulation treats a description as
deceptive when it creates a misleading impression about the **composition** of a
good, and the penalties attached to it are not small. To a parent choosing a toy,
"wooden" reads as solid wood.

The fix was deliberately not a find-and-replace. **"wood filler" stays**, because
that is the name of a real product a customer would buy, and renaming someone
else's product to suit our house style would be falsifying it. The `MAT_MAP`
filter entries stay too, because they match legacy supplier data and no reader
ever sees them. Two other things went: "sustainably manufactured" and "recycled
wood fibers" are claims about the specific board we buy that nobody here has
substantiated, where "made from wood fibre" is true of the material by
definition and needs no certificate behind it.

### The em dash rule was decoration until it was a test

"No em dashes in anything a reader sees" is one of your standing instructions. It
was being broken in **67 places**, including live customer emails, the cart
recovery mail and checkout error messages.

The interesting part is why writing it down had not been enough. In a sibling
project the identical rule lived in three documents and was enforced in two
peripheral scripts, and two thousand pages shipped with em dashes anyway,
because the page generators never called the checker. **A rule enforced anywhere
other than the exit is decoration.**

So it is `src/lib/copy-rules.ts` now, and it runs in the same suite as
everything else. It walks the TypeScript syntax tree rather than grepping, which
is what lets it honour the rule's own exemption for comments and docstrings
exactly: a file full of prose explaining the dash rule would trip any regex.
`/admin` and `console.*` are out of scope, being operator tooling by the rule's
own terms.

Each of the 67 was a decision, not a substitution:

| Shape | Fix | Example |
|---|---|---|
| A range, where the dash means "to" | hyphen, or the word | `2-3 days`, `9:00 AM to 6:00 PM` |
| Separator before a price | comma | `New order #A1B2, AED 15` |
| Clause break inside a sentence | comma, or two sentences | `Almost there. Check your inbox` |
| Heading joining a label to a subject | colon | `Keep It Beautiful: MDF Care Guide` |

### A guard that was quietest exactly where it mattered

The same lesson caught me while writing the docs guard. Its first version listed
the working directory looking for documents still giving Hostinger instructions.
But `HOSTINGER_*.md` and `SESSION_RESUME.md` are in `.gitignore`: they exist on
your machine and in no clone. A directory listing therefore checks a different
set of files on every machine, and the **fewest of all in CI**, where a fresh
clone has none of them. It reads tracked files now, so it tests the repository
rather than one computer.

`SESSION_RESUME.md` was the one worth catching. It opened with "Read this FIRST
in any new session" and then described a Hostinger app, a JSON file store and a
PHP proxy, none of which had existed for six weeks. A previous cleanup had
bannered two of the nine files that needed it, which is the same shape as the
copy rule: the fix reaches whatever someone happened to open.

### What closed, and why that is written down too

Two items had sat in the queue since the dropshipping era: "Add proven/blue-chip
products" and "Build CJ product intelligence layer". Both are closed, and
`DECISIONS.md` D-019 is the reason rather than a silent status change.

The evidence settled it: no product carries a `cjPid`, `/api/variants` reads
local variants, and there is no CJ credential anywhere in the container.
"Blue-chip products" was a sourcing idea, pick SKUs with proven sales on a
supplier's platform, and it has no translation into a workshop that cuts every
piece to order. An item nobody can start is not a backlog entry; it is permanent
noise at the top of a queue, and it makes every reading of that queue slightly
less truthful.

## 21. Glossary

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
| **scrypt** | A password hash deliberately slow *and* memory-hungry, so guessing at scale costs real hardware. |
| **Salt** | Random text mixed into each password before hashing, so two people with the same password get different hashes. |
| **`ADMIN_USERS`** | The environment variable holding each operator's e-mail and password hash. No passwords in it — only hashes. |
| **Attributable** | An action the audit trail can name a person for. A shared password produces unattributable actions. |
| **UTM parameters** | `?utm_source=...` tags carried in the URL. They survive in-app browsers that strip the referrer, which is why tracking uses them. |
| **`/go/` code** | A short link like `/go/li` that redirects to the homepage carrying UTM tags, so captions stay clean and clicks stay attributable. |
| **307 vs 308** | Both redirect. 308 is *permanent* and browsers cache it indefinitely, so a code could never be reused. Campaign links must be 307. |
| **Sibling project** | A directory inside this repo with its own `package.json` and `node_modules`, like `remotion-launch/`. The root tsconfig must exclude it or the production build fails while passing locally. |
| **`BUILD_ENV`** | The blob of `NEXT_PUBLIC_*` values passed at image build time. They are inlined into the browser bundle, so building without them silently breaks Stripe, Sentry and Umami in the browser. |
| **Public Development URL** | R2's `pub-<id>.r2.dev` hostname. Off by default: a bucket can hold your files and still answer 401 to everyone. |
| **Compose placeholder** | `VAR: ${VAR}` in a Coolify compose file. A hardcoded value reaches the container but cannot be edited; only the placeholder form becomes a managed variable. |
| **JSON-LD** | Structured data in a script tag. How a page states its price, stock and delivery in a form a machine reads without guessing from the layout. |
| **force-dynamic** | Tells Next to render a route per request rather than freezing it at build. Required for anything reading runtime configuration. |
| **`@graph`** | A JSON-LD array letting one script tag declare several linked things, here the Organization and the WebSite. |
| **`sameAs`** | The official profiles of an organisation elsewhere. Ties the shop to the accounts it posts from. |
| **eligibleTransactionVolume** | How schema.org expresses a conditional offer, used here for free delivery over AED 150. |
| **Design request** | The conversation before a photo or logo order exists. Its own table, its own reference, no money involved. |
| **`LG-` reference** | The short handle a customer quotes on WhatsApp, e.g. `LG-K7M2PQ`. No 0/O or 1/I/L, because it gets read aloud and typed on a phone. |
| **Re-encoding** | Decoding an uploaded image and writing a fresh one from the pixels. The only reliable way to strip whatever was hidden in the original. |
| **Signed URL** | A time-limited link to a private object. It is a bearer credential: whoever holds the string can fetch the file with no login. |
| **Fails open** | A guard that lets traffic through when it cannot do its job. The submission throttle fails open, so a database blip does not close the front door. |
| **`process.exitCode`** | Setting the exit status instead of calling `process.exit()`, so the event loop drains first. Prevents a finished script aborting on an open socket. |

| **MDF** | Medium-density fibreboard. A wood-based panel pressed from wood fibre, not solid timber. Everything the shop cuts is 3mm MDF. |
| **Exit gate** | A rule enforced at the one place every path goes through, rather than in each writer. The difference between a rule that holds and one that is merely written down. |
| **Vacuous pass** | A test that loops over an empty list and reports green having checked nothing. Every loop-based assertion here asserts non-empty first. |
