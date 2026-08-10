# Who can use this platform, and what each of them can do

Derived from the routes, `src/lib/admin-auth.ts`, and the gate each API writes
for itself — not from a design document, because there isn't one. Verified
2026-08-09 against 15 page routes and 13 API routes.

`SYSTEM_MAP.md` compresses all of this into one line ("Public | nothing — there
are no customer accounts"), which is true and hides six distinct customer-side
gates.

---

## There are exactly two trust levels

`admin-auth.ts:58` is the whole authorisation model:

```ts
return role === "admin";
```

Everything else is public. No roles, no scopes, no ownership checks, no user
table. That is worth separating into the half that is a sound decision and the
half that is not a decision at all.

### The customer half is deliberate, and right

There are no customer accounts: no registration, login, password reset, or
profile. For this business that is correct rather than lazy. The product is a
AED 15 made-to-order puzzle bought once, maybe twice. An account would add a
signup step in front of a small impulse purchase and offer the buyer nothing in
return — there is no subscription to manage, no saved payment method, no
library, no loyalty tier. Guest checkout with a phone-based lookup afterwards is
the same shape Etsy-scale makers use, and it removes a whole category of risk:
no password database, no reset-token flow, no session fixation, no credential
stuffing surface. You cannot leak accounts you never created.

The cost is that "proving who you are" has to happen some other way, which is
what the six customer gates below are doing.

### The enforcement half was never decided — until 2026-08-09

Two trust levels does **not** imply what this codebase used to do, which was
re-decide authorisation in each route by hand with **no middleware at all**. The
default was open, and protection was a thing each new route had to remember.
That was a fail-open posture, and it was not load-bearing for any benefit — it
was simply the shape the code grew into.

**`src/proxy.ts` now fails closed.** Any `/api/*` path not listed in it answers
**404**, so a route added without a decision about its exposure is unreachable
rather than open. `src/proxy.test.ts` goes further and fails the build if a
route exists on disk without an entry — the author finds out, rather than a
stranger.

*(Next 16 renamed the `middleware` file convention to `proxy`; same feature.)*

**The obvious implementation is a trap, and this document used to recommend it.**
It previously suggested:

```ts
export const config = { matcher: ["/api/admin/:path*", "/admin/:path*"] };
```

A prefix rule over `/api/admin/*` locks everybody out of the shop permanently,
because **`/api/admin/login` is how you get a session in the first place**.
Prefixes cannot express "all of these except that one"; an explicit list can,
which is why `proxy.ts` enumerates exact paths.

What it deliberately does **not** do is authenticate. Handlers keep their own
`requireAdmin()`, which verifies the signed session properly. Two authorities
that can disagree is worse than one, and the one in front is the one nobody
remembers to update — so the cookie check in the proxy is presence-only, and is
defence in depth rather than the gate.

**It had already produced one hole. Closed 2026-08-09.** `GET /api/variants?pid=…`
had no auth and no rate limit, and reached `fetchCJVariants()`, which called the
CJ Dropshipping API with `CJDS_API_KEY`. Anyone on the internet could drive
outbound requests to a metered third-party API on the shop's credentials.
Nothing was exposed that a customer could not see, so it was never a data leak —
it was an unauthenticated proxy that could burn someone else's quota.

Confirmed live before the fix: `?pid=DOESNOTEXIST123` returned
`{"source":"cj",…}`, and the key is set in production, so the outbound call was
genuinely being attempted.

**Removed rather than gated.** No product in the generated catalogue carries a
`cjPid` — it survives only as an optional type field — so the branch served
nobody except an attacker, and the dropship model it belonged to was abandoned
(A-10 archived its scripts). A gate on dead code is a thing to maintain and
forget; deletion is not. `src/app/api/variants/route.test.ts` now fails if any
outbound `fetch` happens, with `CJDS_API_KEY` deliberately set so the test
proves the branch is gone rather than merely inert.

That it stayed open for months while being *documented* in two places is the
part worth remembering: writing a hole down is not closing it.

A second, milder instance: `GET /api/orders` puts the two guest branches
*before* the `requireAdmin` check (lines 26-42, then 52). It is correct today,
but the guard is positional — its safety depends on the order of `if` blocks
rather than on anything structural.

---

## Human profiles

| # | Profile | Identified by | Can do |
|---|---|---|---|
| 1 | **Anonymous visitor** | nothing | `/`, `/shop`, `/shop/[slug]`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`; read reviews |
| 2 | **Shopper** | nothing — cart is `localStorage` | Add to cart, change quantity, choose delivery or collection, engrave a name, start Stripe checkout |
| 3 | **Enquirer** | nothing, rate-limited | Submit `/contact`; reveal phone / WhatsApp / email through `/api/contact/reveal` (kept out of page source so regex crawlers cannot harvest it; 20 per hour) |
| 4 | **Order tracker** | order id **+ phone** | `/track` — status and timeline for that one order |
| 5 | **Returning customer** | email **+ phone** | `/account` — every order matching the pair |
| 6 | **Reviewer** | order id + phone, **and** the order is delivered, **and** the product was in it | `/review` — one review per product per order; `order_id` is a real foreign key (migration 0005) |
| 7 | **Newsletter subscriber** | email | Subscribe; unsubscribe at `/unsubscribe` |
| 8 | **Admin / workshop operator** | `ADMIN_PASSWORD` → HMAC-signed cookie | `/admin`: cutting queue, all orders with full customer PII, change order status (sends email), create / update / delete products, metrics |

## Machine profiles

| # | Profile | Identified by | Can do |
|---|---|---|---|
| 9 | **Stripe** | webhook signature | `POST /api/stripe-webhook` — the only actor that can mark an order paid |

## Deliberately absent

No registration, login, password reset, customer profiles, saved addresses,
saved cards, wholesale or B2B pricing, staff accounts, roles, or multi-tenancy.

---

## What follows from the model

**The customer credential is a phone number.** Profiles 4, 5 and 6 all
authenticate on a phone number plus something adjacent — an email, or an order
id — and a hit returns the whole record: name, email, phone, delivery address.
Anyone holding a customer's email and phone can read their order history. This
is why B-3's wildcard bug mattered: it reduced the credential from "order id
**and** phone" to "phone" — and the phone half was weaker than it looked.

**B-21 (2026-08-09) found the phone check was not really a check.** It compared
`ca.endsWith(cb.slice(-8))`, and `slice(-8)` of a *short* string is the whole
string, so **the less you typed the more it matched**: `"7"` matched any number
ending in 7. Exactly one digit matches, so ten attempts defeated it — against a
rate limit of ten an hour.

It now compares a **fixed eight-digit window** and refuses to compare at all
below that, so input length can no longer change how strict the test is. Eight
rather than nine because a UAE landline has eight significant digits and nine
would lock those customers out of the only route to their own order. Checkout
validates the same way on both sides, so a phone that could never be matched
cannot be stored (B-22).

The wildcard is fixed and the phone is now a real factor. **The underlying model
is unchanged**: email + phone still reads a full record, and that remains a
deliberate trade-off against making people create accounts.

**Admin is one shared password, not a set of accounts.** The session token
carries a role and an expiry and nothing else — no user id, no database row. If
more than one person works the workshop they share a login, and nothing records
*who* changed an order's status, deleted a product, or read a customer's
address. That is fine for a single operator and is the first thing to outgrow on
the first hire. Note the pairing: order-status changes send email to customers,
so a shared credential can act, irreversibly and in the shop's name, with no
attribution.

**Adding a route is a security decision** — now enforced by `src/proxy.ts`,
which 404s any unlisted `/api/*` path. Before 2026-08-09 there was no such
default, and a new
file under `src/app/api/` is public the moment it exists. Anyone adding one
should assume it is exposed and write the gate deliberately, and the reviewer
should check for it — that check cannot be delegated to the framework as things
stand.
