# Lebon Grace — Shopper Deep Walkthrough

**Production target:** `https://shop.lebon-grace.com`  
**Audit date:** 2026-08-10  
**Persona:** anonymous shopper (no account exists)  
**Browsers:** isolated Microsoft Edge / Playwright contexts only; no user Chrome or Edge tab was touched or closed.

---

## Executive decision

**Do not treat the shopper money path as release-ready.** The normal **Add to cart** path is sound in the exercised flows, but the prominent **Buy now** path silently discards a shopper's selected engraving. On mobile, a fixed purchase bar overlays the irreversible-personalisation area. The payment and deployment risks carried forward from the preceding anonymous audit also remain open.

### Verified scope boundaries

`USERGUIDES.md:11–30` defines exactly two roles (customer/operator), **no customer tiers/accounts/plans**, and **English only**. Shopper is a one-shot/occasionally repeated activity; the guide defines no daily, weekly, monthly, or annual shopper task. Unsupported locale paths (`/ar`, `/fr`, `/es`) are intentionally not part of this product and were already verified as 404 in the anonymous pass.

No real payment, Stripe Checkout session, production order, email, contact enquiry, newsletter subscription, review, or customer lookup was made. This is deliberate: the live checkout route would create a real session, and the guide records an unverified mail sender domain. Browser checkout tests intercept the endpoint before any request leaves the test browser.

| Severity | Count | Meaning |
|---|---:|---|
| High | 3 | customer money/data or release integrity risk |
| Medium | 5 | material shopper/security/operational defect |
| Low | 2 | documentation or visual discoverability defect |

---

## Shopper contract extracted from the guide

| Workflow / cadence | Contract tested or traced |
|---|---|
| Discovery — any time | Browse six categories, filter by price/category/etc., search, product count, clear filters, product photos/age/safety. |
| Evaluation — one shopping session | See price, three images where supplied, dimensions/age/small-parts warning, free optional engraving (20 characters), and return implications before buying. |
| Cart — one shopping session / repeat visit | Engraved names stay separate lines; quantity cannot exceed material stock in normal UI; pickup is default/free; delivery is AED 20 and free **at AED 150**; cart and delivery choice survive reload in the same browser. |
| Checkout — one-shot | Valid email, usable phone, contact name, delivery address where relevant, terms consent, full card payment via Stripe; no card details on the shop; failed checkout keeps basket and provides retry. |
| After purchase — few times/order | Track is order number + phone; Account is email + phone. These are queued for later role-specific walkthroughs and were not exercised with real customer data here. |
| Languages / tiers | One English-only, accountless shopper experience; no hidden tier or locale path to exercise. |

---

## Evidence-led walkthrough results

### What held up

1. **Search/filter discovery:** live `/shop` loaded 41 products, initially 24; searching `owl` produced exactly one matching Owl Number Tower and a clearable search chip. Category counts were visible: 11/9/8/7/5/1 across the six categories.
2. **Product evaluation:** ABC Jigsaw Board and Owl Number Tower had the expected AED 15 price, product gallery, made-to-order state, age range and choking-hazard notice. Normal product images loaded in Edge without console errors.
3. **Normal personalisation path:** selecting engraving `Amira`, then **Add to cart**, preserved `Engraving: Amira` in cart. The product-name input limits typing to 20 characters in source (`ProductDetailClient.tsx:356–365`).
4. **Cart delivery math and persistence:** Edge production run confirmed AED 20 delivery below threshold survives reload; 10 × AED 15 gave subtotal AED 150, free delivery, total AED 150.
5. **Mobile normal cart path:** at 393×852 Edge emulation, mobile sticky **Add to cart** preserved `Amira`; measured horizontal overflow was `0` on both product and cart. No browser console errors or failed requests were collected.
6. **Safe failure coverage:** 75 production-targeted Edge tests passed across desktop, mobile-iOS, and mobile-Android (money path, personalisation, and failure modes). Checkout calls were intercepted/stubbed by the suite; no Stripe call was made.
7. **Local quality:** TypeScript, ESLint, and Vitest passed: **21 files / 313 tests**. Current-worktree isolated build passed and reported `[seal-standalone] Sentry server init reached the standalone output`. Production remains separately deployment-attested as ID `20260810103319`.
8. **Dependencies:** `npm audit --omit=dev --json` reported **0** production dependency vulnerabilities.

---

## Confirmed findings

### SH-01 — HIGH — “Buy now” drops the selected engraving

**Impact:** The shopper is told the name will be engraved exactly as typed and cannot be returned. Selecting `Amira` then taking the prominent **Buy now** path reaches checkout without `Engraving: Amira`. A customer can therefore pay for an unpersonalised piece after expressly configuring one.

**Reproduction (safe; no payment):**
1. Open `/shop/abc-jigsaw-board` in a fresh browser context.
2. Check **Engrave a name on it** and enter `Amira`.
3. Click **Buy now**.
4. At `/checkout`, the order summary lacks the engraving line.

**Evidence:** production Edge script `evidence/shopper-edge-flow.json` returns `buyNowCheckoutSummaryHasEngraving: false`; source confirms the divergent path: `src/app/shop/[slug]/ProductDetailClient.tsx:397–403` calls `addItem(rawProduct!, quantity)` and omits both `wantsName ? engraveName.trim()` and selected variant data. The ordinary path at `:118–129` includes the engraving.

**Required fix:** make Buy now call the same cart-line constructor as Add to cart. Add an Edge regression test that selects an engraving, clicks **Buy now**, and asserts the checkout summary/payload includes it. Do not deploy a code change without approval.

---

### SH-02 — MEDIUM — Fixed mobile purchase bar overlays the engraving module

**Impact:** On 393px mobile, the fixed bottom bar sits across the shopper’s engraving control/input area while the page is scrolled. The guide identifies this field as the last chance to catch an irreversible spelling error.

**Evidence:** `evidence/mobile-product-engraving.png`; implementation is the fixed `lg:hidden` bar at `ProductDetailClient.tsx:735–753`. The screenshot shows it covering part of the personalisation panel; the main CTA stays present lower on the page, so this is not an outright purchase block.

**Required fix:** reserve mobile bottom padding equal to the sticky bar or show the bar only once the configurable purchasing section is out of view; test at 393px with engraving expanded.

---

### SH-03 — HIGH — Delivery fee remains caller-controlled on checkout API

**Impact:** The client calculates AED 20/free-at-AED-150 correctly, but an anonymous caller can submit `deliveryMethod: "delivery"` with `shipping: 0`; the server uses the passed amount. A delivery order can be created without the delivery fee.

**Evidence:** `src/lib/cart-context.tsx:262–265` calculates the client value; `src/app/api/checkout/route.ts:15–23,111–115,160–173,197–198` accepts it. Route test `checkout/route.test.ts:158–168` explicitly asserts shipping is charged “at the amount given.” No crafted production order was made.

**Required fix:** calculate delivery method and shipping server-side from canonical catalogue subtotal; reject inconsistent client fields. Add boundary tests for pickup, under AED 150 delivery, and exactly AED 150 delivery.

---

### SH-04 — HIGH — Order confirmation email cannot be delivered

**Impact:** A paid shopper may not receive the order number needed for tracking. `USERGUIDES.md:329–333` records that the Resend sender domain is unverified; mocked failure tests show the provider’s 403 response.

**Required fix:** verify `lebon-grace.com` with Resend or use a verified `MAIL_FROM_ADDRESS`, then execute an approved non-customer test order and confirm mail + tracking lookup. This walkthrough did not send mail.

---

### SH-05 — MEDIUM — Production responses lack baseline browser security headers

**Evidence:** live `curl -I` header capture found no HSTS, CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy or Permissions-Policy.

**Impact:** reduced protection against clickjacking, content-type sniffing, information leakage and script injection containment.

**Required fix:** set a restrictive, tested header policy at the application/reverse-proxy layer; validate it against Stripe redirect/return and image/CDN requirements.

---

### SH-06 — MEDIUM — Cart-recovery endpoint can send branded mail to arbitrary addresses

**Evidence:** public allowlist `src/proxy.ts:56`; caller-controlled recipient `src/app/api/cart-recovery/route.ts:27–35`; send `:102–108`. Rate limiting limits volume but does not establish ownership or consent.

**Impact:** low-volume mail relay/brand-abuse risk. It is also customer-facing once the sender domain is fixed.

**Required fix:** use a previously verified cart email or a signed recovery token, plus recipient-level cooldown/suppression.

---

### SH-07 — MEDIUM — Cart-recovery copy contradicts checkout payment policy

**Evidence:** recovery email says “Pay only 50% now” (`cart-recovery/route.ts:84–85`); checkout uses `depositNow = total` and `payOnDelivery = 0` (`cart-context.tsx:269–276`).

**Impact:** a recovered shopper could be promised a different amount than Stripe charges.

**Required fix:** derive recovery copy from the same authoritative payment model and test it.

---

### SH-08 — MEDIUM — Deployment remains non-source-driven and its migration helper cannot authenticate

**Evidence:** `DEPLOYMENT-GUIDE.md:27–33` says live Coolify is a hand-built image, not a repo build. `scripts/coolify-register-git-app.sh:56–70` loads `COOLIFY_API_TOKEN`, but `:76–83` sends literal `Authorization: Bearer ***`, blocking the documented migration.

**Impact:** a green source/CI result does not prove the shopper fix is deployed; the repair path itself fails even with a valid token.

**Required fix:** correct the header variable, dry-run/read-only verify it, then migrate to a commit-attested Git build. This requires deployment approval.

---

### SH-09 — LOW — Product gallery thumbnail can look empty at mobile size

**Evidence:** the second ABC Jigsaw Board source image loads (non-zero natural dimensions) but its white-on-white composition looks blank at 80px. `evidence/mobile-product-engraving.png` shows the weak thumbnail contrast.

**Required fix:** use a contrast-safe crop/background or distinguish gallery thumbnails more clearly.

---

### SH-10 — LOW — Shopper guide contains a stale visible-count example

**Evidence:** `USERGUIDES.md:52` says “Showing 12 of 41 products”; current live shop says **24 of 41 products** initially (a 24-item initial page with Load More). The guide’s broader promise—that the count clarifies filters—is accurate.

**Required fix:** make the guide say “the displayed count” rather than a fixed initial number, or update the example to current behaviour.

---

## Related verified findings tracked in the preceding cross-role audit

The dedicated anonymous audit remains the full security/operations source of truth at `audits/anonymous-visitor-2026-08-10/`. Its still-relevant findings include public `/api/products` internal-column disclosure, arbitrary newsletter unsubscription, orphaned Python Stripe E2E, incomplete health installer, Docker lockfile fallback, and missing continuous dependency security automation. They were not reclassified as shopper-only defects here.

---

## Important non-findings and limits

- The guide’s no-tier/no-account/English-only boundary is accurate. It is not missing locale coverage.
- No normal-cart image load failure, horizontal overflow, console error, or payment failure-state regression was found in the tested Edge flows.
- A genuine Stripe hosted payment, webhook, successful confirmation return, email receipt, fulfilment timeline, tracking, account lookup and delivered review need owned seeded data and/or explicit approval; they are intentionally left to the queued role walkthroughs.
- The in-repo `tests/e2e/checkout_flow.py` can create a live Stripe test-mode checkout and is not run by configured CI. It was deliberately not run here; it must be moved into an explicit controlled runner before treating it as a release gate.

---

## Evidence inventory

- `evidence/shopper-edge-flow.mjs` / `.json` — desktop Edge controlled shopper flow; checkout endpoint never called without interception.
- `evidence/buy-now-checkout.png` — captured safe checkout state after Buy now.
- `evidence/shopper-mobile-edge.mjs` / `.json` — 393×852 Edge shopper flow.
- `evidence/mobile-product-engraving.png`, `mobile-cart.png` — mobile visual evidence.
- `evidence/npm-audit-production.json`, `production-headers.txt` — dependency and live-header evidence.

## Next approved sequence

1. Resolve or explicitly accept SH-01 through SH-08 before release.
2. After this report is validated, run the queued **Enquirer** deep walkthrough.
3. Then run **Order Tracker**, **Returning Customer**, and **Reviewer** in that order.
