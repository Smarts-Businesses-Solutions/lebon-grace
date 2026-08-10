# Lebon Grace — Anonymous Visitor Deep Audit

**Target:** `https://shop.lebon-grace.com`  
**Audit window:** 2026-08-10, 14:41–15:00 AST  
**Auditor mode:** fresh anonymous visitor; no customer account, order credentials, payment data, or operator credentials used  
**Evidence:** `evidence/mobile-home.png`, `evidence/mobile-product.png`  
**Status:** **NOT RELEASE-READY** — resolve the two checkout/communications blockers and restore a green full E2E gate before treating production as safe to release.

---

## Executive decision

The public catalogue, product-detail, personalisation-to-cart, delivery-threshold display, contact validation, desktop navigation, mobile layout, accessibility checks, and core static/unit checks were broadly healthy in this run. No JavaScript console errors or failed in-viewport lazy images were observed while walking the production catalogue in Microsoft Edge.

However, four material issues prevent a clean release decision:

1. **[HIGH] Delivery can be waived by a crafted anonymous checkout request.** The server trusts client-supplied `shipping` and `deliveryMethod` instead of deriving them from the validated basket and delivery selection.
2. **[HIGH] Current deployed revision has no proven server-side error delivery.** The committed build prints that the standalone artifact lacks instrumentation, so server-side errors do not reach GlitchTip. A local, uncommitted worktree relocation to `src/instrumentation.ts` makes the build marker pass, but it is not a deployed fix.
3. **[HIGH] Order-confirmation email is documented as unavailable because the Resend sender domain is not verified.** A paid customer may receive no confirmation/review email.
4. **[MEDIUM — release gate] Full production Playwright is red: 213 passed, 3 failed.** Every failure is the returning-customer account test timing out in all three browser projects; CI invokes the same full suite.

No live charge, Stripe Checkout session, valid newsletter subscription, contact email, review, account lookup, or order-tracking lookup was created during this audit.

---

## 1. Role, tier, language, and cadence

### Guide interpretation
`USERGUIDES.md` defines only two audiences: **customers** and the **workshop operator**. This audit covers the anonymous/customer-facing surface only.

| Dimension | Expected contract | Audit result |
|---|---|---|
| Visitor tiers | No sign-up, membership, paid tier, or customer account tier | **Pass** — no tier boundary exists to test |
| Languages | English only; no locale switcher | **Pass** — `/ar`, `/fr`, and `/es` return 404 rather than a partial/blank locale |
| Customer cadence | Browse anytime; purchase is one-shot/per order; tracking/review are per-order follow-ups; newsletter/unsubscribe are optional one-shot actions | Covered without creating personal data or an order |
| Daily/weekly/monthly/annual work | These are operator workflows, not anonymous visitor workflows | Out of persona scope |

### Anonymous workflow chain tested

1. Discover storefront and category navigation.
2. Browse catalogue and use a category filter.
3. Open a representative product (`ABC Jigsaw Board`).
4. Enable free engraving, enter a harmless test name (`Amira`), add the item to the browser-local cart, and confirm it appears in cart.
5. Inspect delivery vs collection and the AED 150 free-delivery progress display without starting payment.
6. Visit Contact; use intentionally invalid email input only. Native browser validation blocked sending; no message was sent.
7. Verify contact reveal interaction.
8. Exercise the same public routes and negative paths through production Edge Playwright.
9. Emulate iPhone-size mobile Edge and inspect homepage/product rendering.

Credentials required for the following were intentionally not invented or guessed: valid order tracking, account lookup, review submission, successful payment, successful email receipt, and admin actions.

---

## 2. Test matrix and observed result

| Chain / check | Method | Result |
|---|---|---|
| Production deployment identity | `npm run verify:deploy` | **Pass** — public deployment fingerprint matched the expected current production deployment ID |
| Public route and bad-route status behavior | Edge Playwright smoke + direct HTTP checks | **Pass** for the exercised route set; invalid product and unsupported locales did not silently render a success page |
| Homepage / shop / category browsing | Manual anonymous Edge walk | **Pass** |
| Product detail / engraving / cart hand-off | Manual anonymous Edge walk + money-path tests | **Pass** for normal UI flow |
| Delivery threshold UI | Manual cart walk | **Pass** — AED 20 delivery / free delivery at AED 150 presented correctly in the ordinary UI |
| Production catalogue image loading | Edge browser script: scroll full page, wait for visible images, collect failed requests | **Pass** — 4,473px shop page; no failed or visible-unloaded lazy image and no console errors |
| Desktop full E2E | Microsoft Edge Playwright, all projects | **213 passed, 3 failed, 15 skipped** — see F-04 |
| Mobile layout / tap targets / rendered a11y | Microsoft Edge Playwright, iOS + Android projects | **Pass** — command exit 0 |
| Mobile visual check | Edge iPhone emulation, stored screenshots | **Pass with UX findings F-07/F-08** |
| TypeScript / lint / unit tests | `tsc --noEmit`; ESLint; `vitest run` | **Pass** — 457 unit tests passed |
| E2E typecheck / contrast audit | `npm run typecheck:e2e`; `npm run audit:contrast` | **Pass** |
| Dependency vulnerability scan | `npm audit --omit=dev --json` | **Pass** — 0 production dependency vulnerabilities reported |
| Build: original working directory | `npm run build` | **Blocked locally** — `.next/standalone` was Windows-locked (`EBUSY`); no user processes were killed |
| Build: isolated current worktree copy | Full `npm run build` in copied worktree with linked dependencies | **Pass** — compiled, typechecked, generated all 32 pages, and current worktree's Sentry marker passed |
| Build: isolated committed production revision | Full `npm run build` from `HEAD` archive | **Pass with observability warning** — standalone artifact reported missing server instrumentation |

---

## 3. Confirmed findings

### F-01 — HIGH — Anonymous client can waive delivery cost

**Affected surface:** `POST /api/checkout`  
**Evidence:** `src/app/api/checkout/route.ts:15–23`, `111–120`, `160–173`; ordinary UI calculation in `src/lib/cart-context.tsx:262–265`.

The client sends `shipping` and `deliveryMethod`. The handler correctly re-resolves product prices and quantity, but it does **not** recompute the shipping charge from the authoritative subtotal and delivery method. It uses:

```ts
const total = subtotal + (shipping || 0);
if (shipping && shipping > 0) { /* append Shipping Fee */ }
```

An anonymous caller can submit a normal below-threshold basket with `deliveryMethod: "delivery"` and `shipping: 0`. Stripe then receives no shipping line item. This was source-verified only: no production Stripe session was created.

**Impact:** direct revenue leakage on delivery orders; client-side cart display is not a security boundary.

**Required remediation:** derive delivery/collection eligibility and fee solely on the server after validating basket subtotal; reject impossible combinations (e.g. delivery + zero fee below threshold). Add unit tests for forged `shipping`, forged `deliveryMethod`, threshold boundaries, and each emirate policy. Make this a mandatory CI regression test.

---

### F-02 — HIGH — Deployed standalone artifact lacks server-side error instrumentation

**Affected surface:** production observability / incident detection  
**Evidence:** isolated `HEAD` build emitted:

> `.next/server/instrumentation.js is absent from the standalone output, so Sentry.init will not run and server-side errors will not reach GlitchTip. This is B-31, still open.`

The committed `instrumentation.ts` is at repository root, while this app uses `src/app`; `scripts/seal-standalone.mjs` documents that Next ignores the root hook. Therefore the deployed revision has no proven server error ingestion.

**Important current-state distinction:** the **uncommitted** worktree now has `src/instrumentation.ts`, removes the root file, and changes the seal script. Its isolated build passed with:

> `[seal-standalone] Sentry server init reached the standalone output`

That is a good build-marker result, but not evidence that the change is deployed, and the behavioural fake-ingest proof (`scripts/prove-sentry-init.mjs`) was not run against production.

**Impact:** a server exception, webhook failure, mail failure, or checkout incident can remain invisible until a customer reports it.

**Required remediation:** complete the behavioural isolated-standalone proof with a fake DSN before release; commit the relocation and gate it in Forgejo; deploy the resulting image; then confirm an event is received in the configured error monitor from the deployed revision.

---

### F-03 — HIGH — Order email sender domain remains unverified

**Affected surface:** order confirmation and delivered/review communication  
**Evidence:** `USERGUIDES.md` records the live Resend rejection (`403`, sender domain not verified) and explicitly lists this as an active production constraint; failure-mode tests model this external mail failure.

**Impact:** a customer who pays may not receive the promised confirmation, order ID, review prompt, or follow-up delivery notice. Tracking and account lookup both rely on information normally sent by email.

**Required remediation:** verify the configured sender domain in Resend and send a controlled real confirmation to a test mailbox. Do not treat the mocked failure-mode test as proof of outbound deliverability.

---

### F-04 — MEDIUM — Full production E2E gate is red because account lookup test is timeout-prone

**Affected surface:** CI quality gate and returning-customer regression coverage  
**Evidence:** full Microsoft Edge production run: **213 passed, 3 failed, 15 skipped**. Failed in desktop, mobile-iOS, and mobile-Android:

`tests/e2e/account/lookup.spec.ts` — “does not distinguish an unknown email from a wrong phone”.

The failure occurs at the second `fill` after a 60-second test timeout. The test loops twice and waits for `networkidle`; this public page includes analytics/network activity, so `networkidle` is an unreliable readiness condition. The failure output is `Target page, context or browser has been closed` at the field fill after the timeout, not a customer-visible server error.

`.forgejo/workflows/ci.yml` runs the full Playwright command, so this makes the release gate red/noisy.

**Required remediation:** replace `networkidle` with an explicit, bounded UI readiness condition (visible and enabled email/phone fields, then result state); run this spec in each project and restore a green full suite. Keep the unknown-email/wrong-phone indistinguishability assertion.

---

### F-05 — MEDIUM — Public responses lack baseline browser security headers

**Affected surface:** `https://shop.lebon-grace.com/` and `/checkout`  
**Evidence:** live HTTP headers contain `server: Caddy`, `x-powered-by: Next.js`, and long cache control, but no `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. `next.config.ts` does not define a header policy.

**Impact:** defense-in-depth is missing against framing/clickjacking, content injection impact, MIME confusion, referrer leakage, and downgrade after a first HTTPS visit. This does not prove an active XSS bug; it is a verified hardening gap.

**Required remediation:** set a tested policy at the canonical edge/origin layer (Caddy/CDN) or Next headers, including HSTS (after confirming all subdomains), `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`, `Permissions-Policy`, and CSP using `frame-ancestors 'none'` or the intended embedding policy. Remove `X-Powered-By` if not needed. Test Stripe Checkout / analytics / Next image paths after introducing CSP.

---

### F-06 — MEDIUM (operational) — Production is not source-driven

**Affected surface:** CI/CD integrity  
**Evidence:** `DEPLOYMENT-GUIDE.md` and `docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md` state that the live Coolify service runs a hand-built image; it does not clone/build the repository. The git-backed Coolify application is documented as not yet able to deploy automatically.

**Impact:** a green Forgejo build and current `main` do not, by themselves, prove that the same commit is serving visitors. Security fixes can be committed and tested without reaching production.

**Required remediation:** finish the git-backed deployment connection, make the image build reproducible from the locked repository, deploy only a commit-attested image, and verify commit SHA + deployment ID after each release.

---

### F-07 — LOW — Floating WhatsApp control overlaps product purchasing copy on 393px mobile

**Affected surface:** product detail mobile layout  
**Evidence:** `evidence/mobile-product.png` from actual Microsoft Edge iPhone-size emulation.

The floating WhatsApp button overlaps the right side of the price / “Name engraved free” region immediately above the sticky purchase bar. The primary button remains visible, but the overlapping support control competes with product and engraving information at the most important decision point.

**Required remediation:** reserve safe vertical space above the sticky bar, move/hide the floating action while a sticky purchase bar is present, or reduce/reposition it below the product configuration region. Add a visual mobile regression assertion.

---

### F-08 — LOW — Second product gallery thumbnail is visually indistinct at mobile size

**Affected surface:** `ABC Jigsaw Board` mobile gallery  
**Evidence:** `evidence/mobile-product.png`; live image inspection confirms `/images/lasercut/abc-jigsaw-board-1.png` loads successfully but is a very light white-on-white product composition. At 80px thumbnail size it appears as an empty white square beside the clearly readable first and third thumbnails.

**Impact:** a shopper can mistake a real alternate view for a missing/broken image and may not open it.

**Required remediation:** use a higher-contrast crop/thumbnail treatment, add a subtle background/label, or suppress visually unhelpful alternates at this size.

---

## 3B. Additional verified source and operations findings

### F-09 — MEDIUM — Public product-overrides API leaks non-storefront catalogue data

**Affected surface:** `GET /api/products`  
**Evidence:** `src/proxy.ts:62–64` allowlists the route publicly; `src/app/api/products/route.ts:5–9` returns `catalog.getAll()` without an admin check; `src/lib/store.ts:415–420` uses `select("*")`.

The row shape includes `stock`, `hidden`, `cj_pid`, `cj_price`, arbitrary `details`, and `image_placeholder` (`supabase/migrations/00000000000000_baseline.sql:1958–1974`). The only in-repository browser caller is the admin UI.

**Impact:** anonymous users can enumerate hidden/unreleased products, stock levels, supplier/CJ identifiers and sourcing prices.

**Required remediation:** require admin access for this endpoint, or replace it with a deliberately public DTO that excludes internal fields and hidden records. Add a response-shape regression test.

---

### F-10 — MEDIUM — Public cart-recovery endpoint can relay branded email to arbitrary recipients

**Affected surface:** `POST /api/cart-recovery`  
**Evidence:** public route in `src/proxy.ts:56`; caller-selected recipient in `src/app/api/cart-recovery/route.ts:27–35`; direct mail send at `:102–108`.

The three-per-hour-per-IP rate limit reduces volume but does not establish inbox ownership, prior consent, cart ownership, or a per-recipient suppression rule. An attacker can use the brand as a low-volume mail relay to any syntactically valid address.

**Required remediation:** require a previously verified, browser-bound cart email or an authenticated/signed recovery token; introduce recipient-level cooldown and abuse telemetry. Do not accept an arbitrary address as a send target.

---

### F-11 — MEDIUM — Cart-recovery email still advertises a removed 50% payment model

**Affected surface:** cart-recovery email content  
**Evidence:** `src/app/api/cart-recovery/route.ts:84–85` renders “Pay only 50% now”, while `src/app/api/checkout/route.ts:114–120` makes `depositAmount = total` and `codAmount = 0`.

**Impact:** if recovery email becomes deliverable, recipients receive an incorrect payment promise and could challenge the checkout amount.

**Required remediation:** make the email state the same full-payment policy as checkout; test email content against the authoritative checkout model.

---

### F-12 — LOW — Newsletter unsubscribe is not recipient-authorized

**Affected surface:** `POST /api/newsletter/unsubscribe`  
**Evidence:** `src/app/api/newsletter/unsubscribe/route.ts:17–35` deletes any provided valid email. It correctly returns the same response for subscribed and non-subscribed addresses, preventing membership enumeration, but does not prove the caller controls that inbox.

**Impact:** anyone knowing an address can unsubscribe it.

**Required remediation:** place a recipient-bound, single-use unsubscribe token in every mailing link; retain the uniform response.

---

### F-13 — HIGH (operational) — The Coolify migration helper sends a literal redacted bearer value

**Affected surface:** source-driven deployment migration  
**Evidence:** `scripts/coolify-register-git-app.sh:56–70` reads and validates `COOLIFY_API_TOKEN`, but both API branches use `Authorization: Bearer ***` at `:76–83`, not `$TOKEN`. `--apply` uses this wrapper.

**Impact:** the scripted path intended to remove F-06's hand-built-image deployment risk cannot authenticate even with a valid token; the documented migration stays blocked.

**Required remediation:** replace the literal placeholder with the shell variable, then test only the read-only/dry-run API path before any application-creating `--apply` command.

---

### F-14 — MEDIUM (operational) — A live Stripe test-mode checkout flow is not executed by any configured runner

**Affected surface:** CI coverage  
**Evidence:** `tests/e2e/checkout_flow.py:1–14` is a Python Playwright live checkout test. Vitest excludes E2E (`vitest.config.ts:13–16`); TypeScript Playwright only discovers its configured test directory (`playwright.config.ts:35–40`); Forgejo runs `npx playwright test` (`.forgejo/workflows/ci.yml:143–144`). `playwright test --list` sees the TypeScript suite, not this Python file.

**Impact:** the payment-path test can silently rot and never block CI.

**Required remediation:** either port it into the TypeScript Playwright suite using a controlled test Stripe environment, or add a separate explicit runner/job. It was not run here because it creates a live test-mode checkout flow.

---

### F-15 — MEDIUM (operational) — Health-check installer cannot recreate the documented two-minute uptime monitor

**Affected surface:** production monitoring recovery  
**Evidence:** `ops/health/install.sh:7–11` promises three timers, including `lebon-grace-uptime`, but it only validates, writes, and enables deploy-verification and CI-freshness timer families (`:27–42`, `:64–96`).

**Impact:** recovery from tracked artifacts does not recreate the advertised uptime monitor.

**Required remediation:** add the uptime service/script/timer to the installer and verify an idempotent install on a non-production host.

---

### F-16 — MEDIUM (operational) — Docker build can bypass lockfile reproducibility

**Affected surface:** production image build  
**Evidence:** `Dockerfile:39–42` falls back from `npm ci` to lockfile regeneration and a second install. The comment correctly calls this non-reproducible; CI does not build the Docker image.

**Impact:** a platform-specific install fault can yield a hand-repaired image rather than a failed release gate.

**Required remediation:** remove the production fallback (or make it a separately approved repair procedure) and build the actual image in CI using `npm ci` only.

---

### Additional lower-severity hygiene gaps

- `.env.example` still describes the old Hostinger/PostHog model while deployment docs/source require Supabase and runtime secrets. Treat it as a deployment-footgun until brought current.
- CI installs with `--no-audit`; no tracked Dependabot, Renovate, CodeQL, Snyk, Trivy, or equivalent continuous dependency-security mechanism was found. The point-in-time audit result is clean, but detection is manual.
- `README.md` documents 276 unit tests; the current suite ran 457 in this audit. Keep published verification counts generated rather than hand-maintained.

---

## 4. Controls that were specifically checked and held up

These are **not** claims that the entire system is secure; they are scoped checks that did not produce a finding in this audit:

- Product unit prices are re-resolved from the server catalogue; forged client item prices and missing/unknown slugs are rejected.
- Checkout has server-side deliverable-email and usable-phone validation.
- Public contact, newsletter, checkout, account/track/review paths have endpoint-specific rate limiting.
- The account lookup requires both email and phone and is intended to return the same outcome for unknown-email/wrong-phone cases; the test assertion is right even though its readiness wait is flawed.
- Webhook signature validation, admin cookie auth, and public-route separation are covered by the targeted unit tests.
- No `dangerouslySetInnerHTML`/`innerHTML` sink was found in the reviewed app surface; rendered review fields use React text rendering and email HTML helpers escape interpolated values.
- Checkout return URLs are server-derived rather than request-host-derived; no open redirect path was found.
- Production catalogue scrolling produced no failed requests, visible lazy-load image failures, or JavaScript console errors.
- Unsupported locale paths did not silently become partial multilingual pages.

---

## 5. Operational / CI-CD observations

| Observation | Consequence | Follow-up |
|---|---|---|
| `npm audit --omit=dev` reported 0 production vulnerabilities | Good current point-in-time package posture | Add continuous dependency/security update automation; CI currently installs with `--no-audit` |
| Full test suite fails despite 213 passes | Green signal is unavailable; regressions can be masked by known failure | Fix F-04 before next release |
| Original tree build blocked by `.next/standalone` Windows lock | Local developer build is not repeatable in-place | Identify owner of lock without terminating user processes; clean `.next` before build or use isolated build wrapper |
| Isolated current worktree build passed | Current WIP compiles and includes the Sentry marker | Behavioural Sentry ingest and actual deploy still required |
| Isolated committed-revision build passed with B-31 warning | Deployed baseline compiles but lacks proven error telemetry | Resolve and deploy F-02 |
| Runtime deployment fingerprint is present | Useful deployment identity protection | Pair it with source commit/image attestation (F-06) |

---

## 6. Prioritised handoff plan

### Release blockers — do before another payment-capable release

1. **Fix F-01**: recompute shipping server-side and add forged-payload tests.
2. **Fix F-03**: verify Resend sender and prove a real controlled confirmation reaches a test mailbox.
3. **Fix F-02**: finish isolated fake-ingest proof for `src/instrumentation.ts`, commit, deploy, then verify production event ingestion.
4. **Fix F-04**: eliminate `networkidle` dependency in account E2E and rerun the entire suite cleanly.

### Next hardening batch

5. Add and test response security headers (F-05).
6. Move production to source-driven, commit-attested deployment (F-06).
7. Fix product-page mobile overlap and low-contrast gallery thumbnail (F-07/F-08).
8. Make CI security/dependency checks continuous and build the actual deployment image in the release pipeline.

---

## 7. Evidence and reproducibility

### Commands completed

```text
QA_BASE_URL=https://shop.lebon-grace.com QA_BROWSER_CHANNEL=msedge npx playwright test --reporter=line
QA_BASE_URL=https://shop.lebon-grace.com QA_BROWSER_CHANNEL=msedge npx playwright test tests/e2e/mobile/layout.spec.ts tests/e2e/mobile/tap-targets.spec.ts tests/e2e/a11y/axe.spec.ts --project=mobile-ios --project=mobile-android --reporter=line
npx tsc --noEmit
npx eslint src/ --report-unused-disable-directives
npm test
npm run typecheck:e2e
npm run audit:contrast
npm audit --omit=dev --json
npm run verify:deploy
```

### Boundaries / deliberate non-actions

- Did **not** use checkout payload tampering against production or create a Stripe Checkout session.
- Did **not** submit a valid email to contact/newsletter/unsubscribe/cart recovery.
- Did **not** create a review, look up a real order, use an admin route, or send external email.
- Did **not** close existing user Chrome tabs or terminate any user browser/Node process.
- The anonymous persona cannot prove a successful payment, post-payment webhook/order record, email delivery, review authorisation, or actual delivery status without explicit safe test credentials and approval.

---

## Appendix: audit artifact inventory

```text
audits/anonymous-visitor-2026-08-10/
├── ANONYMOUS_VISITOR_AUDIT.md
├── ANONYMOUS_VISITOR_AUDIT.html
└── evidence/
    ├── mobile-home.png
    └── mobile-product.png
```
