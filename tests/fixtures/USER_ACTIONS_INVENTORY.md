# User actions inventory

MASTER-QA-PROTOCOL §10 — the canonical checklist of everything a person can do
here, and whether a test does it.

**The rule: if a route or an action changes, this file changes in the same
commit.** `tests/fixtures/sitemap.json` is generated
(`node ../ops/qa/discover-routes.mjs .`) and had already drifted two routes
behind the app once; this one is written by hand and depends entirely on the
rule above being kept.

Legend — ✅ a test performs it · 🟡 the surface is crawled but the action is not
performed · ⬜ not covered.

---

## Public — browsing

| Action | Status | Where |
|---|---|---|
| Load every public page without a crash, spinner-hang, broken asset or placeholder | ✅ | `navigation/smoke.spec.ts`, all 3 viewports |
| Browse the catalogue, filter by category / price tier | 🟡 | `product-filters.test.ts` covers the logic; the UI is crawled only |
| Open a product page | ✅ | `money-path/checkout.spec.ts` |
| Search from the header | ⬜ | |
| Open the mobile nav and navigate | ✅ | `mobile/layout.spec.ts` |
| See reviews on a product | 🟡 | renders `null` with none, which is the current state |

## Public — the money path

| Action | Status | Where |
|---|---|---|
| Add to cart (desktop control) | ✅ | `money-path` |
| Add to cart (mobile sticky bar) | ✅ | `mobile/layout.spec.ts` |
| Add with an engraved name | ⬜ | unit-covered in `cart-context.test.tsx` (`lineId`) |
| Change quantity in the cart | ✅ | `money-path` |
| Remove a line | ⬜ | |
| Switch delivery ⇄ collection | ✅ | `money-path` |
| See delivery charged below AED 150, free at exactly 150 | ✅ | `money-path` — boundary |
| Keep the cart across a reload | ✅ | `money-path` |
| Keep the delivery choice across a reload | ✅ | `money-path` (regression, B-8) |
| Reach checkout from the cart | ✅ | `money-path` |
| Be stopped at checkout with an empty cart | ✅ | `money-path` |
| Submit checkout and have the right payload sent | ✅ | `money-path` — Stripe intercepted |
| Be told clearly when checkout fails | ✅ | `failure-modes` (regression, B-1) |
| Keep the basket when checkout fails | ✅ | `failure-modes` (regression, B-1) |
| Retry after a failure | ✅ | `failure-modes` |
| Return from Stripe successfully | ✅ | `failure-modes` (B-2) |
| Pay on Stripe's page | ⬜ | **deliberate** — not ours to test, and the account is live |

## Public — after ordering

| Action | Status | Where |
|---|---|---|
| Track an order with id + phone | ✅ | **verified end-to-end 2026-08-09** against a seeded delivered order on production, then removed |
| Be refused with the wrong phone | ✅ | `money-path` |
| See a clear error when lookup fails server-side | ✅ | `failure-modes` |
| Look orders up by email + phone (`/account`) | ✅ | **verified end-to-end 2026-08-09**; unknown email returns a merged 404 |
| Leave a review for a delivered order | ✅ | **verified end-to-end 2026-08-09**: 201 created, 409 duplicate, 403 product not in order, 404 wrong phone |
| Unsubscribe from the newsletter | 🟡 | page crawled |
| Contact / WhatsApp | 🟡 | float presence and position tested |

## Admin

| Action | Status | Where |
|---|---|---|
| Log in | 🟡 | crawled; throttle unit-covered (`login-throttle.test.ts`) |
| Be throttled after 5 failures, across a restart | ✅ | verified end-to-end against the real DB (A-21) |
| See the cutting queue | ⬜ | `production-queue.test.ts` covers the ordering logic (16 cases) |
| Change an order's status | ⬜ | `api/orders/route.test.ts` covers the notify-once rule |
| Edit or delete a product | ⬜ | |

## Not applicable

No registration, login, password reset, plans, upgrades, downgrades, paywalls or
OAuth — **this shop has no customer accounts**. See `docs/QA/SYSTEM_MAP.md`.
Roughly half the protocol's §11 checklist names routes belonging to a different
product.

---

## Biggest remaining gaps

1. ~~Track a real order end-to-end~~ — **closed 2026-08-09.** A `delivered`
   order was seeded directly into production, the whole post-purchase path was
   driven against it (track, account, review, and every refusal), and the rows
   were deleted afterwards. Verified back to `orders=1 items=0 reviews=0`.
   `delivered` is deliberately not a queue status, so it never entered the
   cutting queue. Procedure in `project_lebon-grace_playbooks.md`.
2. ~~Remove a line from the cart~~ — **closed**; decrementing at quantity 1
   removes the line and the empty-cart state renders.
3. **Admin order-status change in a browser** — the notify-once rule is
   unit-tested, but nobody clicks the dropdown.
