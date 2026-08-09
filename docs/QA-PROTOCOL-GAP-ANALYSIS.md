# MASTER-QA-PROTOCOL — what this project already has, and what it does not

Assessed 2026-08-08 against *Test No1 = MASTER-QA-PROTOCOL* and *Test No2 =
Playwright Full-Platform Navigation + User Action Testing Directive*.

**Short answer: a lot of it is already here, most of the rest does not apply to
this product, and one requirement is genuinely missing and matters.**

The protocol is written for a multi-tenant SaaS with accounts, roles and
subscription tiers. Lebon Grace is a 41-product made-to-order shop with **no
customer accounts at all** — guest checkout, and orders looked up by order id +
phone. Reading it as a checklist to satisfy line by line would generate a large
amount of test code for personas that do not exist.

---

## 1. Already implemented

Much of this arrived through the shared kit at `ops/qa/`, which explicitly
implements the protocol once for all projects rather than fifteen times.

| Protocol | Where | Status |
|---|---|---|
| §3 Reliability defaults — timeouts, trace/video/screenshot, retries | `ops/qa/playwright.base.config.ts` | ✅ |
| §3 Spinner rule (no busy state > 10s) | `ops/qa/guards.ts` | ✅ |
| §3 Console / network / broken-asset monitoring | `ops/qa/guards.ts` | ✅ |
| §5 Route discovery + `sitemap.json` fixture | `ops/qa/discover-routes.mjs`, `tests/fixtures/sitemap.json` | ✅ |
| §6 B — public navigation smoke | `tests/e2e/navigation/smoke.spec.ts` | ⚠️ public routes only |
| §6 D — webhook signature verification | `api/stripe-webhook/route.ts` | ✅ |
| §6 D — webhook idempotency / duplicate-event safety | A-4, two layers, 10 tests | ✅ |
| §6 F — placeholder / mock detection | `ops/qa/guards.ts`; and the index-derived fake ratings were removed for exactly this reason | ✅ |
| §6 G — authorization boundaries | `requireAdmin` + tests on `/api/orders` | ✅ |
| §6 G — IDOR probing | Not just tested — **found one** (S-6: `?id=*` matched every order) and fixed it | ✅ |
| §6 G — brute-force / rate limit | A-21, now persistent across restarts | ✅ |
| §8 Production walkthrough + bug-fix loop | Ran through this engagement; 22 items fixed with regression tests | ✅ |
| §9 TODO tracking for complex work | `ACTION_PLAN.md` | ✅ |
| §10 Living inventory | `tests/fixtures/sitemap.json` — **had drifted** (missing `/review`, `/unsubscribe`), regenerated | ✅ |

## 2. Does not apply to this product

Not gaps. Requirements for a product this is not.

| Protocol | Why not |
|---|---|
| §2.1 personas: Free / Mid-plan / Top-plan | **No customer accounts exist.** Checkout is guest-only; there is nothing to register. |
| §2.2 subscription entitlements, paywalls, upgrade/downgrade | No plans, no billing tiers. One-off purchases only. |
| Module A — registration, login, password reset, session persistence | No customer login. The only credential is a single admin password (covered by A-21). |
| §11 routes `/verify`, `/social`, `/leaderboards`, `/endorsements`, `/apps` | These belong to a different product — a credential/score SaaS. None exist here. |
| §11 "Improve your score", "View full kit", social-card / badge / QR / caption / credential tabs | Same. |
| §11 B — OAuth, connect revenue sources, connect social accounts | No integrations of this kind. |

Roughly **half the protocol's named scope is for another application.** Worth
saying plainly, because working through it as a checklist would produce
elaborate tests for personas and pages that will never exist.

## 3. Genuinely missing

| Gap | Why it matters |
|---|---|
| ~~Playwright does not run in CI~~ | ✅ **CLOSED 2026-08-08.** `.forgejo/workflows/ci.yml` now installs Chromium, builds, and runs the smoke suite as a hard gate, uploading trace/video/screenshots on failure. Verified it *catches* defects rather than merely passing: a 404ing asset injected into `/about` was reported by name. **The first attempt at that check was invalid** — the string it patched (`<main`) does not appear in that file, so nothing was injected and the resulting 14-pass proved nothing. Re-run with both preconditions asserted (present in source, present in `.next/server/app/about.html`). |
| ~~Module C — user action coverage~~ | ✅ **CLOSED 2026-08-08.** `tests/e2e/money-path/checkout.spec.ts` — 12 tests over add-to-cart, cart arithmetic, the free-delivery boundary at exactly AED 150, persistence, the checkout payload, and the `/track` refusal. `/api/checkout` is intercepted at the browser so a suite running on every push never creates a real Stripe session; what is asserted instead is the payload the client *asks* to be charged, with the server's refusal to trust it already covered by A-4. **Found a live defect** — see below. |
| ~~Module E — failure modes~~ | ✅ **CLOSED 2026-08-08.** `tests/e2e/failure-modes/resilience.spec.ts` — 8 tests: forced 500, dropped connection, retry-after-failure, degraded `/api/variants`, order-lookup failure, and the 10s spinner gate. All failures injected with `page.route`, so nothing depends on timing luck. **Found the worst defect of the engagement** — see §7. |
| ~~Mobile viewport runs~~ | ✅ **CLOSED 2026-08-08.** CI runs all three projects — desktop 1920×1080, iPhone 14 Pro, Pixel 7 — 126 tests in ~2m08s. The existing suites passed on mobile unchanged, so the value is in `tests/e2e/mobile/layout.spec.ts`: the `lg:hidden` sticky buy bar (which has no desktop equivalent and had never been exercised), a geometric regression test for the WhatsApp float that once covered it, horizontal-overflow checks on six routes, the mobile nav toggle, and tap-target sizes. **Found a WCAG 2.5.5 failure** — see §8. |
| ~~`docs/QA/` artifacts~~ | ✅ **CLOSED 2026-08-08.** All six exist, split by kind. **Generated** from the codebase and a real Playwright run (`npm run qa:report`): `SYSTEM_MAP.md`, `COVERAGE_INVENTORY.md`, `ROUTE_COVERAGE_REPORT.md`. **Hand-written**, because what broke and what it taught is judgement: `BUGS.md` (12 fixed, each with its regression), `LESSONS_LEARNED.md` (11 patterns, several recorded against mistakes made during this engagement), `TODO.md`. Plus `tests/fixtures/USER_ACTIONS_INVENTORY.md` (§10). `TODO.md` deliberately **points at** `ACTION_PLAN.md` rather than restating it — a second copy disagrees with the first within a week, which is the failure the file exists to prevent. |
| ~~Automated a11y sweep~~ | ✅ **CLOSED 2026-08-08.** `tests/e2e/a11y/axe.spec.ts` runs axe-core over 15 routes × 3 viewports at WCAG 2.0/2.1 A **and** AA. **The first run found 51 failing nodes the static audit structurally could not see** — see §9. Both audits are kept: the static one is fast and browser-free, this one catches the pair nobody thought to list. |

## 4. One conflict — resolved here, still open in the kit

**The protocol mandates Microsoft Edge exclusively.** `ops/qa/playwright.base.config.ts`
repeats it: *"EDGE-ONLY is non-negotiable per the protocol."*

**`CLAUDE.md` supersedes it.** Under Learned Corrections:

> Use Playwright's `launch(channel="chrome")` … (fall back to `msedge` only if
> Chrome isn't installed). … **Supersedes the earlier "use Edge only" rule, which
> was mitigating the wrong risk and created an ambiguous mandate.**

That correction also identifies what the Edge rule was really guarding against —
not the browser, but `connect_over_cdp()` and `launch_persistent_context()` on a
real profile, either of which disturbs the operator's open tabs. `launch()`
starts a throwaway profile and touches nothing, whichever channel it uses.

So two authorities disagree, the newer one is reasoned, and the QA kit still
carries the older. Edge-only has a real operational cost: `channel: "msedge"` uses the *installed* Edge binary, so any CI
image without Edge fails at launch — every test at once, reading as an outage
rather than a failure.

**Resolved for this project.** `playwright.config.ts` overrides the kit's channel
to Playwright's bundled Chromium — which `playwright install` guarantees is
present — and honours `QA_BROWSER_CHANNEL=msedge|chrome` for anyone who wants an
installed browser. That unblocked CI without editing shared tooling.

**Still open estate-wide.** `ops/qa/playwright.base.config.ts` still pins msedge
for the other fourteen projects, so each hits the same wall the first time it
wires up CI. Fixing it once in the kit is the better answer, but that is a change
to shared tooling and belongs to whoever owns it.

## 5. Recommendation

In order:

1. ~~Put the existing smoke suite into CI.~~ ✅ Done.
2. **Resolve Edge-vs-Chrome in the kit**, so the other fourteen projects do not
   each rediscover it.
3. ~~Add Module C for the money path.~~ ✅ Done — and it earned its keep on the
   first run by finding a defect no unit test could see (below).
4. Leave Modules A/B-per-persona and everything in §2.2 alone until this shop
   has accounts or plans. Today it has neither.

## 9. What the rendered-DOM sweep found — 51 nodes, and a hole in my own audit

`npm run audit:contrast` passed 24/24 the whole time. axe found **51 failing
nodes** on the first run, because the static audit only ever enumerated the
**admin** palette — and the storefront used `text-ink-muted` for small text
everywhere.

| Cause | Nodes | Fix |
|---|---:|---|
| `text-ink-muted` #7d766c on small text (4.34/4.06/3.69 — large-text only, *as that audit itself documented*) | 34 | token darkened to **#6f685e** (5.32/4.97/4.52) |
| `text-gray-400` left on the storefront (A-17 restyled admin only) | 4 | → `text-ink-muted` |
| gold `#A8874D` as 14px link text (3.22–3.36) | 4 | → `text-ink` with a sand underline |
| `bg-sand text-white` — **2.17** on a call-to-action | 2 | → `text-ink` on sand (7.25) |
| `<select>` with no accessible name | 3 | `aria-label` |
| icon-only `<button>` with no name | 2 | `aria-label` |
| `<dt>`/`<dd>` with no `<dl>` parent | 2 | wrapped |

**The fix caused one regression, which the same sweep then caught.** Darkening
`ink-muted` helped 34 nodes on light grounds and made the dark `#23201c` panel in
`/about` *worse*: 3.61 → 2.94. Light text on dark needs `paper`, not a token
designed for the opposite. Fixed, and recorded in `scripts/contrast-audit.mjs`.

Also worth keeping: axe first reported a colour the design never uses
(`#857e75`) because it sampled a paragraph **mid fade-in**. The suite now freezes
animations before analysing, so a result is about the design rather than the
timing.

## 8. What the mobile runs found — a 27px tap target on the money path

The cart's quantity controls measured **27×32px**. WCAG 2.5.5 asks for 44×44,
which is also what Apple and Android publish. A 27px control is fine with a
mouse and a coin-flip with a thumb — and this is the control between a customer
and changing what they are about to buy. Raised to a 44px minimum, with
`aria-label`s added while there.

Invisible at 1920×1080, which is the entire argument for running the viewports.

The suite also pins, geometrically rather than by class name, that the WhatsApp
float does not cover the sticky Add-to-cart bar. That is not hypothetical:
`WhatsAppButton.tsx:43-48` records the float being `z-50 bottom-6` against the
bar's `z-40 bottom-0`, so on every product page the green circle sat on Add to
cart and swallowed the tap. Verified by moving it back — the test fails with
"the WhatsApp float overlaps the Add to cart button — it will eat the tap".

## 6. What Module E found — a failed payment that said "Order Confirmed"

Both failure branches in `checkout/page.tsx` called `clearCart()` and
`setOrderPlaced(true)`. So when `/api/checkout` returned an error, or the
network dropped, the customer was shown:

> **Order Confirmed** — Thank you for your order. You will receive a
> confirmation email shortly. Your piece is now in the making queue.

…with a *Track Your Order* link. Their basket was emptied. **Nothing had been
charged and no order existed.** They would have waited for a puzzle nobody was
going to make, and could not retry, because the thing they were buying had been
thrown away.

The mirror image was also missing: Stripe returns the customer to
`/checkout?success=true`, and nothing read that parameter — so a customer who
*had* paid came back to the checkout form with a full basket and no
confirmation. The only code that cleared the cart was the code that ran when
checkout **failed**.

Both fixed. A failure now says so, keeps the basket and re-enables the button;
success confirms the order and clears the basket. Four regression tests, two of
which were verified to fail against the original behaviour.

Fixing the success path surfaced a second, subtler bug in the fix itself:
effects run child-before-parent, so clearing the cart on the checkout page ran
*before* `CartProvider` restored it from localStorage, and the restore put the
paid-for basket straight back. The provider now exposes `ready`, and the success
handler waits for it.

## 7. What Module C found on its first run

`deliveryMethod` lived only in React state while the cart itself was persisted
to localStorage. So a customer who chose **"Deliver to me"** and then reloaded —
or opened `/checkout` directly, or came back with the Back button — was silently
returned to pickup. `/checkout` has no toggle of its own (it only *reads*
`deliveryMethod`), so the address fields simply vanished and the order was
quoted with free collection.

No unit test could have caught it: each piece was individually correct, and the
defect only exists across a page load. Fixed in `cart-context.tsx`, with a
regression test that was verified to fail without the fix — reporting the exact
customer-facing symptom, `Expected "20", Received "Free"`.
