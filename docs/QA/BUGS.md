# Bugs found and fixed

MASTER-QA-PROTOCOL §8. Every entry: what a customer would have experienced, the
evidence, the fix, and the test that now stops it coming back.

Hand-written, not generated — what broke and why is judgement. The derivable
documents beside this one are produced by `npm run qa:report`.

Ordered by how much damage each could do, not by when it was found.

---

## B-1 · A failed payment told the customer "Order Confirmed"

**Severity:** Critical · **Found by:** Module E (`failure-modes/resilience.spec.ts`) · **Fixed**

Both failure branches in `checkout/page.tsx` called `clearCart()` and
`setOrderPlaced(true)`. When `/api/checkout` returned an error, or the network
dropped, the customer saw:

> **Order Confirmed** — Thank you for your order. You will receive a
> confirmation email shortly. Your piece is now in the making queue.

…with a *Track Your Order* link. Their basket was emptied. **Nothing was charged
and no order existed.** They would have waited for a puzzle nobody was going to
make, and could not retry, because the thing they were buying had been discarded.

**Fix:** a failure now renders a `role="alert"`, keeps the basket, and re-enables
the button. **Regression:** two tests, verified to fail against the original code.

## B-2 · A successful payment confirmed nothing

**Severity:** High · **Found by:** Module E · **Fixed**

Stripe returns the customer to `/checkout?success=true`. Nothing read that
parameter, so someone who had *paid* came back to the checkout form with a full
basket and no confirmation. **The only code that cleared the cart was the code
that ran when checkout failed** — both directions were inverted.

**Fix:** the success parameter is handled, confirms the order and clears the cart.

## B-3 · Order lookup accepted wildcards and one-character prefixes

**Severity:** High (S-6) · **Found by:** writing A-4's store tests · **Fixed**

`getById()` built `ilike("id", \`${id}%\`)` straight from `?id=`. `_` matches any
character and [PostgREST aliases `*` to `%`](https://docs.postgrest.org/en/v12/references/api/tables_views.html),
so `?id=*` searched on `%%`, matched the entire orders table and returned an
arbitrary row. `?id=a` returned the first order starting with "a".

The phone check still gated the response, so it was not a direct read — but it
reduced the credential from "your order id **and** your phone" to "a phone
number", against a check that compares only the last 8 digits.

**Fix:** `/^[0-9a-f]{8}[0-9a-f-]*$/i` before the prefix branch. **Regression:**
verified by removing the guard and watching a live order object come back for
`*` and for `a`.

## B-4 · An item without a slug could set its own price

**Severity:** High · **Found by:** A-4 review · **Fixed**

`if (!item.slug) return item;` meant an item posted without a slug skipped the
catalogue lookup entirely and its client-supplied price went onto the Stripe line
item — the caller named their own price. **Fix:** every item must carry a slug;
both failure modes answer 400 rather than throwing outside the try/catch (which
had been surfacing a malformed request as a 500).

## B-5 · Refunded customers were told their order was confirmed

**Severity:** High · **Found by:** A-14 · **Fixed**

`buildEmailHTML` ended `statusMap[action] || statusMap.confirmation`. Four of the
eight statuses the admin dropdown can set had no template — `deposit_paid`,
`completed`, `failed`, `refunded` — so all four emailed **"Order Confirmed!
We're preparing your items now."** Refunding someone and then telling them their
order is being made was the *default* path.

**Fix:** subjects and bodies from one `TEMPLATES` map; an unmapped action sends
nothing. Added a `refunded` template that deliberately omits the "all sales are
final" line.

## B-6 · Every receipt quoted a delivery price the shop does not charge

**Severity:** Medium · **Found by:** an unused-variable lint warning · **Fixed**

The Payment Summary printed `Subtotal` = the *total*, a hardcoded **AED 25**
delivery "free over AED 300", and a "Pay on delivery" row for a COD model that no
longer exists. The shop charges **AED 20, free over AED 150**. Beside it,
`itemsList` built an order-items table that was never inserted — no order email
has ever listed what was ordered.

## B-7 · New orders were invisible to the workshop

**Severity:** High · **Found by:** A-7 (writing the status CHECK) · **Fixed**

The webhook wrote `status: "paid"` on every order — a value in *none* of
`STATUS_INDEX`, `PIPELINE_STAGES`, the admin dropdown or the metrics buckets. The
customer's tracking timeline lit no step after paying, and the order appeared in
no column of the production queue. Nobody would cut the puzzle, and nothing would
say so.

**Fix:** the webhook writes `deposit_paid`, agreeing with the other six places.

## B-8 · The delivery choice did not survive a reload

**Severity:** Medium · **Found by:** Module C · **Fixed**

`deliveryMethod` lived only in React state while the cart was persisted. Choosing
"Deliver to me" and then reloading — or opening `/checkout` directly — silently
reverted to pickup, the address fields vanished, and the order was quoted with
free collection.

Fixing it surfaced a second bug in the fix: effects run child-before-parent, so
clearing/restoring raced. `CartProvider` now exposes `ready`.

## B-9 · Cart quantity controls were 27px

**Severity:** Medium · **Found by:** mobile viewport runs · **Fixed**

27×32px against WCAG 2.5.5's 44×44. Fine with a mouse, a coin-flip with a thumb —
on the control between a customer and changing what they are about to buy.
Invisible at 1920×1080.

## B-10 · The WhatsApp float covered Add to cart

**Severity:** Medium · **Found earlier in the engagement** · **Fixed, now pinned**

The float was `z-50 bottom-6` against the buy bar's `z-40 bottom-0`, so on every
product page the green circle sat on Add to cart and ate the tap. Fixed at the
time; the mobile suite now asserts it **geometrically**, so it survives a restyle.

## B-11 · Anyone who could reach PostgREST could rewrite the catalogue

**Severity:** High (S-1) · **Fixed**

`CREATE POLICY "Allow all write" ON public.products USING (true)` — no `FOR`
clause means `FOR ALL`; no role clause means `public`, which includes `anon`,
whose key is published to browsers by definition. Only network placement stood in
the way, which is a location, not an authorisation control.

## B-12 · Brute-force protection reset on every deploy

**Severity:** Medium (S-3) · **Fixed**

The rate limiter kept buckets in process memory. With eight deploys in one day,
an attacker never had to outlast "5 attempts per 15 minutes" — only to still be
running when someone shipped. The weakness was invisible from the configuration.

---

# Found walking production as an anonymous visitor (2026-08-09)

Four more, from driving the live site in Edge rather than reading the code.
None were caught by the existing suite, because a passing suite finds nothing
new — the value was in probing what it did not cover.

## B-13 · A product that does not exist returned 200

**Severity:** Medium (High operationally) · **Found by:** live crawl · **Fixed**

`/shop/<anything>` rendered "Product Not Found" inside a **200 OK**. `notFound()`
was used nowhere in the app and there was no `not-found.tsx`.

The SEO argument is the obvious one — crawlers indexing unlimited fake product
URLs. The operational one is worse: `verify-deploy.mjs` and the uptime timer
both assert `status < 400`, so a broken or withdrawn product link was invisible
to the exact tooling built to catch broken deploys.

**Fix:** the 757-line client component moved byte-for-byte to
`ProductDetailClient.tsx` with a server wrapper in front that calls
`notFound()`. No props, so no serialisation boundary. **Regression:**
`tests/e2e/seo/status-codes.spec.ts`, verified failing against production and
again with the guard removed and rebuilt.

## B-14 · "Subtotal (1 items)" on the last screen before payment

**Severity:** Low · **Found by:** driving the cart · **Fixed**

The string was not the bug; hand-writing it was. The same shape — `{n} things`
with no branch for one — was in three other places.

**Fix:** `countOf()` with a unit test written first. **Regression:**
`src/lib/plural.test.ts`.

## B-15 · Rate limiting bucketed on the spoofable end of X-Forwarded-For

**Severity:** Medium · **Found by:** reading `clientIp` during the refusal-path
review · **Fixed**

`clientIp()` read `xff.split(",")[0]`. Proxies append, so the leftmost entry is
the one value a caller controls — a random header per request would have meant
a fresh bucket per request across all nine public limiters.

**It was not exploitable.** Tested against production and again straight at the
origin with the Traefik router's own Host header: three distinct spoofed values
all landed in the same already-tripped bucket, because Traefik overwrites the
header first. The code was wrong and the deployment saved it — and the file
credited a mitigation ("binds to loopback… through the tunnel") that described
the decommissioned Caddy/SSH setup.

**Fix:** `cf-connecting-ip` → `x-real-ip` → rightmost valid hop → `"unknown"`.
**Regression:** `src/lib/rate-limit.test.ts`, 4 of 6 red against the old code.

## B-16 · Header controls and grid Add-to-cart below the 44×44 floor

**Severity:** Low–Medium · **Found by:** measuring at 390px · **Fixed**

Header search 36×36, cart 36×36, menu toggle 40×40, and the shop grid's Add to
cart **87×28** — repeated once per product, on the money path, on the viewport
most customers arrive on. Same class as B-9 and B-10, against the 44×44 floor
DESIGN.md sets for this project.

**Fix:** `min-h-11`/`min-w-11` with inline-flex centring, the B-9 pattern, not
padding — padding on an icon button depends on the glyph, which is how these
drifted. **Regression:** `tests/e2e/mobile/tap-targets.spec.ts`.

## B-17 · Two variants of one product merged into a single cart line

**Severity:** Medium, but **dormant** · **Found by:** the Shopper walkthrough · **Fixed**

Selecting a variant overrides the product's name, image and price but **not its
slug**, and `lineId` keyed on slug alone. Picking variant A, adding it, then
picking B and adding it produced **one line of quantity two**, showing whichever
was added first. The customer would have received two of the wrong thing.

Dormant, said plainly: **zero visible products have variants.** 5066 variant
rows exist, but every one belongs to a hidden or retired product, and
`/api/variants` answers `{"source":"none"}` for the live catalogue.

Fixed anyway because arming it is a **data** change — unhiding a product or
adding variant rows would enable it with no code review in the way — and the
failure is silent, on the money path. `lineId` now includes the name; safe
because it is derived per render and never persisted.

**Still open in the same area:** the checkout route re-prices every line from
the catalogue by slug (the B-4 guard), so a variant's own price is discarded at
payment. That needs variant-aware pricing, not a patch to the price guard.

## B-18 · A paid order with nothing to make was silent

**Severity:** Medium · **Found by:** inspecting production before seeding · **Fixed**

`if (items.length > 0)` in the webhook had no `else`. An order could be created,
charged and queued with no line items and **no signal at all**; the neighbouring
`catch` logged "Line items fetch failed" without naming the order, so even when
it fired there was no way to tell which order to repair.

Production holds one such order — real, 2026-06-28, `deposit_paid`, six weeks in
the cutting queue with nothing to cut. That one is legacy (item-writing landed
2026-08-01, five weeks later), but the silent path was still live.

Both branches now log the order and session id at **error** level. The webhook
still returns 200 deliberately: the customer has paid, and throwing would make
Stripe retry forever. The requirement is loudness, not failure.

Same family as B-7 — the money path succeeds and the workshop cannot act.

## B-19 · A refunded order looked like one about to start

**Severity:** Medium (customer-facing) · **Found by:** the Order-tracker walkthrough · **Fixed**

`STATUS_INDEX` in `TrackClient` mapped six statuses; the database CHECK accepts
ten. `paid`, `cancelled`, `failed` and `refunded` all fell to `?? -1`, drawing
the pipeline at **0% with no step lit**. The badge was a three-way guess —
green for delivered, red for cancelled, **blue for everything else** — so a
refund appeared in the same colour as an order in progress, above an empty bar.

An operator can set `refunded` and `failed` from the admin dropdown, so these
were reachable states. MiniMax put the cost plainly: the customer concludes the
site is broken and either messages in a panic or calls their bank.

B-7's shape (a status nothing downstream recognises) with B-5's consequence
(telling a refunded customer their order is on its way). **Third time** this
project has been bitten by one status list maintained in several places.

**Fix:** the list, not the four missing entries. `src/lib/order-status.ts`
declares it once and exports `STATUS_PRESENTATION` with
`satisfies Record<OrderStatus, StatusPresentation>`, so adding a status fails
`tsc` until the tracker has been told what to draw. Terminal states leave the
pipeline and carry copy inviting WhatsApp; `refunded` is toned **neutral**, not
negative — the money went back, which is an outcome, not an error.

**Regression:** `src/lib/order-status.test.ts`, including a test pinning the
TypeScript set against the CHECK in migration 0002, parsed from the file so it
needs no database.

## B-20 · Nobody told the operator an order arrived

**Severity:** High (operational) · **Found by:** the operator asking why they get no notifications · **Fixed**

`sendOrderEmail()` addressed `order.customer_email`; `notifyWhatsApp()`
addressed the customer's phone. **Both went to the customer.** There was no
admin recipient anywhere in `src/`. The maker learned an order existed by
opening `/admin` and looking. `.env.example` had documented
`ORDER_NOTIFY_EMAIL` from the start and no code ever read it.

Compounding: the WhatsApp credentials are unset in production, so
`sendWhatsAppMessage` returns false and `notifyWhatsApp` logs a wa.me link to
**container stdout** for manual sending — a path assuming someone reads
container logs. So the customer's WhatsApp was not going out either.

Third in the family after B-7 and B-18: the money path succeeds and the person
who has to act is the one nobody told.

**Fix:** `sendOperatorOrderAlert()`, to `ORDER_NOTIFY_EMAIL || CONTACT_EMAIL`,
carrying the order, value, pieces, engraving and delivery method so the
operator can act without opening `/admin`. Fire-and-forget with an error-level
catch — failing the webhook would make Stripe retry, and the retry
short-circuits on the idempotency check, so the alert would be **skipped
permanently** rather than resent.

**Still open:** WhatsApp Business credentials are unconfigured, so customer
WhatsApp messages remain undelivered. Operator task, not a code change.

---

## B-21 · A single digit was a valid phone for someone else's order

Found walking production as a returning customer, 2026-08-09. **Fixed.**

There are no accounts here, so a pair *is* the credential: `/track` takes order
id + phone, `/account` takes email + phone. A match returns the full record —
name, email, phone, delivery address, totals, tracking.

The comparison was:

```js
ca.endsWith(cb.slice(-8)) || cb.endsWith(ca.slice(-8))
```

`slice(-8)` of a **short** string is the whole string, so a short input *widened*
the match instead of narrowing it. Verified directly:

```
phoneMatches("0501234567", "7")  ===  true
```

Exactly one single digit matches any given number, so **ten attempts sufficed** —
against a rate limit of **ten an hour**. The limiter added in A-21 was sized for
guessing a whole phone number and was never a barrier to guessing one digit.

With a valid order id that returned a stranger's full record; with a known email
address, their entire order history.

**Fix.** A fixed eight-digit window, and a refusal to compare at all when either
side is shorter — so the length of the input can no longer change how strict the
test is. Eight rather than nine because a UAE landline has eight significant
digits, and nine would lock those customers out of the only route to their own
order.

Moved from two private functions in `store.ts` to `src/lib/phone.ts`. Nothing
could reach them without a database, which is why the defect survived; the
extraction paid for itself immediately by catching that measuring length *after*
the `^0 → 971` substitution lets a seven-digit entry pass as nine.

Pinned by 35 unit tests, including "no single digit matches" and "no two-digit
string matches" as exhaustive loops rather than samples.

## B-22 · The phone was never validated server-side at checkout

Found alongside B-21. **Fixed.**

`/api/checkout` did `String(customer?.phone || "").trim().slice(0, 32)` and
nothing else. The only check lived in the checkout page and counted
**characters** — `form.phone.length < 10` — so `"----------"` passed it, and
being client-side it never bound a request that did not come from our own form.

The phone is half the credential for both lookups, so a stored phone that cannot
be compared is **an order the customer can never reach**. There is no account and
no password reset; the only fallback is messaging a human.

**Fix.** Both sides now use `isUsablePhone` from `src/lib/phone.ts`, counting
digits rather than characters.

**Existing data checked:** one order, 12 digits, zero unmatchable — so the
stricter rule locked nobody out.

The e2e guard uses `"(05) 0-1 2-3"` — 12 characters, 6 digits. `"4567"` would
have been rejected by the old rule too, and the test would have passed without
the fix (L-1).

## B-23 · The account phone field said "WhatsApp us"

Found walking production as a returning customer, 2026-08-09. **Fixed.**

`/account` labels the field **Phone Number** and its placeholder read **"WhatsApp
us"** — copy from the contact widget that had leaked into the one field whose
format decides whether a customer finds their order.

It matters more here than a stray placeholder normally would. There is no
account behind this lookup: the number has to be *the one used at checkout*, and
it is matched on the last eight digits. The email field one row up shows
`you@example.com`; the phone field showed nothing useful at all.

Now `050 123 4567`. Pinned by an e2e assertion that the placeholder does not
match `/whatsapp|contact|message us/i` **and** does look like a number — forced
in both directions.

## B-24 · The page returning the most PII had no end-to-end coverage

Found alongside B-23. **Fixed.**

`/account` returns **every order matching an email and phone**, each with the
delivery address — the largest payload the site will hand out. It had:

- **zero** e2e tests (`/track` next door had a suite), and
- **zero** `data-testid` attributes (`/track` had five).

The second caused the first. The page cannot be targeted by input type: the
header search box is also a text input and the WhatsApp float is another `tel`
input, so a type selector fills the wrong element — which is exactly what
happened twice while investigating, and both times looked like a broken page
rather than a broken probe.

Three tests added that need no database, since CI has no Supabase credentials:
the form is real, a lookup that finds nothing discloses nothing, and an unknown
email produces the same wording as a wrong phone so the page cannot be used to
discover whether an address has ordered here.

Each waits on the request as the **precondition** for its absence assertion —
without it, "no order shown" also passes on a form that never submitted (L-2).

## B-25 · An unauthenticated proxy onto a metered third-party API

Found walking production as the operator, 2026-08-09, by listing every API route
against its gate. **Fixed.**

Thirteen of fourteen routes were gated or rate-limited. `GET /api/variants` was
neither, and its `?pid=` branch reached `fetchCJVariants()`, which POSTed to the
CJ Dropshipping API using `CJDS_API_KEY`.

Anyone on the internet could make this shop issue authenticated, **billable**
requests to a metered third-party API, in a loop. Confirmed live before the fix:

```
GET /api/variants?pid=DOESNOTEXIST123
-> 200 {"source":"cj","variants":[],"images":[],"error":"CJ API unavailable"}
```

`source:"cj"` proves the outbound call was attempted, and the key is set in
production. Nothing was *exposed* — it was never a data leak. It was a free
proxy for burning someone else's quota.

**Removed, not gated.** `cjPid` survives in the generated catalogue only as an
optional type field, so no product carries one and no visitor ever reached this
branch — only an attacker could. The dropship model it belonged to was abandoned
(A-10 archived its scripts). A gate on dead code is a thing to maintain and
forget; deletion is not (L-8).

`cjPid` itself stays: MDF products use it as a local marker
(`product.cjPid?.startsWith("MDF")`), which never leaves the process.

The test sets `CJDS_API_KEY` deliberately, so it proves the branch is **gone**
rather than merely inert for want of a credential, and asserts on `fetch` never
being called. Against the old route it fails with *"expected fetch to not be
called at all, but actually been called 1 times"*.

**The part worth remembering:** this was written down in FOR-EVARISTE *and* in
ACTORS.md as the worked example of "a new API route is public on creation" — and
stayed open anyway. Documenting a hole is not closing it. Both documents now
describe it in the past tense.

Verified live after deploy: `?pid=DOESNOTEXIST123` -> `{"source":"none"}`.

## B-26 · The admin dropdown kept its own copy of the status set

Found walking production as the workshop operator, 2026-08-09. **Fixed.**

`/admin` hand-maintained a list of nine statuses while `src/lib/order-status.ts`
— created for B-19 precisely to be the single source of truth — holds ten.

The copy was **correct**, but only by attention. A status added to the canonical
set would simply not appear in the dropdown, and nothing would say so. That is
B-19's structure in the one place that **writes** the value rather than renders
it, which is the more expensive direction to get wrong.

**Fix.** `SETTABLE_STATUSES` — everything except the legacy `paid` — derived from
the canonical set, so the exclusion is a stated decision instead of an omission.

`paid` must stay unsettable: it is not in `QUEUE_STATUSES`, so an order moved
into it **disappears from the cutting queue while still looking paid to the
customer**. That is B-7, which reached production once already when the webhook
wrote `paid` and nobody could see the order to make it. The test pins the reason,
not just the list, so the exclusion cannot be tidied away later.

## B-27 · A mistyped status reported "Order not found"

Found alongside B-26. **Fixed.**

`PUT /api/orders` never validated `status`. A value the database CHECK rejects
reached `orderStore.update()`, which swallows the error and returns `null` — and
the route read that `null` as "no such order":

> **404** `{"error":"Order not found"}`

…for an order that exists and is perfectly fine. The operator is then looking for
a lost order instead of a typo. Wrong diagnosis, and the expensive kind.

**Fix.** A **400** naming the offending value, before the write is attempted. The
genuine 404 path is kept and still tested, so this is a new distinction rather
than a blanket replacement — removing the validation fails both 400 tests.

Verified live after deploy: an unauthenticated `PUT` still answers **401**, so
the admin gate runs *before* validation and an anonymous caller learns nothing
about which statuses exist.

## B-28 · A refund in Stripe never reached the shop

Found walking production as the workshop operator, 2026-08-09 — **without
touching Stripe**. **Fixed.**

`checkout.session.completed` was the **only** event the webhook understood.

So refunding a customer in the Stripe dashboard left the shop with no idea it
had happened:

- the order kept whatever status it had;
- the customer's tracker went on showing it **progressing**;
- it stayed in the **cutting queue**, so the workshop could cut a piece for an
  order that had already been paid back.

It depended entirely on the operator remembering to repeat the refund by hand in
`/admin`, and nothing would say so if they forgot. That is B-5's shape —
"telling a refunded customer their order is on its way" — one layer earlier.

`refunded` was already a first-class status: in the CHECK constraint, with an
email template, and drawn by the tracker as a terminal "Refund complete" card
(B-19). **Only the automatic route into it was missing.**

**Fix.** A `charge.refunded` branch. No schema change and no call out to Stripe:
the event carries `payment_intent`, and the webhook has always written
`stripe_payment_intent` on the order — the column was there and nothing read it.

- **Partial refunds count.** This shop sells single made-to-order pieces at one
  price, so a partial refund means a human decided something went wrong.
- **Idempotent.** Stripe retries, and a second partial arrives as another event;
  an order already `refunded` is left alone and not re-emailed.
- **A charge with no matching order logs at ERROR** — *"the customer has their
  money back and the shop does not know"* — but still answers **200**, because a
  non-2xx would make Stripe retry an event that can never succeed.

Driven entirely by **synthetic signed events**, which is the only reason any of
the payment path could be tested at all while the shop is on live keys. Removing
the branch fails three tests.

Verified live after deploy: an unsigned POST still answers **400 Invalid
signature**, so a forged refund event cannot move an order.

## Still open

| Bug | Where |
|---|---|
| `GET /api/variants?pid=` is an unauthenticated, unthrottled proxy to the CJ API on the shop's `CJDS_API_KEY` | `docs/QA/ACTORS.md` — found while mapping the actor model; no data exposed, but anyone can spend the quota |
| Clearance listing materially misdescribed | `ACTION_PLAN.md` A-16 — listing hidden; recount blocked on the photos |
| Exposed GitHub PAT in nine containers | A-0b — needs the account owner |
| Toys labelled ages 1–3 with no EN 71-1 assessment | `docs/COMPLIANCE-UAE-TOY-SAFETY.md` |
| No Arabic on a UAE storefront | `docs/DECISION-ARABIC-RTL.md` — may be a legal obligation |

---

## B-29 · "console.error so it reaches GlitchTip" — it did not

Found answering "is the admin notified for everything that happens on the
platform?", 2026-08-10. **Fixed.**

Three separate places logged a `console.error` and treated that as the alert,
one of them saying so in a comment:

```ts
// … console.error so it reaches GlitchTip, not console.log.
console.error(`[stripe-webhook] order ${orderId} has NO LINE ITEMS …`);
```

**`captureConsoleIntegration` is opt-in, and was never configured.** Without it
the Sentry SDK records a `console.error` as a **breadcrumb** — carried along
with some later event, and if no later event ever occurs, discarded. It is never
an event of its own.

So B-18 — a **paid order with no line items**, which the workshop cannot make —
had been reporting to nobody at all, while the code, a comment, and a BUGS entry
all said it was loud. It is the same shape as the CI pipeline that had never
run: a thing that produces no failures looks identical to a healthy one.

Compounding it, `sampleRate` was **0.25** in both server and edge config —
"only send 25% of errors" — so even genuine exceptions were three-quarters
discarded, on a shop with near-zero traffic and no quota pressure to justify it.
The edge value sat under the comment *"edge middleware runs on every request —
keep sampling very low"*, which confuses `sampleRate` (errors) with
`tracesSampleRate` (transactions, the setting that actually governs volume).
After D-016 the proxy runs in front of **every** API route, so that was the
highest-consequence error surface in the app, sampled away three times in four.

### And four events reached the operator through no channel at all

| Event | Before | Now |
|---|---|---|
| Order paid | e-mail + WhatsApp button | unchanged |
| **Refund** | customer e-mailed, operator not told | e-mail, incl. partial-refund amount |
| **Refund with no matching order** | `console.error` into the void | e-mail — nothing else will ever surface it |
| **Paid order, no line items** | `console.error` into the void | e-mail naming the Stripe session |
| **New review published** | nothing | e-mail with the rating and comment |

The refund pair is the worst of them: money had left the account, and in the
unmatched case there is no order id, no customer name and no status that will
ever change — so unlike every other failure here, nothing in the shop would
later hint that it happened.

Reviews have no moderation queue — correct for a verified-purchase-only shop —
but it meant a two-star review, or a comment that should not sit on a family
business's product page, went live with the operator's only route to knowing
being to browse their own shop.

**Fix.**

1. `captureConsoleIntegration({ levels: ["error"] })` in the server and edge
   configs. Scoped to `error`: capturing `warn` would turn the proxy's
   every-blocked-bot-probe warning into a stream of issues, and a channel that
   is mostly noise stops being read (L-5).
2. `beforeSend` now reads `event.message` as well as `event.exception`. Without
   this the change **backfires** — a console-captured event is a *message*, so
   the existing "Webhook signature verification failed" filter would miss it and
   every bot POSTing to `/api/stripe-webhook` would flood the channel.
3. `sampleRate: 1.0` in both configs. The noise filters, not sampling, are what
   keep the free tier affordable.
4. `sendOperatorNotice(subject, html)` in `src/lib/email.ts` — generic on
   purpose, so the next such event costs one line rather than another
   mail-shaped thing to keep in step (the drift that made B-5 possible). It
   **never throws**: every caller is fire-and-forget inside a Stripe webhook,
   where throwing would fail the webhook, Stripe would retry, and the
   idempotency guard would then skip the real work — losing the notice *and*
   mishandling the order.
5. `escapeHtml`, because a review comment and a customer name are typed by
   strangers and now travel into an e-mail. The realistic damage is not a script
   running in a mail client; it is one `<` swallowing the rest of the sentence,
   so the alert written to be read carefully arrives truncated.

**Tests.** Nine, red first. The two that matter most are preconditions (L-2):
one proves a *normal* order raises no "no line items" alert, and one proves a
*rejected* review raises no review alert — without them both assertions would
pass against a webhook that shouts about everything.

**The first draft of that precondition passed while asserting nothing.** The
shared harness defaults `listLineItems` to `{ data: [] }`, so every "normal"
order in that file is an empty one. It only became load-bearing once given real
line items — the same trap as B-21's e2e guard, where the string chosen to prove
the fix was rejected by the old rule too.

**Deliberately still silent:** newsletter signups (the admin has a subscribers
page, and a per-signup e-mail is noise), and admin login failures (rate-limited
by A-21; an alert per failed attempt is a self-inflicted flood).

---

## B-30 · Every email this shop ever sent was refused, and every send reported success

Found on 2026-08-10 **while verifying the B-29 deploy** — the alert fired, the
review published, no error appeared anywhere, and no email arrived. **Fixed in
code; one operator action outstanding.**

**Resend does not throw when it rejects a send.** Its own installed type says so:

```ts
type Response<T> = { data: T; error: null } | { error: ErrorResponse; data: null }
```

All three send paths in `src/lib/email.ts` were written as though it did:

```ts
try {
  await mailer().emails.send({ … });
  return true;                    // ← reached for a 403 just as surely as a 202
} catch (error) { return false; }  // ← only ever catches DNS/TLS/timeout
```

The first one was worse than the other two: it logged the result object under
the words **"Email sent"** — and the result object is exactly where the
rejection lives.

**What was actually happening.** `MAIL_FROM_ADDRESS` and `RESEND_FROM_ADDRESS`
are unset, so the sender is the literal default `orders@lebon-grace.com`. POSTing
that from the production container returns:

```
403 {"message":"The lebon-grace.com domain is not verified…","name":"validation_error"}
```

The last 50 emails on that Resend account are from `mirrortales.com`,
`axiomsynapse.com`, `mail.vouchnexus.com` and `jobs.trusted-metrics.com`.
**Not one is from this shop.** Order confirmations, status updates, the
post-delivery review request, the operator's new-order alert — none of it has
ever been delivered, on a shop taking live Stripe payments.

A code comment on `fromAddress()` asserted the default "is a verified SES
identity with DKIM — so it works on either provider". It may be verified on SES.
The app sends through Resend. That is L-22 twice in one day: **a considered
comment is believed more readily, not less.**

**How it hid.** Three layers agreed with each other and all three were wrong:
the code assumed throw-on-error; the comment asserted the domain was fine; and
`email.test.ts` mocked `send` as resolving `{ id: "e1" }` — the shape of `data`,
not of the response — so **no test could express a rejected send.** The harness
modelled the library as the code wished it worked. E-1's "contact form delivers
(200 from Resend)" was reading the route's own HTTP status, not Resend's.

**Fix.** One `deliver(label, payload)` helper used by all three paths. It reads
`error`, logs the provider's own message (which names the cause), and returns
false. Never throws — every caller is fire-and-forget inside a Stripe webhook.
The test mock now carries the SDK's real `{data, error}` union, so a rejection
is expressible; five tests cover it, including the precondition that all three
still return true on a clean send.

**Still required, and it is not a code change:** verify `lebon-grace.com` at
https://resend.com/domains, or point `MAIL_FROM_ADDRESS` at a domain already
verified on that account. **Until then the shop still sends nothing** — this
change only makes the failure audible instead of silent.

---

## B-31 · `instrumentation.ts` was in the wrong folder, so Sentry never initialised

Found 2026-08-10. **Fixed.** Root cause identified on the third attempt; the
second attempt caused an **11-minute production outage**.

### The fault, and it is one line

`instrumentation.ts` sat at the **repo root**. This app keeps its code in
`src/app`, and when `src/` is used the hook must be **`src/instrumentation.ts`**.
Next silently ignores a root-level file in that layout — no build warning, no
boot warning, no runtime error.

So **`register()` had never been called, once, in the life of this project.**
`Sentry.init` never ran. Every server `console.error` and every unhandled server
exception went nowhere. GlitchTip stayed populated the whole time — by the
browser bundle and by the uptime check, which is a shell script that posts
directly — which is exactly why nobody noticed.

### The measurement that found it

Two earlier diagnoses blamed `output: "standalone"` and Turbopack file tracing.
Both were wrong, and one test killed them:

| | envelopes reaching a fake ingest |
|---|---|
| root hook, standalone server | **0** |
| root hook, **`next start`** | **0** ← not standalone-specific at all |
| `src/` hook, webpack build | 2 |
| `src/` hook, **Turbopack (default)** | **1** ✓ |

`next start` failing identically ruled out standalone, tracing and the bundler
in a single step. A temporary `console.log` inside `register()` then never
printed, which named the cause outright.

### The fix

Move the file. `instrumentation.ts` → `src/instrumentation.ts`, with `../`
imports because the Sentry configs stay at the repo root (`withSentryConfig` and
the Sentry CLI expect them there). **No bundler change** — Turbopack was checked
specifically, so the `next build --webpack` workaround discussed in
[vercel/next.js#88844](https://github.com/vercel/next.js/issues/88844) is not
needed here.

### What went wrong on the way, and why it matters more than the fix

**Attempt 1** added `outputFileTracingIncludes`. No effect — Next excludes its
own `.next` output from tracing input.

**Attempt 2** copied the Sentry chunk and `instrumentation.js` into the
standalone output. It passed every static check and a behavioural check, then
crash-looped the container:

```
Failed to prepare server Error: An error occurred while loading instrumentation
hook: Cannot find module 'require-in-the-middle-2ca7b9c2766f317e'
```

Next excludes the whole instrumentation subgraph *including its node_modules
externals*, so a copied chunk requires something that was never shipped. **The
behavioural check passed because it ran `node .next/standalone/server.js` from
inside the repo, where Node walks up into the full `node_modules`.** The
container has only the pruned copy (L-26). `scripts/prove-sentry-init.mjs` now
runs from an isolated copy outside the project tree.

**And the false certainty that made attempt 2 possible:** I had recorded
"instrumentation.ts placement — ruled out, Next's
`getPossibleInstrumentationHookFilenames` checks both the root and `src/`". That
function enumerates *candidates*; it is not the resolution rule. A plausible
citation, confidently written down, sent two attempts in the wrong direction —
which is L-22 again, this time in my own notes rather than someone else's
comment.

### Guard

`scripts/seal-standalone.mjs` runs as part of `npm run build` and **fails** if
the compiled Sentry init is absent from the standalone output. Forced in both
directions: hook removed → exit 1; hook restored → exit 0. It no longer copies
anything and says so, because copying is what caused the outage.

Presence of the marker is a proxy for "the chain is intact", not proof of
delivery. For that, `scripts/prove-sentry-init.mjs` counts envelopes arriving at
a real ingest from an isolated standalone copy — run it after any change to the
build, the bundler, the hook, or the Sentry config.


---

## B-32 · The "fingerprint" in the webhook diagnostic was six characters of the signing secret

Found 2026-08-10 while triggering a real error in production to verify B-31.
**Fixed.**

The signature-failure diagnostic printed:

```
[stripe-webhook] SIGNATURE VERIFICATION FAILED. mode=live secret=...QB7iM3 …
```

and the comment beside it read *"the fingerprint is a truncated hash"*. It was
not. It was:

```ts
const fingerprint = (process.env.STRIPE_WEBHOOK_SECRET || "").slice(-6).padStart(6, "*");
```

— the literal last six characters of `STRIPE_WEBHOOK_SECRET`, written to
stdout, to `docker logs`, and, since B-29 switched console capture on, to
GlitchTip as well. The endpoint is public, so anyone can provoke that log line;
what they cannot see is the output, which is the only reason this was small
rather than serious.

**Six characters of a `whsec_…` secret is not an exploit.** It is a secret in a
log file, and it was there because a comment asserted a safety property the code
did not have. That is the third time in one day: `console.error` "reaches
GlitchTip" (B-29), `orders@lebon-grace.com` is "a verified SES identity" (B-30),
and now this. **A considered-sounding comment is believed more readily, not
less** (L-22).

**Fix.** `sha256(secret)` truncated to 12 hex characters, and the label renamed
from `secret=...` — which reads like a truncation of the value — to
`secret_sha256=`.

It keeps everything the fingerprint existed for: stable for a given secret, so
an operator can compare the log against the Stripe dashboard, and different for
different secrets, so "live keys deployed with the TEST signing secret" is still
visible at a glance. 48 bits is far too little to attack a secret with and ample
to tell two apart.

**Tests, red first.** Three. The important one asserts that **no tail of the
secret, from 4 characters up, appears in the log** — `.slice(-6)` and every
relative of it fails that, and a hash cannot. Paired with a precondition that
two different secrets still produce different fingerprints, because printing a
constant would satisfy the leak test while destroying the diagnostic.
