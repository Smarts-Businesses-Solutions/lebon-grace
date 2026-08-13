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

## 17. Glossary

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
