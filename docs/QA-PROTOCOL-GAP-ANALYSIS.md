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
| **Playwright does not run in CI** | The single biggest one. `.forgejo/workflows/ci.yml` runs typecheck, unit tests, lint and build — **zero** Playwright references. The smoke suite exists and nothing executes it, which is the same failure class as a green build that never deployed (R-2): a check that reports nothing is indistinguishable from a check that passes. §7 is unmet. |
| Module C — user action coverage | The money path (add to cart → checkout → track) has strong *unit* coverage but no browser-level test. |
| Module E — failure modes | Offline, slow network, forced 500 on `/api/checkout`. None automated. |
| Mobile viewport runs | The kit configures three viewports; no test exercises the mobile ones. |
| `docs/QA/` artifacts | `SYSTEM_MAP.md`, `COVERAGE_INVENTORY.md`, `ROUTE_COVERAGE_REPORT.md`, `BUGS.md`, `LESSONS_LEARNED.md` do not exist. Much of their content lives in `CODEBASE_AUDIT.md` and `ACTION_PLAN.md` under different names. |
| Automated a11y sweep | A static WCAG audit exists (`npm run audit:contrast`, 24 pairs) but it checks declared colour pairs, not the rendered DOM. |

## 4. One conflict that needs a decision

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
carries the older. **This needs an explicit call**, because Edge-only has a real
operational cost: `channel: "msedge"` uses the *installed* Edge binary, so any CI
image without Edge fails at launch — every test at once, reading as an outage
rather than a failure.

## 5. Recommendation

In order:

1. **Put the existing smoke suite into CI.** It is written, it is wired, nothing
   runs it. Highest value for the least work.
2. **Resolve the Edge-vs-Chrome conflict** and make the kit say one thing.
3. **Add Module C for the money path only** — cart → checkout → track. That is
   where the revenue is; the rest of the crawl is already covered by smoke.
4. Leave Modules A/B-per-persona and everything in §2.2 alone until this shop
   has accounts or plans. Today it has neither.
