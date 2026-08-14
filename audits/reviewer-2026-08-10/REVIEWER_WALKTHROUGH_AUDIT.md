# Lebon Grace — Reviewer Deep Walkthrough

**Target:** `https://shop.lebon-grace.com/review` · **Date:** 2026-08-10 · **Persona:** delivered-order customer. No review was submitted.

## Contract verified
English-only, no tiers. A reviewer must provide order ID + checkout phone; only delivered/completed orders and items in that order can be reviewed, once per item. Rating/comment/name are published immediately; email, phone and address are not. This is a one-shot post-delivery task, not a scheduled recurring workflow.

## Production evidence
Isolated Edge desktop and 393px mobile used a deliberately nonexistent order (`ord_nonexistent`) with dummy phone. Both displayed the deliberate ambiguous refusal, had zero horizontal overflow, and no unhandled page error. The browser console’s 404 is the handled negative API response. Mobile controls/error/link were readable and not overlapped.

Route unit suite: **26/26 passed**. The expected mocked operator-mail outage test logs an intentional `resend down` error while asserting the review remains published.

## Confirmed findings

### RV-01 — MEDIUM — Review eligibility GET scans every order item after authentication
**Evidence:** `GET /api/reviews?order=…&phone=…` calls `orderItems.getAll()` then filters in application memory (`src/app/api/reviews/route.ts:46–48`). The POST path correctly uses the order-scoped database query (`:113–116`), and its own source comment records why whole-table reads are unacceptable at scale.

**Impact:** a valid delivered reviewer can cause a full `order_items` load just to see their own pieces. This grows with every order and risks slow/error-prone review lookup.

**Fix:** use `orderItems.getByOrder(String(order.id))` in GET, exactly as POST does; add a mocked regression assertion that `getAll` is never called.

### RV-02 — LOW — No browser E2E covers the review journey
**Evidence:** repository inventory finds unit coverage for `api/reviews` but no `tests/e2e` review spec. The only production proof in this walkthrough is the safe negative lookup; the delivered-order → list items → stars → duplicate-state UI cannot be exercised without controlled owned data.

**Impact:** server rules are unusually well unit-tested, but client wiring and mobile review controls can regress without CI detection.

**Fix:** add seeded/mock E2E coverage for delivered, undelivered, wrong credential, ownership refusal, duplicate review and keyboard star selection—never a production POST.

## Positive controls
The route validates rating 1–5, caps comments at 1,000 chars, preserves the order’s name rather than accepting one from the browser, checks ownership/delivery/duplicate state, escapes the operator alert, and has a database unique backstop. These controls are directly covered by the 26 passing unit tests.

## Evidence
`audits/reviewer-2026-08-10/evidence/reviewer-edge.mjs`, JSON and mobile/desktop screenshots. Next queued role: **Newsletter Subscriber**.
