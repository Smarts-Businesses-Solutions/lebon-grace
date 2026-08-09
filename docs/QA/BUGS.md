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

---

## Still open

| Bug | Where |
|---|---|
| `GET /api/variants?pid=` is an unauthenticated, unthrottled proxy to the CJ API on the shop's `CJDS_API_KEY` | `docs/QA/ACTORS.md` — found while mapping the actor model; no data exposed, but anyone can spend the quota |
| Clearance listing materially misdescribed | `ACTION_PLAN.md` A-16 — listing hidden; recount blocked on the photos |
| Exposed GitHub PAT in nine containers | A-0b — needs the account owner |
| Toys labelled ages 1–3 with no EN 71-1 assessment | `docs/COMPLIANCE-UAE-TOY-SAFETY.md` |
| No Arabic on a UAE storefront | `docs/DECISION-ARABIC-RTL.md` — may be a legal obligation |
