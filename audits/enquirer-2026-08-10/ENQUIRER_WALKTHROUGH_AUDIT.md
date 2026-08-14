# Lebon Grace — Enquirer Deep Walkthrough

**Production target:** `https://shop.lebon-grace.com/contact`  
**Audit date:** 2026-08-10 · **Persona:** prospective/enquiring customer, no account  
**Browsers:** isolated Microsoft Edge / Playwright contexts; no user browser tab was opened, reused or closed.

## Decision

**Not ready to treat the enquiry channel as independently proven.** The validation and contact-reveal paths behave correctly in the tested desktop and mobile contexts. The current guide claims the sender domain is verified and delivery has been observed, but this audit did not send a real message; mobile typing has a measurable 65px sticky-header overlap, and the form collects a phone number which the server drops.

## Role, tiers, languages and cadence

The relevant guide (`USERGUIDES.md:11–30`) has two roles only (customer/operator), no customer tiers, accounts, plans or non-English locale. An enquirer uses the contact form or WhatsApp as a one-shot/occasional workflow; no daily/weekly/monthly/annual task is defined. The guide promises a normal response within 24 business-day hours, Monday–Saturday (`ContactClient.tsx:68–71`), which cannot be independently proven without sending real correspondence.

No real enquiry, recipient email, WhatsApp message or newsletter subscription was sent. A direct API validation request with a structurally invalid email returned 400 before mail sending; browser checks used client-invalid text only.

## Evidence-led positive results

| Area | Result |
|---|---|
| Contact page, desktop + 393px mobile Edge | Loaded; no console error, failed request or horizontal overflow. |
| Client validation | A short message showed “Message must be at least 10 characters”; no success state appeared. |
| Server validation | `POST /api/contact` with `invalid@broken` returned `400 {"error":"That email address does not look right"}`. |
| Contact reveal | User-triggered reveal succeeded in desktop/mobile. Returned link had `rel="noopener noreferrer nofollow"`; endpoint returned `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`. |
| Injection handling | `name`, `email`, `subject` and `message` are HTML-escaped in `api/contact/route.ts:38–43`. |
| Basic abuse control | Contact mail endpoint: 3 requests/IP/hour; reveal endpoint: 20/IP/hour. Honeypot requests get a quiet success without mail. |

## Confirmed findings

### EN-01 — MEDIUM — Live contact-mail delivery is not independently proven in this audit

**Evidence:** the current guide (`USERGUIDES.md:329–333`) claims the domain is verified and a test review alert was delivered. The contact route calls `mailer().emails.send` at `route.ts:45–52` and returns a truthful 500 if it fails (`:54–57`). This walkthrough did not send a real enquiry, so it cannot independently verify the guide's live-provider claim.

**Impact:** the channel has good failure UI, but delivery evidence is documentary rather than a current end-to-end contact proof.

**Fix:** with explicit approval and an owned recipient address, perform one end-to-end delivery/reply test and record the provider/message evidence. Do not use a customer address.

### EN-02 — MEDIUM — Mobile sticky header obscures the focused message field

**Evidence:** `evidence/enquirer-edge.json` measured `focusedMessageOverlap: 65` on 393×852 mobile (desktop 0). `evidence/mobile-contact.png` visibly shows the sticky header across the textarea. Header is `sticky top-0 z-50` in `src/components/Header.tsx:132`.

**Impact:** The user can type a detailed enquiry but cannot reliably see the portion under the header while the field is focused/scrolled, increasing message-review friction.

**Fix:** apply focused control scroll offset (`scroll-margin-top`) or browser-safe focus positioning for the contact inputs, and add a 393px regression assertion that the focused textarea does not intersect the sticky header.

### EN-03 — MEDIUM — Contact phone number is collected but never delivered to the operator

**Evidence:** UI collects `phone` (`ContactClient.tsx:13,120–125`) and sends it in JSON (`:42–46`). The server destructures only `name,email,subject,message,website` (`api/contact/route.ts:20–21`) and mail HTML includes no phone (`:38–43`).

**Impact:** A prospective customer may provide a callback number in good faith, but the recipient never sees it. That is especially damaging when email replies fail or customers expect WhatsApp/call follow-up.

**Fix:** either include the phone in the escaped operator email (and state the intended data use/privacy basis), or remove the field rather than collecting unused personal data.

### EN-04 — MEDIUM — Contact/reveal rate limits reset on deployment and do not share state

**Evidence:** `src/lib/rate-limit.ts:4–7,12–20` explicitly uses an in-memory `Map`, reset by restart/deploy and unsuitable for multiple replicas. Contact mail is deliberately limited because it is abusable (`api/contact/route.ts:14–18`).

**Impact:** When email delivery is enabled, repeated deploy/restart or horizontal scaling bypasses the contact/reveal throttle. This is primarily operator-inbox spam and contact-detail harvesting risk.

**Fix:** move public mail/reveal throttles to a shared durable store or edge rate limit; add a deploy/multi-instance test or operational check.

### EN-05 — LOW — No route or production E2E test protects the contact workflow

**Evidence:** repository inventory contains only `src/app/api/contact/route.ts` and `reveal/route.ts`; no contact/enquiry test. CI runs Vitest and the general Playwright suite (`.forgejo/workflows/ci.yml:89,144`), but neither covers a contact happy/failure/reveal flow.

**Impact:** core failure handling (including the phone omission) can regress unnoticed.

**Fix:** add unit tests for invalid payload, honeypot, mail failure and escaped fields; add safe Playwright coverage that intercepts mail/contact POST and verifies no false “Message Sent” state.

## Boundaries / no false claims

- The contact-reveal endpoint intentionally does not claim to make contact data secret; it makes bulk source scraping less free and has noindex/no-store headers. That design is documented and is not reported as a confidentiality vulnerability.
- Form validation, error display, reveal link safety and mobile/desktop no-overflow checks passed in this run.
- A real enquiry/reply, WhatsApp handoff and response-time SLA need explicit permission/owned test data; none was sent.

## Retained evidence

`audits/enquirer-2026-08-10/evidence/` contains the Edge script/JSON and desktop/mobile screenshots. `../enquirer-2026-08-10-contact-reveal.txt` contains response headers/body from the safe reveal GET; it intentionally is not quoted here to avoid duplicating contact details.

## Next sequence

After this report is validated: **Order Tracker → Returning Customer → Reviewer → Newsletter Subscriber → Admin → Operations / Workshop Operator**.
