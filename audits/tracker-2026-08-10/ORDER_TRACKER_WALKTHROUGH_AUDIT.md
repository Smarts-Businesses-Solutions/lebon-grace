# Lebon Grace — Order Tracker Deep Walkthrough

**Target:** `https://shop.lebon-grace.com/track` · **Date:** 2026-08-10 · **Persona:** non-account order tracker.

## Scope boundary
The guide defines an accountless English-only shopper: no tiers, plans, saved sessions or locale variants. Tracking is an occasional post-purchase task using the order ID plus the phone supplied at checkout. It is rate-limited to ten lookups/hour. No real customer credentials, order, payment, e-mail or WhatsApp message was used.

## Production walkthrough evidence
- In isolated Edge at desktop and 393px mobile, a deliberately non-existent ID + syntactically plausible phone returned the correct ambiguous error: **“Order not found or phone doesn't match.”**
- No horizontal overflow occurred. Visual review found no clipping or unusable controls in either error state.
- The browser reports the expected failed resource for the handled API 404; the page displayed the error cleanly. It is not an unhandled application error.
- Source confirms identifier + phone must both be supplied (`TrackClient.tsx:53–68`; `/api/orders/route.ts:42–48`) and the endpoint rate-limits hit and miss alike (`:27–30`).
- Status presentation centrally covers all ten database states; refunds/cancellations/failures intentionally receive terminal messages rather than an empty in-progress pipeline (`src/lib/order-status.ts:91–124`).
- Targeted tests passed: **24/24** (`orders/route.test.ts`, `order-status.test.ts`).

## Confirmed findings

### TR-01 — HIGH — Email delivery outage can strand a tracker without their order ID
The guide states the sender domain is unverified, so confirmation mail is refused. The guide says the order ID comes from that confirmation; it offers Account (email + phone) as fallback. A shopper who loses/misses confirmation therefore cannot use the primary Track flow.

**Fix:** resolve sender-domain verification, then run an approved owned order lifecycle to prove confirmation mail, Track lookup and Account fallback together.

### TR-02 — MEDIUM — Lookup throttling resets at deploy/restart and is not shared across replicas
`src/lib/rate-limit.ts:4–20` uses an in-memory Map, deliberately reset by deploy/restart and independent per replica. The track credential protects personal order data, so this is a source-verified operational security risk rather than a live exploitation claim.

**Fix:** durable shared/edge rate limiting and an operational multi-instance/restart test.

### TR-03 — LOW — No safe production regression covers a real returned order lifecycle
The Edge money-path suite safely covers refusal/error behaviour; lifecycle presentation is unit-tested. There is no production-safe seeded order that proves a live matching customer sees each tracking status, courier number, refund, cancellation and failed-payment state.

**Fix:** add controlled seeded/read-only test records or staging fixture support; never probe real customer orders.

## Controls verified
Admin list/update routes require admin authorization; guest tracking never lists all orders. The lookup error is deliberately ambiguous, and no real tracking/order record was disclosed in this walkthrough.

## Evidence
`audits/tracker-2026-08-10/evidence/tracker-edge.mjs`, JSON, and desktop/mobile screenshots. Next queued role: **Returning Customer**.
