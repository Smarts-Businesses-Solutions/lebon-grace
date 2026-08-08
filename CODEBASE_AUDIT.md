# Lebon Grace — Codebase Audit

**Date:** 2026-08-05
**Branch audited:** `fix/email-sender-domain` @ `eefd24f`
**Method:** direct inspection + non-destructive validation runs. No code changed during the audit.

> **Scope caveat, stated up front.** This audit was planned as a five-specialist parallel review. All five subagents terminated on an API session limit before returning findings. What follows is a single-reviewer audit: it is evidence-backed and every claim carries a file reference, but it is **less exhaustive than a full multi-agent pass**. Section 27 lists exactly what was and was not reviewed.

---

## 0. CORRECTION — estate context received after first draft (2026-08-08)

Infrastructure context was supplied **after** this report was first written and **invalidates three of its conclusions**. Corrections are recorded here rather than silently edited in, so the original reasoning and its failure remain visible.

**What I got wrong, and why:** the first draft was written from what I could observe — a Docker Desktop stack on the operator's Windows workstation, which I had been deploying to and verifying against all session. That observation was accurate but incomplete. The real estate is a Hetzner cx53 (`116.203.242.215`) running 128 containers under Coolify.

### C-1 — RETRACTED: there is no split brain
**Status: WITHDRAWN 2026-08-08 · was "Critical"**

**This finding was wrong, and the error is worth recording because of how it happened.**

I claimed two live deployments serving different builds, and rated it the only P0 in the plan. Verified afterwards:

| Hostname | Build served | Reaches |
|---|---|---|
| `shop.lebon-grace.com` | `dpl=20260807141549` | Hetzner |
| `lebon-grace.axiomsynapse.com` | `dpl=20260807141549` | Hetzner |

Both serve the **same** build — the Hetzner one. The **workstation stack is not running at all** (`docker ps` returns no `lebon-grace-app`; `127.0.0.1:3105` is dead). The edge box's Caddy still proxies `shop.lebon-grace.com` → `127.0.0.1:8080`, and that tunnel endpoint now reaches Hetzner and returns 200.

**How I got it wrong:** I compared the Hetzner build against a `dpl=` value for `shop.lebon-grace.com` that I *remembered from the session three days earlier* and printed in an `echo` line as though it were a live measurement. It was not. Every conclusion downstream of that number — the split brain, the "customers are on a stale build", the P0 — followed from a stale figure presented as current.

This is the third instance in this engagement of the same failure mode: **asserting from memory instead of measuring.** The other two were a font check that grepped HTML for names that only exist in generated CSS, and a `/shop` content check against a client-rendered page. In each case the tool reported something that could not have been informative, and I read the result as evidence.

**Consequence:** A-0 was already complete before this audit began. The workstation is already decommissioned; A-19 is likewise substantially done.

### C-1b — Live GitHub PAT in the production container's environment (new, real)
**Severity: High · Confidence: Confirmed · Effort: Small**

**Evidence:** `docker inspect lebon-grace-lixqbqbkz39l0bnz9xv2227t --format "{{json .Config.Env}}"` includes a classic GitHub Personal Access Token (`GitHub_PAT_classic=ghp_…`).

**Problem:** A classic PAT typically carries broad scopes (`repo`, `write:packages`). It is present in the environment of a public-facing web application container, readable by anything that can inspect the container or read `/proc/1/environ` from inside it. It is not needed at runtime — a PAT is a *build*-time credential for pulling private GHCR images or private repos.

**It was also printed into this session's output by my own command**, so it must now be treated as disclosed regardless of prior exposure.

**Recommendation:** **Rotate the token now.** Then remove it from the application's runtime environment — if it is needed to pull private GHCR packages, it belongs in Coolify's registry credentials, not in the app's env. Record the new value in `supabase.local` per the standing rule.
**Acceptance:** The old token is revoked; `docker inspect` on the app shows no `ghp_` value; deploys still pull images successfully.

### C-2 — The data work did land correctly
**Severity: Informational · Confidence: Confirmed**

A genuine relief on inspection. `.env.local` and `ops/selfhost/apps/lebon-grace.runtime.env` both set `NEXT_PUBLIC_SUPABASE_URL=https://sb-lebon-grace.axiomsynapse.com` — the app reaches Supabase over the **public HTTPS URL by design** (estate landmine 2). So the catalogue scripts wrote to the Hetzner database, not the local container. Verified: `db-ezkokajmmqcv8bw8jy970l91` reports `total=610 visible=42 mdf=54`, matching exactly.

**Consequence for this report:** the database findings (D-1…D-5) were derived from `supabase/migrations/…baseline.sql`, a repository file, so they remain valid — but every remediation must be applied to **`db-ezkokajmmqcv8bw8jy970l91` on Hetzner**, not to the workstation container I queried.

### C-3 — The CI recommendation was wrong (corrects S-2 / A-2)
**Severity: High · Confidence: Confirmed**

**GitHub Actions is halted account-wide** following a $256.70 bill. Workflows in `.github/workflows` do not run. Adding `ci.yml` — the single highest-priority item in the first draft — would have produced a file that never executes and a false sense of coverage.

**CI lives in Forgejo (self-hosted) with its own runner.** The finding stands (nothing gates a deploy); the *remedy* changes to a Forgejo pipeline. See revised A-2 in `ACTION_PLAN.md`.

### C-4 — `NEXT_PUBLIC_POSTHOG_HOST` — **downgraded; production is already clean**
**Severity: Low (was Medium) · Confidence: Confirmed**

The variable is still present in `.env.local` and `ops/selfhost/apps/lebon-grace.runtime.env`:
```
NEXT_PUBLIC_POSTHOG_HOST=https://posthog.axiomsynapse.com
```
…but **the production build does not contain it.** Verified against the running Hetzner container: `posthog.axiomsynapse.com` appears in **0** built files, while Umami appears in 2. Commit `2c1339c refactor(analytics): read the Umami origin from UMAMI_ORIGIN` — made after this session — removed the hardcoded host.

So estate landmine 4 applies to this repo's **stale local env files only**, not to what customers load. The remaining work is tidying those two files so the next person does not reintroduce it.

Because `NEXT_PUBLIC_*` is inlined at build time, this also means the env files can be corrected at leisure — nothing ships until a rebuild.

**Do not "clean up the dead PostHog code" to fix this.** Analytics here is Umami: `src/components/Analytics.tsx` carries 6 Umami references to 2 PostHog-named ones, and it is mounted at `layout.tsx:98`. Deleting the PostHog-named symbols would remove analytics (estate landmine 3). The **`posthog-js` npm dependency** is separately dead and safe to drop (P-2). `src/components/PostHogProvider.tsx` has already been removed.

### C-5 — Tooling I relied on all session is documented as stale
**Severity: Medium · Confidence: Confirmed (per estate context)**

`ops/selfhost/README.md`, `scripts/build-apps.sh` and `bring-up-all.sh` are flagged as stale and actively wrong — the README still claims the estate runs on the workstation at $0/month. **`build-apps.sh` is the script I used for every deploy this session**, which is consistent with C-1: it deploys to the workstation, which is no longer where production should live.

### Corrections to specific sections below

| Section | Status |
|---|---|
| S-2 (no CI) | Finding valid; **remedy wrong** — Forgejo, not GitHub Actions |
| R-1 (move off workstation) | **Superseded by C-1** — Hetzner already exists; the task is cutover + shutdown, not migration |
| D-1…D-5 | Valid; apply to `db-ezkokajmmqcv8bw8jy970l91` |
| P-2 (unused deps) | Valid, with the C-4 caveat on analytics |
| Section 19 (deploy) | "shell script and operator discipline" describes the **workstation** path only |
| Vercel references | Vercel is not part of this estate at all; the failing check is purely vestigial |

---

## 1. Executive summary

**Overall assessment: Good, with a small number of specific risks that deserve attention before the shop takes meaningful order volume.**

This is a genuinely well-built small commerce application. The parts that handle money are careful: the checkout API refuses to trust client-supplied prices, the Stripe webhook verifies signatures and is idempotent, admin sessions are stateless HMACs in httpOnly cookies, and the image proxy has a real SSRF allowlist. The code is unusually well commented — comments explain *why* a decision was made and frequently record the bug that motivated it, which is rare and valuable.

The weaknesses are not in the application logic. They are in the **safety net around it**: there is no CI, almost no test coverage of the paths that move money, one over-permissive database policy, and a large volume of dead code from an abandoned dropship business model that inflates the attack surface and the maintenance burden.

**Is the codebase healthy?** Yes. `tsc --noEmit` passes clean under `strict: true`; the 15 unit tests pass.

**Is it safe to deploy?** Yes, with the caveat that nothing automated would stop a bad deploy — see Finding S-2.

**Is it maintainable?** The `src/` tree is. The repository root is not: ~40 orphaned scripts and stale documents that describe deployment flows the project abandoned.

**Is it scalable enough for near-term needs?** Comfortably. At 42 products and single-digit orders the design has enormous headroom. The one query that will not scale is documented as D-3.

### Three strongest parts

1. **Money-path integrity** — `src/app/api/checkout/route.ts:34-57` looks every product up by slug and recomputes the subtotal server-side, explicitly ignoring client prices.
2. **Auth and rate-limiting primitives** — `src/lib/admin-auth.ts` and `src/lib/rate-limit.ts` are small, correct, fail-closed, and honestly documented about their tradeoffs.
3. **Postgres as single source of truth** — the catalogue is generated from the database into `src/lib/products.generated.ts`, which keeps pages static and fast while keeping one authoritative copy of the data.

### Five most important problems

| # | Problem | Why it matters |
|---|---|---|
| 1 | `Allow all write` RLS policy on `products` (S-1) | A permissive write policy on the catalogue; currently mitigated only by network placement |
| 2 | No CI whatsoever (S-2) | Nothing prevents a broken or failing-typecheck commit from being deployed |
| 3 | No tests on the money path (T-1) | Checkout price integrity and webhook idempotency are the two behaviours most expensive to get wrong, and both are untested |
| 4 | 6 npm vulnerabilities, 5 high (P-1) | Inherited via `sharp`/libvips |
| 5 | Order `status` is unconstrained free text (D-1) | A typo writes a state no code handles, silently stranding an order |

### What to fix first

The RLS policy and CI, in that order. Both are hours, not days.

### What should NOT be changed

The checkout/webhook money path, the auth primitives, the generated-catalogue architecture, and the comment style. These are the parts a rewrite would most likely make worse.

### Are major rewrites justified?

**No.** Every issue in this report is addressable incrementally.

### 30 / 60 / 90 day plan

- **30 days** — Fix the RLS policy. Add CI (typecheck + test + lint on `src/`). Test the money path. Patch or accept the `sharp` advisories. Add DB constraints.
- **60 days** — Delete the dead dropship code and cruft scripts. Reconcile the stale docs. Add the missing index. Resolve the UAE toy-safety registration question.
- **90 days** — Move production off the workstation (Section 16), then revisit performance with real traffic data.

---

## 2. Project purpose and current state

Lebon Grace sells **41 hand-made laser-cut wooden puzzles at a flat AED 15**, plus one clearance listing, made to order in a Dubai workshop and sold direct to consumers in the UAE. Payment is live Stripe. Delivery is free workshop collection or AED 20 UAE delivery, free over AED 150. Every puzzle can be engraved with a name at no charge.

The project **pivoted** from a CJ-dropshipping storefront to this made-to-order workshop model. Much of the audit's findings trace to that pivot: the new business is clean, but the old one's machinery was never removed.

**Current state:** live and serving. 42 visible products (610 rows total, 568 hidden — the retired dropship range plus 53 MDF craft blanks retired on 2026-08-04).

---

## 3. Repository map

```
src/
  app/
    api/          14 routes (checkout, stripe-webhook, orders, admin/login,
                  contact, newsletter, products, variants, metrics,
                  cart-recovery, import, proxy-image, …)
    shop/, cart/, checkout/, account/, track/, admin/, about/, faq/,
    contact/, privacy/, terms/, unsubscribe/
  components/     Header, Footer, ProductImage, SafetyNotice, SearchBar,
                  OperationsDashboard, WhatsApp*, CartRecoveryBanner, Analytics
  lib/            store.ts (data access), stripe.ts, admin-auth.ts,
                  rate-limit.ts, cart-context.tsx, product-filters.ts,
                  products.generated.ts (generated), puzzle/geometry.ts
supabase/migrations/  single baseline dump (3,671 lines)
scripts/catalog/      04-generate-catalog, 05-import-lasercut,
                      06-import-mdf, 07-set-dimensions  ← active
scripts/              ~30 further files                 ← mostly dropship-era
root                  ~15 loose .js/.py scripts         ← historical
```

---

## 4. Architecture overview

```
Customer
   │
   ▼
Next.js 16 App Router  (React 19, Tailwind 4, standalone output)
   ├── Static catalogue ── src/lib/products.generated.ts
   │                        ▲ generated by scripts/catalog/04
   ├── API routes ─────────┐
   │                       ▼
   │              src/lib/store.ts ──► PostgREST (kong, 127.0.0.1:8113)
   │                                        └─► Postgres 17 (container)
   ├── Stripe (live) ── checkout session ──► webhook ──► orders/order_items
   ├── Resend ── transactional email
   └── Sentry/GlitchTip ── error reporting

Hosting: Docker on a Windows workstation.
Public: shop.lebon-grace.com (SSH reverse tunnel via an AWS Lightsail box)
        lebon-grace.axiomsynapse.com (Cloudflare tunnel, docker network)
```

**The key architectural decision** is that the catalogue is *generated*, not fetched. Postgres is authoritative; `04-generate-catalog.mjs` emits a TypeScript module; pages import it synchronously. This keeps the storefront fast and SEO-friendly with no client-side database calls, at the cost of needing a regenerate+rebuild when the catalogue changes. For a catalogue that changes weekly, this is the right trade.

---

## 5. Main user and system workflows

1. **Browse → buy.** `/shop` (filters from `product-filters.ts`) → product page → `cart-context` → `/checkout` → `POST /api/checkout` (re-prices server-side) → Stripe hosted page → `POST /api/stripe-webhook` (verified, idempotent) → `orders` + `order_items` rows → Resend confirmation.
2. **Personalisation.** Opt-in checkbox → cart item → checkout API (trimmed, capped 20 chars) → Stripe metadata → webhook → written into `order_items.product_name`. **Verified complete end-to-end.**
3. **Track an order.** `/track` — order ID + phone, or email + phone via `store.ts:103-112`.
4. **Admin.** `/admin` → password → HMAC session cookie → `/api/orders`, `/api/products`, `/api/metrics`.
5. **Catalogue change.** Edit Postgres → `04-generate-catalog.mjs` → `build-apps.sh lebon-grace`.

---

## 6. What is working well

| Strength | Evidence | Why it matters |
|---|---|---|
| Server-side price integrity | `api/checkout/route.ts:34-57` | Client cannot manipulate what they are charged |
| Webhook signature + idempotency | `api/stripe-webhook/route.ts` (4 signature refs) | Stripe retries cannot double-create orders |
| Stateless HMAC admin sessions | `lib/admin-auth.ts:24-64` | httpOnly, `timingSafeEqual`, fail-closed when unconfigured |
| SSRF allowlist on image proxy | `api/proxy-image/route.ts:5-22` | Hostname checked against a fixed list |
| RLS deny-all on order tables | baseline:3579-3585 | `orders`/`order_items` have RLS on and **no** policy — correct default |
| Comment quality | throughout | Comments record the bug that motivated the code; unusually high signal |
| Strict TypeScript, clean | `tsconfig.json:7`, `tsc` exit 0 | No `ignoreBuildErrors` escape hatch |
| Generated catalogue | `products.generated.ts` header | One source of truth, static delivery |
| Recent a11y work | `globals.css` `@layer base` | Contrast measured, not assumed |

---

## 7. Critical findings

**None.** No issue found rises to P0 — there is no active exposure, data-loss path, or broken production functionality.

The nearest thing is **S-1**, held below Critical only because the database is not publicly reachable.

---

## 8. Security findings

### S-1 — Over-permissive RLS write policy on `products`
**Category:** Security · **Severity:** High · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `supabase/migrations/00000000000000_baseline.sql:3559`
```sql
CREATE POLICY "Allow all write" ON public.products USING (true);
```
**Problem:** The policy has no `FOR` clause (so it covers SELECT/UPDATE/DELETE), no role restriction, and no `WITH CHECK`. Any role reaching PostgREST — including `anon`, whose key is by definition public (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — satisfies it. The catalogue could be rewritten or emptied. The only thing preventing this is that kong is bound to `127.0.0.1:8113` and not exposed publicly; that is a network placement, not an authorisation control, and it is one misconfiguration away from failing.

Note the contrast with `orders`/`order_items`, which have RLS enabled and *no* policy — correctly deny-all. The app's writes use the service-role key, which bypasses RLS entirely, so **restricting this policy should not affect the application**.

**Recommendation:** Drop `Allow all write`. Keep `Allow public read` (or scope it `FOR SELECT TO anon, authenticated USING (NOT hidden)`). Verify the catalogue scripts still work — they use the service-role key and should be unaffected.
**Acceptance:** `anon` key cannot UPDATE/DELETE a product row; `04-generate-catalog.mjs` and `06-import-mdf.mjs` still succeed.

### S-2 — No CI; nothing gates a deploy
**Category:** DevOps/Security · **Severity:** High · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** no `.github/workflows` directory exists.
**Problem:** `npm run typecheck`, `test`, and `lint` all exist and are useful, but nothing runs them automatically. A commit that breaks the build or fails typecheck can be pushed and deployed; the only gate is the operator remembering. The one CI check that *does* run on PR #1 is a Vercel integration for a platform this app left, which fails on every push with "Account is blocked" — actively training the operator to ignore red CI.
**Recommendation:** Add a workflow running `npm ci && npm run typecheck && npm test && npx eslint src/`. Scope lint to `src/` initially (see Q-1). Disconnect the dead Vercel integration so red means something.
**Acceptance:** A PR with a type error cannot be merged green.

### S-3 — Rate-limit state resets on every container restart
**Category:** Security · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `src/lib/rate-limit.ts:17` — `const buckets = new Map()`.
**Problem:** The limiter is in-process, which the file documents as a deliberate single-container choice. The unstated consequence is that **every deploy clears every bucket**. Deploys happen often (eight on 2026-08-04 alone), so the login limiter (`admin/login`) offers materially less brute-force protection than the numbers imply.
**Recommendation:** Accept for now, but add a second control that survives restarts on the login route specifically — a short lockout persisted to Postgres, or move the admin surface behind the tunnel's auth.

### S-4 — `Access-Control-Allow-Origin: *` on the image proxy
**Category:** Security · **Severity:** Low · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `api/proxy-image/route.ts:40`; no rate limiting on this route.
**Problem:** Any origin can use the endpoint as a free caching proxy for the three allowed hosts. Bandwidth abuse only — the allowlist prevents anything worse.
**Recommendation:** The route is called by **zero** source files. Delete it (see A-1). If kept, drop the wildcard CORS and add `rateLimit`.

### S-5 — Secrets hygiene: good
**Category:** Security · **Severity:** Informational · **Confidence:** Confirmed
**Evidence:** `.gitignore:34` — `.env*`. `supabase.local` lives outside the repository and has **0** commits touching it.
**Problem:** None. Recorded because it is a common failure this project avoids.

---

## 9. Functional and correctness findings

### F-1 — Personalisation verified complete
**Severity:** Informational · **Confidence:** Confirmed
Traced product page (`shop/[slug]/page.tsx:54,123`) → `cart-context.tsx:19-20` → `checkout/page.tsx:63` → `api/checkout/route.ts:45,52,96` (trim + 20-char cap) → `api/stripe-webhook/route.ts:128-133`. The name reaches the order. Recorded because it is the kind of flow that silently breaks and nobody notices until a customer complains.

**Sub-finding (Low):** the engraved name is concatenated into `order_items.product_name` as `"Name (engraved: X)"` rather than stored in its own column. It is not queryable, and a long product name plus engraving could hit a display limit. Consider an `order_items.personalisation` column.

### F-2 — Order `status` is unvalidated free text
See **D-1** — recorded under Database as it is a schema issue with functional consequences.

---

## 10. Architecture findings

### A-1 — Substantial dead code from the abandoned dropship model
**Category:** Architecture · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Medium
**Evidence:** referenced by **zero** files under `src/`:
- `src/app/api/import/route.ts` (286 lines — WooCommerce/CJ importer)
- `src/app/api/proxy-image/route.ts` (46 lines — allowlists DXF sites)
- `data/cj-products.json`, `data/cj-variants-extracted.json`
- ~30 files in `scripts/` and ~15 loose root scripts (`scrape-cj.js`, `hostinger-*.js`, `verify-*.js`, `_pw_*.py`)

**Problem:** Two live API routes exist that nothing calls. `import` can rewrite the catalogue (admin-gated, correctly) and represents real attack surface for a capability the business no longer uses. The scripts are worse as *noise*: a new maintainer cannot tell which of 45 scripts matter. Only `scripts/catalog/04–07` are active.
**Recommendation:** Delete both routes and the CJ data files. Move genuinely-historical scripts to `scripts/archive/` with a README, or delete them — git history retains them.
**Acceptance:** `src/app/api` contains only routes reachable from the app or an external caller (Stripe).

### A-2 — Duplicate variant modules
**Category:** Architecture · **Severity:** Low · **Confidence:** Needs verification · **Effort:** Small
**Evidence:** `src/lib/variants.ts` and `src/lib/product-variants.ts` both exist.
**Problem:** Two modules covering the same domain concept invites divergence. `variants.ts` is imported by the product page; `product-variants.ts`'s consumers were not traced.
**Recommendation:** Confirm which is live and delete the other, or document the split.

---

## 11. Code-quality findings

### Q-1 — 233 lint problems, but 78% are in cruft
**Category:** Code quality · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `npx eslint` → 157 errors, 76 warnings. By area:

| Area | Problems |
|---|---|
| root/ | 130 |
| scripts/ | 52 |
| src/app | 29 |
| src/lib | 18 |
| src/components | 4 |

Top rules: `no-require-imports` 105, `no-unused-vars` 51, `react/no-unescaped-entities` 23, `no-img-element` 17, `no-explicit-any` 16, `react-hooks/set-state-in-effect` 13.

**Problem:** Lint is unusable as a signal because 182 of 233 problems are in files that are not part of the application. This is why nobody runs it.
**Recommendation:** Ignore `scripts/` and root `*.js` in `eslint.config.mjs`, then fix the remaining ~51 in `src/`. `react-hooks/set-state-in-effect` (13) is worth real attention — it often indicates a render-loop or a state sync that should be derived.

### Q-2 — `no-img-element` (17) alongside a purpose-built `ProductImage`
**Severity:** Low · **Confidence:** Confirmed
The project has `src/components/ProductImage.tsx` wrapping `next/image` with documented `sizes` discipline, yet 17 raw `<img>` tags remain. Those bypass the optimizer entirely.

---

## 12. Frontend and UX findings

### U-1 — `/admin` never restyled
**Severity:** Low · **Confidence:** Confirmed · **Evidence:** `src/app/admin/page.tsx:197` retains `text-white` on a dark bar.
Staff-only, so low user impact. Now legible after the `@layer base` fix (see the a11y note below), but visually it is still the pre-redesign template.

### U-2 — No i18n or RTL support
**Severity:** Medium · **Confidence:** Confirmed · **Effort:** Large
Selling to UAE consumers with an English-only, LTR-only storefront. Not a defect, but a growth ceiling worth a deliberate decision rather than a default.

### U-3 — Accessibility was measured, and the measurement itself was wrong
**Severity:** Informational · **Confidence:** Confirmed
Recorded as a lesson: an earlier contrast script parsed digits out of computed colours, which produces nonsense for the `oklab()` values Tailwind emits for opacity-modified utilities — it reported ratios in the billions and called them passes. Compositing through a canvas fixed it and immediately surfaced four genuine AA failures (footer 3.61:1, header 2.60:1, account 2.35:1 and 3.05:1), all now resolved. **A verification tool that cannot fail is not a verification tool.**

---

## 13. Backend and API findings

### B-1 — Rate-limit coverage is inconsistent
**Category:** Backend · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** by route —

| Route | Auth | Rate limit |
|---|---|---|
| `admin/login` | — | ✅ |
| `checkout` | — | ✅ |
| `contact`, `contact/reveal` | — | ✅ |
| `newsletter`, `unsubscribe` | — | ✅ |
| `orders` | ✅ | ✅ |
| `cart-recovery` | — | ✅ |
| `products` | ✅ | ❌ |
| `metrics` | ✅ | ❌ |
| `import` | ✅ | ❌ |
| `variants` | ❌ | ❌ |
| `proxy-image` | ❌ | ❌ |
| `stripe-webhook` | signature | ❌ (correct) |

**Problem:** `variants` is unauthenticated *and* unlimited — the only public route with neither. `proxy-image` likewise, and it performs outbound fetches. The admin-gated routes without limits are lower risk but still allow a stolen session to be used aggressively.
**Recommendation:** Add `rateLimit` to `variants`. Delete `proxy-image`. Add generous limits to the admin trio.

### B-2 — `stripe-webhook` correctly has no rate limit
**Severity:** Informational** — noted so a future reviewer does not "fix" it. Rate-limiting a webhook endpoint causes Stripe retries and duplicate-delivery pressure. Signature verification is the correct control here, and it is present.

---

## 14. Database findings

### D-1 — `orders.status` is unconstrained free text
**Category:** Database · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `baseline.sql:1860` — `status text DEFAULT 'deposit_paid'::text`. Code uses **eight** distinct values: `shipped`(8), `delivered`(8), `processing`(7), `deposit_paid`(6), `cancelled`(3), `refunded`(1), `paid`(1), `failed`(1).
**Problem:** No CHECK constraint and no enum. A typo in an admin update writes a status no branch handles, and the order silently falls out of every filtered view — invisible until a customer asks where their puzzle is. The spread of counts also suggests `paid` and `failed` may be vestigial.
**Recommendation:** Add `CHECK (status IN (...))` with the agreed set. Audit existing rows first.
**Acceptance:** An invalid status is rejected by the database, not just by convention.

### D-2 — No value constraints on money or stock
**Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** no CHECK constraints exist on any `public` business table (the only CHECK in the dump is Supabase's own `auth.users`).
**Problem:** `price` and `stock` accept negatives. A negative price would flow into the Stripe line item as a negative `unit_amount`.
**Recommendation:** `CHECK (price >= 0)`, `CHECK (stock >= 0)`, and `NOT NULL` where the app already assumes it.

### D-3 — `/account` order lookup cannot use an index
**Category:** Database/Performance · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `src/lib/store.ts:103-106`
```ts
.ilike("customer_email", email)
…
return (data || []).filter((o) => phoneMatches(o.customer_phone || "", phone));
```
Indexes on `orders`: `idx_orders_status`, `idx_orders_stripe_session` only. `customer_email` appears once in the schema — its column definition.
**Problem:** Two compounding issues. `ilike` cannot use a plain btree index, so this is a sequential scan; and the phone match runs **in JavaScript after transferring every matching row**. At today's volume (1 order) this is free. At a few thousand orders it becomes a full-table read on every `/account` visit.
**Recommendation:** Add `CREATE INDEX ON orders (lower(customer_email))` and query with `lower(customer_email) = lower($1)`, or use `citext`. Push the phone comparison into the query.

### D-4 — Single baseline dump, no incremental migrations
**Category:** Database · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Medium
**Evidence:** `supabase/migrations/` contains exactly one file, a full `pg_dump`.
**Problem:** There is no forward-migration history, so there is no reviewable record of schema change and no way to apply a change to an existing database — only to recreate one. This baseline was regenerated on 2026-08-04 *because it had drifted four tables, a view and three columns behind production*, which is precisely the failure mode this structure invites.
**Recommendation:** Keep the baseline as the origin, and add numbered forward migrations from here (`0001_add_status_check.sql`, …). The constraints proposed in D-1/D-2 are a natural first migration.

### D-5 — PII retention is undefined
**Severity:** Medium · **Confidence:** Confirmed · **Effort:** Medium
`orders` stores name, email, phone and full delivery address indefinitely, with no retention policy, no deletion workflow, and no audit of who viewed or changed a row. For a consumer business in the UAE this should be a deliberate decision.

---

## 15. Performance and scalability findings

### P-1 — 6 npm vulnerabilities (5 high) via `sharp`/libvips
**Category:** Security/Dependencies · **Severity:** High · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** `npm audit --omit=dev` → CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 (GHSA-f88m-g3jw-g9cj). Fix requires `next@16.3.0`, outside the current range.
**Problem:** `sharp` processes untrusted image bytes at build time. Exploitability here is low (images are the operator's own files, not user uploads), but the advisories are real and the fix is a minor Next bump.
**Recommendation:** Upgrade Next 16.2.9 → 16.3.0 on a branch, typecheck, build, smoke-test, deploy. Do not `audit fix --force` blindly.

### P-2 — Four unused production dependencies
**Category:** Dependencies/Performance · **Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
**Evidence:** imported in **0** files under `src/`:

| Package | In | Note |
|---|---|---|
| `playwright` | **dependencies** | Browser automation shipping in the production image |
| `posthog-js` | dependencies | Replaced by Umami; provider component orphaned |
| `opentype.js` | dependencies | For the unbuilt name-puzzle feature |
| `@stripe/stripe-js` | dependencies | Checkout is server-side redirect; client SDK unused |

**Problem:** `playwright` in production dependencies is the notable one — it pulls a browser-automation stack into the runtime image for no reason. It belongs in `devDependencies` alongside `@playwright/test`, which is already there.
**Recommendation:** Move `playwright` to devDependencies; remove the other three (re-add `opentype.js` when the name-puzzle work actually starts).

### P-3 — Scaling headroom is large; one real ceiling
At 42 products and ~1 order, nothing is under pressure. Projections: **100 orders** — no change needed. **1,000 orders** — D-3 begins to hurt `/account`. **10,000 orders** — D-3 is a problem, and the in-memory rate limiter (S-3) plus single-container assumption block horizontal scaling. The generated-catalogue design scales fine; the rebuild-on-change cost grows only with catalogue size.

---

## 16. Reliability and operational findings

### R-1 — Production runs on a Windows workstation via Docker Desktop
**Category:** Reliability · **Severity:** High · **Confidence:** Confirmed · **Effort:** Large
**Evidence, from this session alone (2026-08-04/05):**
- A stale AF_UNIX socket crashloop (`dockerInference`, `docker-secrets-engine`) took the shop down for hours; resolved only by clearing both socket directories and ultimately a reboot ([upstream defect](https://github.com/docker/desktop-feedback/issues/460)).
- A container reached `Dead` state with a stale `Created` duplicate **twice**, each time taking the site to 503.
- A corrupted unrelated container (`flamboyant_hypatia`, the GitHub MCP server) jammed the daemon so thoroughly that `docker system df` errored and **five consecutive builds silently produced no image** — the shop served a two-hour-old build while reporting success.

**Problem:** None of these were application faults. The application was correct throughout; the platform beneath it was not. This is the single largest reliability risk in the project and no amount of application-level care mitigates it.
**Recommendation:** Move production to a managed host (the Hetzner plan already discussed). Until then, add a deploy-verification step that compares the served `dpl=` build id against the one just built — that single check would have caught the five silent failures immediately.

### R-2 — No deploy verification
**Severity:** Medium · **Confidence:** Confirmed · **Effort:** Small
`build-apps.sh` reports success on building the image; it does not verify the running container is serving it. Recommend asserting the served deployment id post-deploy.

### R-3 — Observability exists but is not alerting
Sentry/GlitchTip is wired (`instrumentation.ts`, `sentry.*.config.ts`) and Umami covers analytics. No uptime monitoring was found — the outages above were noticed by a human looking at the site.

---

## 17. Testing findings

### T-1 — The money path is untested
**Category:** Testing · **Severity:** High · **Confidence:** Confirmed · **Effort:** Medium
**Evidence:** `npx vitest run` → 1 file, 15 tests, all passing — **all** in `src/lib/puzzle/geometry.test.ts`, which tests a feature that has not shipped.
**Problem:** The only tested module is the one with no users. Untested, in rough order of what a failure would cost:

1. `api/checkout/route.ts` price re-derivation — a regression here means charging the wrong amount
2. `api/stripe-webhook/route.ts` idempotency — a regression means duplicate orders on Stripe retry
3. `lib/cart-context.tsx` totals, quantity clamps, personalisation persistence
4. `lib/store.ts` order lookup and phone matching (the `/track` and `/account` gate)
5. `lib/product-filters.ts` — the half-open price partition is exactly the kind of boundary logic that regresses silently

**Recommendation:** Five focused unit tests, in that order, before any new feature. Each is small: the checkout one need only assert that a request claiming `price: 1` for a 15 AED product produces a 15 AED Stripe line item.
**Acceptance:** A deliberately introduced price-trust bug fails CI.

---

## 18. Dependency findings

Covered in **P-1** (vulnerabilities) and **P-2** (unused). Additionally: 11 packages are behind latest, all minor except `@types/node` (20 → 26) and `eslint` (9 → 10). Nothing is deprecated or unmaintained. `next` and `eslint-config-next` are correctly pinned together.

---

## 19. CI/CD and developer-experience findings

Covered in **S-2** (no CI). Additionally:

- **Good:** `output: "standalone"`, `deploymentId` for version-skew protection, a genuinely thoughtful `.dockerignore` (including the `originals` exclusion that cut the build context by 432 MB), Sentry release creation correctly disabled for container builds with the reason documented (`next.config.ts:42-44`).
- **Weak:** deploys depend on a shell script and operator discipline; no preview environments; no rollback procedure documented.

---

## 20. Documentation findings

### DOC-1 — Multiple documents describe abandoned deployment flows
**Severity:** Medium · **Confidence:** High · **Effort:** Small
`HOSTINGER_DEPLOY.md`, `HOSTINGER_DEPLOY_ENVS.md`, `HOSTINGER_FTP_DEPLOY.md`, `HOSTINGER_FTP_TICKET.md` describe FTP deployment to Hostinger. The project self-hosts via Docker and has not used Hostinger for hosting. `LEBON-GRACE-SOURCING-BLUEPRINT.md` and the CJ-era material describe the abandoned dropship model.
**Problem:** A new maintainer reading the repository root would reasonably conclude the deploy target is Hostinger FTP. Stale instructions are worse than absent ones.
**Recommendation:** Move to `docs/archive/` with a header line stating they are historical, or delete.

### DOC-2 — The catalogue architecture is undocumented where it would be found
**Severity:** Medium · **Confidence:** High · **Effort:** Small
The Postgres → `04-generate-catalog.mjs` → `products.generated.ts` → rebuild pipeline is the single most important thing to understand about this codebase, and it is explained only in the header comment of the generated file. A maintainer who edits `products.generated.ts` by hand loses their work at the next regenerate.
**Recommendation:** A ten-line "How the catalogue works" section in `README.md`.

### DOC-3 — Compliance doc is a genuine strength
`docs/COMPLIANCE-UAE-TOY-SAFETY.md` records the ECAS/MoIAT/G-Mark/EN-71 position, why local manufacture makes Lebon Grace the responsible party, and what remains open. It correctly labels itself as engineering summary rather than legal advice.

---

## 21. Technical debt

| Debt | Risk | Current impact | Resolution | Priority |
|---|---|---|---|---|
| Dead dropship code (2 routes, ~45 scripts, data files) | Attack surface + confusion | Medium | Delete / archive | P2 |
| No incremental migrations (D-4) | Schema drift recurs | Medium | Forward migrations from baseline | P2 |
| Lint noise (Q-1) | Signal ignored | Medium | Scope config to `src/`, fix ~51 | P2 |
| Stale docs (DOC-1) | Misleads maintainers | Medium | Archive | P3 |
| Duplicate variant modules (A-2) | Divergence | Low | Consolidate | P3 |
| Engraved name inside `product_name` (F-1) | Not queryable | Low | Dedicated column | P3 |
| Unused prod deps (P-2) | Image size, confusion | Low | Prune | P2 |

---

## 22. Product-improvement opportunities

Grounded in what exists, not generic SaaS suggestions:

1. **Order status emails.** Resend is already wired and `orders.status` already moves through `processing → shipped → delivered`. Sending an email on transition is a small change that would remove most "where is my order" contacts. **Highest value per unit of effort in this list.**
2. **Production queue in `/admin`.** `OperationsDashboard` exists. A made-to-order workshop's core daily question is "what do I cut today, in what order" — a status-ordered, date-sorted list answers it.
3. **Review collection.** The code deliberately ships **no** ratings because none were real (`src/app/page.tsx:9-25` documents removing index-derived fake ratings — a good decision). A post-delivery review request would let genuine ratings return honestly.
4. **Dimensions on the card, not just the detail page.** 40 of 42 products now carry dimensions; size is the most common pre-purchase question for a physical toy.

---

## 23. New feature ideas

| Idea | Problem solved | Value | Complexity | Priority |
|---|---|---|---|---|
| Order status emails | "Where is my order?" support load | High | Small | P2 |
| Admin production queue | Workshop scheduling | High | Small | P2 |
| Post-delivery review request | No social proof at all | Medium | Medium | P3 |
| Name-puzzle generator | Differentiated product | High | Large | P4 |
| Arabic / RTL storefront | UAE market reach | Medium | Large | P4 |

The **name-puzzle generator** deserves a note: `src/lib/puzzle/geometry.ts` already implements and tests the hard part (minimum feature width, island detection, path closure — the validation that decides whether a shape survives being cut from 3 mm MDF). The remaining work is glyph assembly and an approval queue. Font licensing for physical goods is unresolved and is the real blocker, not the geometry.

---

## 24. Recommended refactors

1. **Delete `api/import` and `api/proxy-image`** — behaviour-preserving (nothing calls them). Small. Do first.
2. **Scope ESLint to `src/`** — makes lint a usable signal. Small.
3. **Extract order-status constants** — a single exported union type consumed by both code and the D-1 CHECK constraint. Small; prevents drift.
4. **Consolidate `variants.ts` / `product-variants.ts`** — verify consumers first. Small.

No large refactor is justified. The architecture fits the problem.

---

## 25. Prioritized action plan

See **`ACTION_PLAN.md`** for the full phased roadmap.

---

## 26. Risks and unresolved questions

1. **UAE toy-safety registration** — is Lebon Grace registered with MoIAT? This determines whether the outstanding compliance work is labelling or a registration project. Unanswered; the largest non-technical risk. Eleven products are labelled for ages 1–3 with no EN 71-1 small-parts assessment behind the claim.
2. **Vercel account block** — the account is blocked and the integration still fires a failing check on every push. Requires account-holder action.
3. **Clearance listing accuracy** — a survey of 45% of the stock photos found the listing describes a phone-case lot, but the stock also contains car mounts and USB cables; the models named (Samsung S9, iPhone XS Max) were not seen while OnePlus models present are unmentioned; and `stock = 179` appears to be a *photo* count — front/back pairing suggests roughly **74** actual items. Unresolved and an overselling risk.
4. **Hosting decision** — R-1 needs a budget decision.
5. **Not verified in this audit** — see Section 27.

---

## 27. Commands executed and validation results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** — clean under `strict: true` |
| `npx vitest run` | **15/15 passed**, 1 file (`geometry.test.ts`), 681 ms |
| `npx eslint` | **exit 1** — 233 problems (157 errors, 76 warnings) |
| `npx eslint -f json` + analysis | root 130, scripts 52, src/app 29, src/lib 18, src/components 4 |
| `npm audit --omit=dev` | **6 vulnerabilities (1 low, 5 high)** — `sharp`/libvips |
| `npm outdated` | 11 behind; all minor except `@types/node`, `eslint` |
| grep: imports of `posthog-js`/`opentype.js`/`playwright`/`@stripe/stripe-js` in `src/` | **0 each** |
| grep: `/api/<route>` references in `src/` | `import` 0, `proxy-image` 0; all others ≥1 |
| grep: `.gitignore` secrets | `.env*` present |
| `ls .github/workflows` | **does not exist** |
| grep: CHECK/INDEX/POLICY in baseline | 3 policies, 6 public indexes, RLS on 5 tables, 0 business CHECKs |

**No destructive commands were run.** No database connection was made. No deploy was performed. No secret values are reproduced in this report.

### What was NOT reviewed

The five specialist subagents failed on a session limit, so the following received only the single-reviewer treatment above and would benefit from deeper inspection:

- `src/app/api/metrics/route.ts` (279 lines) and `cart-recovery/route.ts` — read for auth/rate-limit signals only, not line-by-line for data exposure.
- `src/components/OperationsDashboard.tsx` and `src/app/admin/page.tsx` — not reviewed for UX or correctness.
- Client components' loading/empty/error states — not systematically reviewed.
- `data/*.json` orphan analysis — partially completed.
- The `auth` and `storage` schemas in the baseline (Supabase-managed) — not reviewed.
- Runtime performance profiling — not attempted; recommendations in Section 15 are static-analysis based and should be confirmed with load testing before acting on P-3.

---

## 28. Final recommendation

**Ship-worthy. Do not rewrite. Add the safety net.**

The application code is better than its surroundings suggest. Someone was careful where it counted — the money path, the auth primitives, the honest removal of fake ratings and fake discounts — and left an unusually good written record of *why*. That is worth preserving, and it is the main reason this audit recommends no significant refactor.

What is missing is everything that would catch a mistake: no CI, no tests on the paths that move money, no database constraints behind the application's assumptions, and a production platform that failed three separate ways in a single day. None of that is hard to fix, and none of it requires touching the good code.

Start with the RLS policy and CI. They are the two smallest changes with the largest reduction in the chance of a bad day.

---

### Highest-priority issues

| Priority | Finding | Impact | Effort | Action |
|---|---|---|---|---|
| P1 | S-1 over-permissive `products` write policy | Catalogue integrity | Small | Drop/scope the policy |
| P1 | S-2 no CI | Broken deploys undetected | Small | Add typecheck+test+lint workflow |
| P1 | T-1 money path untested | Wrong charges, duplicate orders | Medium | 5 targeted unit tests |
| P1 | P-1 `sharp` advisories (5 high) | Known CVEs | Small | Next 16.2.9 → 16.3.0 |
| P2 | D-1 unconstrained order status | Orders silently stranded | Small | CHECK constraint |
| P2 | R-2 no deploy verification | Silent stale deploys | Small | Assert served `dpl=` |
| P2 | D-3 unindexed `/account` lookup | Degrades with growth | Small | Functional index |
| P2 | A-1 dead dropship code | Attack surface, confusion | Medium | Delete 2 routes + archive scripts |

### Quick wins

| Improvement | Benefit | Effort | Area |
|---|---|---|---|
| Move `playwright` to devDependencies | Smaller production image | Trivial | `package.json` |
| Remove 3 unused prod deps | Less confusion | Trivial | `package.json` |
| Scope ESLint to `src/` | Lint becomes usable | Trivial | `eslint.config.mjs` |
| Delete `api/proxy-image` | Removes an unauthenticated, unlimited route | Trivial | `src/app/api` |
| Disconnect dead Vercel check | Red CI means something again | Trivial | Vercel dashboard |
| Archive `HOSTINGER_*` docs | Stops misleading maintainers | Trivial | repo root |
| README catalogue section | Prevents lost hand-edits | Small | `README.md` |

### Strengths to preserve

| Strength | Why it matters | Area |
|---|---|---|
| Server-side re-pricing | Client cannot alter what they pay | `api/checkout` |
| Webhook signature + idempotency | Retries cannot duplicate orders | `api/stripe-webhook` |
| HMAC admin sessions, fail-closed | No password in the bundle | `lib/admin-auth.ts` |
| RLS deny-all on order tables | Correct default | baseline:3579-3585 |
| Why-not-what comments | Institutional memory in the code | throughout |
| Generated catalogue from Postgres | One source of truth, static speed | `scripts/catalog/04` |
| Refusal to ship fake ratings/discounts | Legal exposure avoided, trust kept | `page.tsx:9-25` |
