# Lebon Grace — Returning Customer Deep Walkthrough

**Target:** `https://shop.lebon-grace.com/account` · **Date:** 2026-08-10 · **Persona:** accountless returning customer.

## Guide contract
Account is a lookup—not an authenticated account—using email + the checkout phone, returning all matching orders. It has no tier, password, persistent server session, locale variants, saved address or one-click reorder. The customer uses it occasionally after purchase/lost confirmation. The guide specifies an eight-significant-digit phone match and ten lookups/hour.

## Evidence
- Isolated Edge desktop and 393px mobile: an unknown email + phone produced the intended ambiguous `No orders found with this email and phone.` message; no order detail was exposed, no overflow or unhandled console failure occurred (the browser’s 404 resource message is the handled lookup response).
- Source confirms both factors, shared hit/miss rate limiting and no anonymous all-orders branch (`api/orders/route.ts:27–57`). Phone comparison refuses short input before suffix matching (`lib/phone.ts:54–82`).
- Visual mobile review: controls and error state legible.

## Confirmed findings

### RC-01 — MEDIUM — Returning-customer production E2E is failing in all device projects
**Evidence:** current Edge run of `tests/e2e/account/lookup.spec.ts`: **6 passed, 3 failed**. The failure is the “does not distinguish an unknown email from a wrong phone” test in desktop, mobile-iOS and mobile-Android. All time out at `page.waitForLoadState("networkidle")` before form entry, then Playwright closes the page (`locator.fill: Target page, context or browser has been closed`).

**Root cause:** test comments acknowledge analytics can keep network idle from happening, but the suite still waits for it at `lookup.spec.ts:76–78`. The actual direct Edge walkthrough that waits for hydration instead completed normally.

**Impact:** CI loses the enumeration-regression proof on all three device projects; a green broad run cannot be assumed to cover it.

**Fix:** replace `networkidle` with `domcontentloaded` plus a specific hydration/interactive-form wait, then keep the API-response and identical-message assertions.

### RC-02 — MEDIUM — Successful lookup stores the lookup credential in persistent browser storage
**Evidence:** successful branch writes plaintext email + phone to `localStorage` (`AccountClient.tsx:59–62`). Those are the exact two lookup factors; the source says the matching response includes full customer order history and addresses (`api/orders/route.ts:16–18`).

**Impact:** shared-device users retain personal lookup data beyond the session; any same-origin script/XSS can read it. The visible “Sign Out” only resets React state (`AccountClient.tsx:259–264`) and does not remove this key.

**Fix:** do not persist the credential, or make “remember” explicit with expiry and clear it on Sign Out. Consider a short-lived httpOnly lookup session if persistence is needed.

### RC-03 — LOW — Dashboard status colour map is not exhaustive
`STATUS_COLORS` lacks `paid`, `failed`, and `refunded`, so it falls back to `deposit_paid` yellow (`AccountClient.tsx:20–28,204–205`). Tracker correctly gives terminal states appropriate copy. A returning customer can therefore see a refunded/failed historical order styled as a payment-pending order.

**Fix:** reuse the exhaustive `STATUS_PRESENTATION` map rather than duplicating a partial map.

## Limits
No valid customer email/phone, order history, address, or stored credential was accessed; real successful dashboard/reorder lifecycle requires owned seeded data. The current guide claims mail delivery is restored; this audit did not send mail.

## Evidence files
`audits/returning-2026-08-10/evidence/returning-edge.mjs`, JSON and screenshots. Next queued role: **Reviewer**.
