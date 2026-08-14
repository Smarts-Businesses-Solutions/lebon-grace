# Lebon Grace — Admin Deep Walkthrough

**Target:** `/admin` and protected APIs · **Date:** 2026-08-10. No password was entered; no record/change/export occurred.

## Evidence
Unauthenticated production requests: `/api/admin/login` → `200 {"authenticated":false}`, `/api/admin/subscribers` → `401`, `/api/orders` → `401`. Isolated mobile Edge login loaded with password field, zero overflow and no console errors. Source uses httpOnly signed 12-hour HMAC session, durable failed-login throttle, constant-time compare, and secure production cookie.

## Confirmed findings

### AD-01 — HIGH — Status changes that can notify customers have no confirmation step
The guide explicitly says a status change can email the customer (`USERGUIDES.md:369–375`). The admin order table changes status immediately on `<select onChange>` (`admin/page.tsx:320`) and optimistically shows success once the API returns (`:132–139`). There is no confirmation, summary of customer-facing text, or undo.

**Impact:** a misclick can send a premature/different status communication to a customer.

**Fix:** confirmation dialog for notification-producing transitions showing order/customer/status/template; separate internal note from customer notification; retain audit event/undo where allowed.

### AD-02 — MEDIUM — Shared admin identity gives no human accountability or action audit trail
The guide states one shared login means actions are attributed only to `admin` (`USERGUIDES.md:357–359`). Source exposes destructive product delete and customer-notifying status changes without an actor/action audit trail in this UI.

**Impact:** workshop cannot identify/reverse an operator error or establish who accessed/changed PII-bearing records.

**Fix:** individual operator identities (or at minimum named operator entry), append-only audit records for login/export/product/order actions, and reviewed session expiry/revocation.

## Positive controls
Protected data endpoints deny anonymous access; subscriber CSV quotes values; session cookie is httpOnly/sameSite Lax/secure in production; missing secrets deny access; login failures use durable throttle.

## Evidence
`audits/admin-2026-08-10/evidence/admin-edge.mjs`, JSON and mobile screenshot. Next: Operations / Workshop Operator.
