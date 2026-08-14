# Lebon Grace — Newsletter Subscriber Deep Walkthrough

**Target:** homepage newsletter + `/unsubscribe` · **Date:** 2026-08-10 · **Persona:** prospective subscriber. No valid address was subscribed or removed.

## Contract and cadence
English-only, no plan/tier. Subscription is one-shot; the guide truthfully says there is no welcome email, no offer and no campaign currently scheduled. Unsubscribe is a one-shot privacy action; it should not disclose whether an address was ever subscribed. Order email remains outside this list.

## Production evidence
In isolated Edge desktop and 393px mobile, structurally invalid `a@b` was sent to the homepage form. Both responses were **400** and the UI showed `Please enter a valid email address`; no success state, horizontal overflow or unhandled page failure occurred. The browser console 400 is the handled validation response. Direct invalid checks for subscribe/unsubscribe also returned 400 without a write.

`email-address` and admin-subscriber route tests: **43/43 passed**.

## Confirmed findings

### NS-01 — MEDIUM — Subscription has no ownership confirmation
**Evidence:** `POST /api/newsletter` validates only address shape and immediately calls `subscribers.add(email, "homepage")` (`route.ts:31–42`). There is no confirmation token/mail/consent record. The current guide confirms no confirmation email is sent.

**Impact:** any visitor can add another person’s syntactically valid address. This creates a future unsolicited-marketing/compliance and complaint risk once campaigns start; the fact that no campaign currently exists avoids immediate email harm but not invalid list provenance.

**Fix:** use double opt-in before an address becomes marketable, recording consent timestamp/source/version; provide a staff-only way to distinguish pending from confirmed subscribers.

### NS-02 — LOW — Home form advertises future email without actionable expectation setting
**Evidence:** UI says `We will email you when there is something new`; the guide says no campaign has ever been sent and no send path exists (`USERGUIDES.md:289–296,320`).

**Impact:** an honest but open-ended promise can look like a broken signup to a subscriber expecting a confirmation or timing estimate.

**Fix:** add inline copy: `No confirmation email or regular schedule yet. We will write only when there is workshop news.`

## Positive controls
- Safe shape validation before persistence; five signups/hour IP ceiling and honeypot.
- Unsubscribe uses the same success response whether the address exists, preventing list-membership disclosure.
- Invalid unsubscribe fails cleanly; successful delete is handled server-side.
- Subscriber export is admin-only and covered by route tests.

## Evidence
`audits/newsletter-2026-08-10/evidence/newsletter-edge.mjs`, JSON and screenshots. Next queued role: **Admin**.
