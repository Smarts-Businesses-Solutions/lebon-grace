# Lebon Grace — Action Plan

Derived from `CODEBASE_AUDIT.md` (2026-08-05, branch `fix/email-sender-domain` @ `eefd24f`).
Finding IDs (S-1, D-3, …) refer to that document.

**Reading order:** Phase 0 is empty — that is a real result, not an omission. Start at Phase 1.

---

## Phase 0 — Emergency remediation

> **Revised 2026-08-08** after estate context arrived. The first draft said "nothing qualifies". That was wrong — it was written without knowing a second, newer deployment existed on Hetzner. See `CODEBASE_AUDIT.md` §0.

### A-0 · ~~Resolve the split-brain deployment~~ — **ALREADY DONE, finding retracted**
| | |
|---|---|
| **Status** | **Withdrawn.** Verified 2026-08-08: `shop.lebon-grace.com` and `lebon-grace.axiomsynapse.com` both serve `dpl=20260807141549`, the Hetzner build. The workstation stack is not running (`docker ps` shows no `lebon-grace-app`; `127.0.0.1:3105` dead). The cutover happened before this audit began. |
| **Why it was raised** | I compared Hetzner's build against a `dpl=` value for `shop.lebon-grace.com` that I remembered from a session three days earlier and echoed as if freshly measured. It was stale. See `CODEBASE_AUDIT.md` §C-1 for the full retraction. |

### A-0b · Rotate the exposed GitHub PAT *(replaces A-0 as the only P0)*
| | |
|---|---|
| **Priority** | **P0** |
| **Reason** | C-1b — a classic GitHub Personal Access Token sits in the production container's runtime environment (`docker inspect` → `Config.Env`), readable by anything that can inspect the container or read `/proc/1/environ` inside it. A classic PAT usually carries `repo` and `write:packages`. It is a build-time credential and has no runtime purpose. **It was additionally printed into an audit session's output**, so treat it as disclosed. |
| **Affected area** | GitHub token settings; Coolify app environment / registry credentials; `supabase.local` |
| **Dependencies** | None |
| **Effort** | Small |
| **Risk** | Low to fix. High to leave — with `write:packages` this token could push to GHCR, and estate policy requires those packages stay private. |
| **Expected outcome** | Old token revoked; no `ghp_` value in the app's runtime env; private image pulls still work via Coolify registry credentials. |
| **Acceptance criteria** | `docker inspect <app> --format '{{json .Config.Env}}'` contains no `ghp_`; a deploy still pulls successfully; new value recorded in `supabase.local` (never printed). |

Still held at P1 rather than P0: **A-1** (permissive RLS policy — the database is not publicly reachable) and **A-6** (`sharp` advisories — the path processes only operator-supplied images). If kong is ever exposed publicly, A-1 becomes P0 immediately.

---

## Phase 1 — Stabilization

*Objective: make mistakes visible before customers find them.*

### A-1 · Restrict the `products` RLS write policy — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `supabase/migrations/0001_restrict_products_write_policy.sql` applied. Verified in production: `pg_policies` returns **0** rows for `"Allow all write"` on `public.products`. |
| **Priority** | P1 |
| **Reason** | S-1 — `CREATE POLICY "Allow all write" ON public.products USING (true)` (baseline:3559) has no role restriction and no `WITH CHECK`. The `anon` key is public by design. Only network placement prevents catalogue rewrites. |
| **Affected area** | Database — `public.products` policies |
| **Dependencies** | None |
| **Effort** | Small (under an hour) |
| **Risk** | Low. App writes use the service-role key, which bypasses RLS entirely. |
| **Expected outcome** | Catalogue writes require the service role, not merely network position. |
| **Acceptance criteria** | With the `anon` key: `UPDATE products` and `DELETE FROM products` are rejected. `SELECT` on visible products still works. `04-generate-catalog.mjs` and `06-import-mdf.mjs` still succeed. |

### A-2 · Add CI — **in Forgejo, not GitHub Actions** — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `.forgejo/workflows/ci.yml` added: `runs-on: docker`, node 22, typecheck + `npm test` as hard gates. Lint runs with `|| true` because 51 pre-existing problems would make it red on arrival. |
| **Priority** | P1 |
| **Reason** | S-2 — nothing runs `typecheck`, `test` or `lint`, so nothing prevents deploying a broken commit. |
| **Affected area** | Forgejo pipeline + its self-hosted runner |
| **Dependencies** | A-3 (or scope lint in the same change, else CI is red on arrival from pre-existing cruft) |
| **Effort** | Small |
| **Risk** | Low |
| **Expected outcome** | Every push runs `npm ci && npm run typecheck && npm test && npx eslint src/`. |
| **Acceptance criteria** | A commit introducing a type error fails the Forgejo pipeline. |

> **Correction (C-3).** The first draft of this task said "add `.github/workflows/ci.yml`" and ranked it the single highest-leverage hour in the plan. That was wrong. **GitHub Actions is halted account-wide after a $256.70 bill** — workflows in `.github/workflows` do not run. Writing that file would have produced CI that never executes and, worse, the belief that changes were being checked.
>
> Do not add or edit GitHub workflow files unless you have first confirmed Actions was restored. CI belongs in Forgejo.
>
> Related: the only check currently reporting on PR #1 is a **Vercel** integration. Vercel is not part of this estate at all. It fails on every push with "Account is blocked", training everyone to ignore red CI. Disconnect it as part of this task so red means something again.

### A-3 · Scope ESLint to the application — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `eslint.config.mjs` scoped; 233 repo-wide → **54** on `src/` (32 errors, 22 warnings). The biggest single win was ignoring `.claude/**`, an in-repo worktree that was causing all of `src/` to be linted twice. |
| **Priority** | P1 (blocks A-2) |
| **Reason** | Q-1 — 182 of 233 lint problems are in root/ and scripts/ cruft. Lint is currently unusable as a signal, which is why it is not run. |
| **Affected area** | `eslint.config.mjs` |
| **Dependencies** | None |
| **Effort** | Small |
| **Risk** | Low |
| **Expected outcome** | Lint reports only on `src/`; ~51 real problems become visible and fixable. |
| **Acceptance criteria** | `npx eslint src/` reports a number small enough to drive to zero. |

### A-4 · Test the money path — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | All five written. 15 → 61 tests. Each new guard was verified by removing it and watching its own test fail. Writing (4) surfaced a live vulnerability in the order-id lookup — see S-6, fixed. |
| **Priority** | P1 |
| **Reason** | T-1 — the only tests cover `puzzle/geometry.ts`, a feature that has not shipped. The two behaviours most expensive to get wrong are untested. |
| **Affected area** | new tests beside `api/checkout/route.ts`, `api/stripe-webhook/route.ts`, `lib/cart-context.tsx`, `lib/store.ts`, `lib/product-filters.ts` |
| **Dependencies** | A-2 (so the tests actually gate something) |
| **Effort** | Medium |
| **Risk** | Low |
| **Expected outcome** | Five tests, in priority order: (1) checkout ignores client price; (2) webhook is idempotent on repeat delivery; (3) cart totals/quantity clamps/personalisation; (4) `/track` and `/account` phone matching; (5) price-tier half-open partition. |
| **Acceptance criteria** | Deliberately reintroducing "trust the client price" fails CI. Delivering the same webhook event twice creates one order. |

### A-5 · Verify deploys actually deployed — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Delivered in two parts, because the stated affected area covered only half the problem. **Correction:** `build-apps.sh` declares itself workstation-only ("This does NOT target the Hetzner estate… Do not point it at production"), and PROJECT-CONTEXT.md:236 records that lebon-grace deploys "via Coolify UI / git push (no deploy script)" — so fixing that script alone would never have verified a production deploy. Added: (1) `scripts/verify-deploy.mjs` in this repo, which polls the public site (`npm run verify:deploy`); (2) a post-`up -d` check in `build-apps.sh` for the workstation path, where the incident actually happened. Both were driven through every branch against a local server: stale container, replaced container, 200-but-not-rendered, missing `DEPLOYMENT_ID`, unreachable host. |
| **Priority** | P1 |
| **Reason** | R-2 — on 2026-08-04/05, five consecutive builds reported success while the container kept serving a two-hour-old build. Nothing detected it. |
| **Affected area** | `scripts/verify-deploy.mjs` (new), `package.json`, `ops/selfhost/scripts/build-apps.sh` |
| **Dependencies** | None |
| **Effort** | Small |
| **Risk** | Low |
| **Expected outcome** | After deploy, fetch the site and compare the served `dpl=` id against the one just built; fail loudly on mismatch. |
| **Acceptance criteria** | A deploy where the container is not replaced exits non-zero with a clear message. |

### A-6 · Patch the `sharp`/libvips advisories — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Next 16.2.9 → 16.3.0. `npm audit` reports **0 vulnerabilities**. Exact pin preserved for `deploymentId` version-skew protection. |
| **Priority** | P1 |
| **Reason** | P-1 — 6 vulnerabilities (5 high): CVE-2026-33327/33328/35590/35591. |
| **Affected area** | `package.json` — `next` 16.2.9 → 16.3.0 |
| **Dependencies** | A-2 (so the upgrade is validated automatically) |
| **Effort** | Small |
| **Risk** | Medium — a minor Next bump can shift build behaviour. Do it alone, on a branch. |
| **Expected outcome** | `npm audit --omit=dev` reports 0 high. |
| **Acceptance criteria** | Typecheck passes, build succeeds, all pages 200, checkout reaches Stripe. Do **not** use `npm audit fix --force`. |

### A-7 · Add database constraints — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `supabase/migrations/0002_add_constraints.sql` written and applied to production Postgres in one transaction. 7 CHECK constraints + `status NOT NULL`. Audited first: 1 order, 0 order_items, 610 products, 5066 variants, **zero** violations, so everything applied without a rewrite. Every criterion verified live, each with a paired precondition proving the constraint was the cause. **Two corrections to D-1**, both in the audit: the vocabulary is 10 values not 8 (it missed `out_for_delivery` and `completed`, both in the admin dropdown — a CHECK built from D-1's list would have rejected the admin's own dropdown), and `paid` is not vestigial but what the webhook wrote on *every* order, which is a live bug fixed here. |
| **Priority** | P2 |
| **Reason** | D-1, D-2 — `orders.status` is free text with 8 values used in code and no CHECK; no `price >= 0` or `stock >= 0` anywhere. |
| **Affected area** | `supabase/migrations/0002_add_constraints.sql` (0001 was taken by A-2), `src/app/api/stripe-webhook/route.ts` |
| **Dependencies** | A-8 (establish the forward-migration pattern), and audit existing rows first |
| **Effort** | Small |
| **Risk** | Medium — a constraint on dirty data fails to apply. Check current `status` values before writing it. |
| **Expected outcome** | Invalid states rejected by the database, not by convention. |
| **Acceptance criteria** | `UPDATE orders SET status='typo'` is rejected. `INSERT` with negative price is rejected. Existing rows all satisfy the constraints. |

---

## Phase 2 — Structural improvements

*Objective: shrink the surface a maintainer has to hold in their head.*

### A-8 · Adopt forward migrations — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Acceptance **proven, not asserted**: baseline + `0001` + `0002` applied to a throwaway database reproduces production's `public` schema **byte-identically** (195 normalised lines each; 9 tables, 7 CHECKs, 2 policies). The only raw diff was pg_dump's `
estrict` token, which is randomised per invocation. Made repeatable as `scripts/verify-migrations.sh`, and verified to fail correctly by injecting a bogus migration — it printed the exact offending object and exited 1, then dropped its scratch database via an EXIT trap on that failure path too. Convention documented in `supabase/migrations/README.md`, including the two traps that cost an hour each: `supabase_admin` is the only superuser, and `docker exec -i` without a pipe silently eats the rest of a heredoc. |
| **Priority** | P2 |
| **Reason** | D-4 — a single baseline dump with no incremental history. It had already drifted four tables, a view and three columns behind production before being regenerated on 2026-08-04. |
| **Affected area** | `supabase/migrations/` |
| **Dependencies** | None (A-7 becomes the first real migration) |
| **Effort** | Medium |
| **Risk** | Low |
| **Expected outcome** | Baseline stays as origin; numbered forward migrations from here. Schema change becomes reviewable in a diff. |
| **Acceptance criteria** | Applying baseline + all migrations to an empty database reproduces production exactly (the same check used on 2026-08-04). |

### A-9 · Delete the dead dropship code — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Removed `src/app/api/import/`, `src/app/api/proxy-image/`, `data/cj-products.json`, `data/cj-variants-extracted.json`. Build clean, 62 tests pass, both routes gone from the route manifest. **Correction:** the reason line implies `/api/import` is open — it is not, `requireAdmin` gates it (route.ts:39), hardened earlier this session. It was dead code, not an open door; `proxy-image` was the genuinely unauthenticated one. **Dependency not satisfiable:** "confirm no external caller" cannot be verified — neither the app container nor `coolify-proxy` logs requests at all (83 log lines, zero request lines), so there is no telemetry that could answer it. Proceeded on evidence that does exist: zero `proxy-image` URLs in the catalogue, the data files or any of the three DB image columns; `/api/import`'s job is superseded by `scripts/catalog/*.mjs` writing to Postgres; and any external caller of `import` would need the admin credential regardless. |
| **Priority** | P2 |
| **Reason** | A-1 (audit) — `api/import/route.ts` (286 lines) and `api/proxy-image/route.ts` are referenced by **zero** source files. `import` can rewrite the catalogue; `proxy-image` is unauthenticated, unrate-limited, and makes outbound fetches with wildcard CORS. |
| **Affected area** | `src/app/api/import/`, `src/app/api/proxy-image/`, `data/cj-*.json` — the scripts that POST to `/api/import` (`import-cj-variants.js`, `import-tabbit-variants.js`, `proxy-image-urls.js`) are cruft slated for A-10 |
| **Dependencies** | Confirm no external caller (a bookmarked admin tool) relies on `import` |
| **Effort** | Small |
| **Risk** | Low — git history retains everything |
| **Expected outcome** | Two live routes and two stale data files removed. |
| **Acceptance criteria** | `src/app/api` contains only routes reachable from the app or from Stripe. Site builds and all pages 200. |

### A-10 · Archive the cruft scripts — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | 54 files moved to `scripts/archive/`, grouped by the era that produced them — `cj-dropship/`, `mdf-oneshots/`, `ftp-deploy/`, `adhoc-verification/`, `hostinger/`, `catalog-migration/` — each explained in `scripts/archive/README.md`, which also tables the 12 paths that *do* run. `scripts/` now holds only live tooling; the repository root holds only `eslint.config.mjs` and `postcss.config.mjs`. Archived rather than deleted: git retains either way, but the grouping is what makes the history legible. **Two deliberate exclusions.** `scripts/catalog/03-cj-enrich.mjs` stays — it is re-runnable and `scripts/intel/` still uses `products.cj_pid`; only the genuinely one-shot `01`/`02`/`02b` migration steps were archived. The root `_pw_*.py` files stay put: `.gitignore:57` already ignores them, so they are local scratch invisible to anyone cloning, and moving them would either achieve nothing or wrongly add them to the repo. Build clean, 62 tests, lint unchanged at 54 on `src/`. |
| **Priority** | P2 |
| **Reason** | A-1 (audit) — ~45 scripts across root and `scripts/`, of which only `scripts/catalog/04–07` are active. A new maintainer cannot tell which matter. |
| **Affected area** | repo root, `scripts/` |
| **Dependencies** | A-3 (so the lint drop is visible as a win) |
| **Effort** | Medium |
| **Risk** | Low |
| **Expected outcome** | `scripts/` contains active tooling; historical one-shots move to `scripts/archive/` with a README, or are deleted. |
| **Acceptance criteria** | Every remaining script has an identifiable current purpose. |

### A-11 · Prune dependencies — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | All four removed from `dependencies`. Build clean, 62 tests pass, tsc clean, 0 vulnerabilities, exact pins (`next` 16.3.0, react 19.2.4) preserved. **Two corrections to P-2.** (1) `playwright` is *not* unused — `scripts/extract-cj-variants.js`, `scripts/scrape-cj-variants.js`, `scripts/test-3axis-img.js` and `check-all-categories.js` all `require("playwright")`. It still resolves after removal because `@playwright/test@1.62.0` (devDependency) depends on `playwright@1.62.0`, so those scripts keep working while it leaves the production manifest. (2) It was **never shipping into the runtime image**: `output: "standalone"` traces only what is imported, and the Dockerfile's runtime stage copies only `.next/standalone` + static + public + `@swc/helpers`. Verified — the standalone bundle carries 12 modules and none of the four are among them. The real gain is an honest manifest and a lighter build stage, not a smaller runtime image. |
| **Priority** | P2 |
| **Reason** | P-2 — `playwright`, `posthog-js`, `opentype.js`, `@stripe/stripe-js` are imported in **zero** `src/` files. `playwright` is in **production** dependencies, shipping browser automation into the runtime image. |
| **Affected area** | `package.json` |
| **Dependencies** | None |
| **Effort** | Trivial |
| **Risk** | Low — re-add `opentype.js` when name-puzzle work begins |
| **Expected outcome** | Smaller production image, honest manifest. |
| **Acceptance criteria** | Build succeeds; image size drops; no runtime import errors. *(Runtime image size was already unaffected — see Status.)* |

### A-12 · Index the `/account` lookup — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `0003_index_order_email_lookup.sql` applied. `customer_email_lc` is a stored generated column of `lower(customer_email)` with a btree index; the query is now `.eq("customer_email_lc", …)`. **Proven by EXPLAIN with `enable_seqscan = off`:** the old `ilike` still seq-scans under a 10⁹ cost penalty — no index can serve `~~*` at all — while the new predicate reports `Index Scan using orders_customer_email_lc_idx`. The `ilike` carried no wildcards; it was case-insensitive *equality* written with a pattern operator, which is precisely why it could not be indexed and why behaviour is unchanged. Generated column backfilled existing rows. `verify-migrations.sh` still green with 0003 in the set. **Deviation from the stated outcome:** the phone comparison is deliberately NOT pushed into the query — `phoneMatches` compares the last eight digits, i.e. `LIKE '%' || $1`, which no btree index can serve; it would need `reverse()` or pg_trgm to save filtering the handful of rows one address returns. Reasoning recorded in the migration. **Rejected `citext`** (needs an extension and a live `ALTER COLUMN TYPE`; PostgreSQL's docs now steer away from it) and **rejected a nondeterministic ICU collation** (what those docs recommend, but it disables pattern-matching operators entirely on the column, and `getById` already uses `ilike` elsewhere). |
| **Priority** | P2 |
| **Reason** | D-3 — `store.ts:103-106` uses `.ilike("customer_email", …)` (cannot use a btree index) then filters phone **in JavaScript** after transferring every matching row. No index on `customer_email` exists. |
| **Affected area** | migration + `src/lib/store.ts` |
| **Dependencies** | A-8 |
| **Effort** | Small |
| **Risk** | Low |
| **Expected outcome** | `CREATE INDEX ON orders (lower(customer_email))` with a matching `lower(...) = lower($1)` query, or `citext`; phone comparison pushed into the query. |
| **Acceptance criteria** | `EXPLAIN` shows an index scan. `/track` and `/account` still return the correct orders and still reject a wrong phone. |

### A-13 · Consolidate the variant modules — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Resolved as *"a documented reason for two"*. **The finding was wrong when written:** `src/lib/product-variants.ts` was deleted on 2026-08-02 in `ef23391`, three days *before* the audit snapshot `eefd24f` (2026-08-05) — confirmed with `git merge-base --is-ancestor`. There was no duplicate to consolidate. What remains are two layers of one fallback chain in `api/variants/route.ts`: `productVariants` (store.ts) reads the `product_variants` table — real supplier SKUs with price, image, colour, size, checked **first** and authoritative — and `variants.ts` derives groups from product *names*, used only when the database has nothing. Collapsing them would either discard the authoritative SKU data or make name-parsing authoritative, which it cannot be: it knows no price and no stock level, only what a product is called. Written into the header of `variants.ts` so the next reader does not re-attempt the merge. |
| **Priority** | P3 |
| **Reason** | A-2 (audit) — `lib/variants.ts` and `lib/product-variants.ts` cover the same concept. |
| **Affected area** | `src/lib/` |
| **Dependencies** | Trace consumers of both first |
| **Effort** | Small |
| **Risk** | Low |
| **Acceptance criteria** | One module, or a documented reason for two. |

---

## Phase 3 — Product and UX improvements

*Objective: reduce support load and make the shop easier to trust.*

### A-14 · Order status emails — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | The double-send guard already existed (`orders/route.ts` compares `currentOrder.status !== status`); it was untested, and is now pinned — removing it fails its own test. **What was actually broken was worse:** `buildEmailHTML` ended `statusMap[action] \|\| statusMap.confirmation`, so any action without a template inherited the *confirmation* body. Four of the eight statuses the admin dropdown could set had none — `deposit_paid`, `completed`, `failed`, `refunded` — so **refunding a customer emailed them "Order Confirmed! We're preparing your items now."** That was the default path, not an edge case. Subjects and bodies now derive from one `TEMPLATES` map, so the two cannot drift; an unmapped action sends **nothing** rather than the wrong thing. Added a `refunded` template (which deliberately omits the "all sales are final" line — a contradiction once a refund is issued), and added `cancelled` to the admin dropdown, where it was missing despite having full email and WhatsApp copy. 62 → 89 tests; the original bug was reconstructed and 5 tests catch it. |
| **Priority** | P2 |
| **Reason** | Highest value per unit of effort in the audit. Resend is already wired (`lib/email.ts`, used in 3 files) and `orders.status` already moves through `processing → shipped → delivered`. |
| **Affected area** | `src/lib/email.ts`, wherever status transitions are written |
| **Dependencies** | A-7 (a constrained status set makes the trigger reliable) |
| **Effort** | Small |
| **Risk** | Low — guard against double-send on repeated saves |
| **Expected outcome** | Customers stop having to ask where their order is. |
| **Acceptance criteria** | Moving an order to `shipped` sends exactly one email; moving it twice sends one. |

### A-15 · Production queue in `/admin` — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | `buildProductionQueue` (`src/lib/production-queue.ts`, pure and 16-tested) plus a `CuttingQueue` panel placed **above** the money cards, because it is the only part of that page that says what to physically do. Ordered started-work-first then strict FIFO; shows the wait in days, reddening at 3+; the engraved name is a high-contrast chip because a missed engraving means recutting the piece. Fed from the orders and items `/api/metrics` already fetches, so it costs no extra query. **Went beyond the stated scope for a reason:** the engraved name existed *only* inside the display string `product_name = 'Board (engraved: Amira)'`, so showing it meant parsing that sentence — which breaks on a name containing a bracket, silently, after the wood is cut. Migration `0004` gives it a real column with a 20-char CHECK matching the checkout cap, the webhook now writes it, and the parse survives only as a fallback for pre-0004 rows. Verified against production: the single queued order has **0** line items, so it renders the "⚠ no items recorded" warning — a paid order with nothing to make is exactly what must not be shown as an empty to-do. |
| **Priority** | P2 |
| **Reason** | A made-to-order workshop's core daily question is "what do I cut today, in what order". `OperationsDashboard` already exists. |
| **Affected area** | `src/components/OperationsDashboard.tsx` |
| **Dependencies** | A-7 |
| **Effort** | Small |
| **Expected outcome** | A status-ordered, date-sorted list of pieces awaiting cutting, with the engraving text visible. |
| **Acceptance criteria** | The operator can answer "what is due today" without opening the database. |

### A-16 · Resolve the clearance listing — **HIDDEN; recount BLOCKED on the photos**
| | |
|---|---|
| **Status (2026-08-08)** | **Part 1 done — the listing is hidden.** `products.hidden = true` for `phone-case-clearance` and the static catalogue regenerated: 42 → 41 products, and the Clearance category drops out of the nav by itself because categories derive from visible products. ⚠️ **This does not take effect until a deploy.** The storefront reads a build-time catalogue, not the database — `shop/page.tsx` imports `@/lib/products` and its only `useEffect` syncs URL params; `shop/[slug]/page.tsx` calls `getProductBySlug` from the same static module and hits the network only for `/api/variants`. `/api/products` exists but no storefront page consults it. Until the running image is replaced, the listing stays reachable and purchasable, and production is still on `dpl=20260807141549`. |
| **Blocker — Part 2** | **The 179 stock photos are not in this repository and never were.** `git log --all --diff-filter=A -- "*clearance*"` returns exactly **6** files, the chosen listing images. The 45% survey in §26.3 was run against a set held outside the repo. The recount cannot be done from anything available here — the photos need supplying (a folder, an archive, wherever the shoot lives). |
| **Useful finding from the 6 photos that do exist** | Each shows **one** item, and the labels use **two different schemes**: `phone-case-clearance-0.jpg` is marked **`i6.5`** — a *screen-size* code — while `-2.jpg` is marked **`IP11 pro`**, an actual model. That is the likely origin of the listing's model-name problem: size codes read as models. It also complicates the §26.3 finding, because a 6.5″ case genuinely does fit an iPhone XS Max, so "XS Max" may be an inference from a size code rather than an observation of stock. The recount must record **what each label literally says**, not what model it implies. |
| **Priority** | P2 |
| **Reason** | Section 26.3 — a 45% survey of the stock photos found the lot contains car mounts and USB cables as well as cases; the named models (Samsung S9, iPhone XS Max) were not seen while OnePlus models present go unmentioned; and `stock = 179` appears to be a *photo* count, with front/back pairing implying roughly **74** real items. |
| **Affected area** | `products` row `phone-case-clearance`, listing copy |
| **Dependencies** | A physical recount — this cannot be resolved from code |
| **Effort** | Small once counted |
| **Risk** | **Overselling a live listing** |
| **Acceptance criteria** | Stock equals a counted number; the description matches what is actually in the box. |

### A-17 · Restyle `/admin` — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | 201 off-system classes mapped to design tokens across `admin/page.tsx` and `OperationsDashboard.tsx`: **0** `gray-*`, **0** `bg-white`/`text-white`, and the only hex left is `#25D366`, WhatsApp's own brand green. **The blanket codemod introduced a serious regression that the audit caught:** mapping `text-gray-400` → `text-ink-soft` is right on light grounds but catastrophic on the dark header, where it measures **1.35:1** — the "Store" and "Log out" links would have been effectively invisible. Eight such pairings were fixed by hand. `npm run audit:contrast` now checks 24 real pairs and exits non-zero on failure; it found two more genuine failures (`red-600` on paper at 4.31, `red-500` on bone at 3.68), both fixed. All 24 pass. **Honest limitation, recorded in the script:** it audits declared pairs, not the live DOM — the admin page would not hydrate inside the in-app browser in dev *or* production, so `getComputedStyle` over rendered text was unavailable. A correct static list beats a browser run that silently measures an unhydrated page. |
| **Priority** | P3 |
| **Reason** | U-1 — the only surface never brought onto the design system. Staff-only, so low user impact. |
| **Effort** | Medium |
| **Acceptance criteria** | No residual `gray-*`/white-card styling; contrast audit passes. |

### A-18 · Post-delivery review request — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Migration `0005` adds `product_reviews` with `order_id` as a **FOREIGN KEY**, so "backed by a real order" is structural rather than a promise a later edit can forget, plus `UNIQUE(order_id, product_slug)` so one delivered order cannot be replayed into unlimited five-star reviews. `/api/reviews` enforces the three things a foreign key cannot: the submitter holds the order id **and** its phone (the same gate `/track` uses, including the S-6 hardening), the order has actually been delivered, and **the order actually contained that product** — without the last check, one delivered order could review the entire catalogue, which is the index-derived fake ratings again with extra steps. The reviewer's display name is taken from the order, never from the request. `/review` is the page the delivered email links to; `ProductReviews` renders **`null`** at zero reviews — no placeholder, no empty stars — preserving the rule set in `page.tsx:9-25` that "a card shows no rating at all, which is the truth". 107 → 127 tests. **One deviation:** the invitation rides on the `delivered` email rather than arriving days later, because there is no scheduler in this estate and an ask that never fires is worse than one that is slightly early; the template comment says where a cron would hook in. |
| **Priority** | P3 |
| **Reason** | The shop ships **no** ratings, deliberately — `page.tsx:9-25` records removing index-derived fake ratings, a genuinely good call. Real reviews would let honest social proof return. |
| **Dependencies** | A-14 (same email plumbing) |
| **Effort** | Medium |
| **Acceptance criteria** | Ratings shown are backed by a real order. |

---

## Phase 4 — Scaling and optimization

*Objective: remove the platform as a source of outages. Do not optimise the application — it is not under pressure.*

### A-19 · Decommission the workstation stack — **DONE / already true** (2026-08-08)
| | |
|---|---|
| **Status** | Acceptance verified, no action needed. Both `shop.lebon-grace.com` and `lebon-grace.axiomsynapse.com` return 200 serving `dpl=20260807141549` — the Hetzner build — and `docker ps` on the workstation shows **no** `lebon-grace`, `sh-tunnel` or `cloudflared` containers. Nothing resolves to the workstation and its Docker is already stopped, so the criterion "can be stopped with no public effect" is satisfied by it already being off. |
| **Priority** | P1 (raised) |
| **Reason** | C-1 — **the migration already happened.** Hetzner runs the app under Coolify with its own Supabase stack. What remains is a parallel workstation deployment that still answers `shop.lebon-grace.com` and still claims `lebon-grace.axiomsynapse.com` via its Cloudflare tunnel. Every Docker Desktop failure catalogued in R-1 — the stale-socket crashloop, two `Dead`-container 503s, five silent no-op builds — was a failure of **this redundant path**, not of production hosting. |
| **Affected area** | workstation Docker stack, `sh-tunnel-cloudflared-1`, the SSH tunnel via the Lightsail box, `sh-lebon-grace-*` containers |
| **Dependencies** | **A-0** (cut `shop.lebon-grace.com` over to Hetzner first) |
| **Effort** | Small once A-0 is done |
| **Risk** | Low after A-0; **do not** stop the workstation stack before the DNS cutover or the shop goes dark |
| **Expected outcome** | One deployment. Uptime stops depending on a desktop application's defect rate. |
| **Acceptance criteria** | Workstation Docker can be stopped with no public effect. No hostname resolves to it. |

> **Correction.** The first draft framed this as a large, budget-gated migration and put it in Phase 4. That was based on observing only the workstation. The work is smaller and more urgent than described: not "move to Hetzner" but "finish moving to Hetzner and turn the old one off."

### A-19b · Rebuild to clear the dead PostHog host — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | **Three** variables, not one: `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` and **`POSTHOG_PERSONAL_API_TOKEN`** — a live credential for a service that is no longer used. All three removed from `.env.local` and `ops/selfhost/apps/lebon-grace.runtime.env` (both gitignored; backups kept beside them with gitignored names). **Two corrections.** (1) The built image was *already* clean — the only `posthog` string anywhere in build output is the word `posthog.capture` inside a **sourcemap**, from the explanatory comment in `Analytics.tsx`; the shipped JS has zero, and so does `/app` in the running container. (2) The landmine warning no longer applies to this repo: `src/lib/analytics.ts` does not exist, and `src/components/Analytics.tsx` contains **no PostHog-named symbols at all** — only prose in a comment. There was nothing that could be deleted by mistake. Umami verified untouched: `/stats/script.js` → 200 and `data-website-id` still present on the live page. **Still outstanding, needs Coolify:** the running container's env still carries all three, so they persist until an env edit + redeploy — and `POSTHOG_PERSONAL_API_TOKEN` should be revoked, same class as A-0b. |
| **Priority** | P2 |
| **Reason** | C-4 — `NEXT_PUBLIC_POSTHOG_HOST=https://posthog.axiomsynapse.com` is set in both `.env.local` and `ops/selfhost/apps/lebon-grace.runtime.env`. No container and no certificate exist for that host. |
| **Affected area** | env files + a rebuild |
| **Dependencies** | A-0 (so the rebuild lands somewhere meaningful) |
| **Effort** | Small |
| **Risk** | **Medium if done carelessly** — see the warning below |
| **Expected outcome** | No build-time reference to a non-existent host. |
| **Acceptance criteria** | The built image contains no `posthog.axiomsynapse.com` string; Umami still records page views. |

> **Do not "remove the dead PostHog code" to achieve this.** Analytics in this app *is* Umami: `src/components/Analytics.tsx` has 6 Umami references to 2 PostHog-named ones and is mounted at `layout.tsx:98`. Deleting the PostHog-named symbols removes analytics (estate landmine 3). Remove the **env var** and the **`posthog-js` npm package** (A-11) — not the component.
>
> `NEXT_PUBLIC_*` is inlined at **build** time, so editing the env var alone changes nothing in a built image. A rebuild is required.

### A-20 · Uptime monitoring
| | |
|---|---|
| **Priority** | P2 |
| **Reason** | R-3 — Sentry/GlitchTip covers errors and Umami covers analytics, but every outage this session was noticed by a human loading the page. |
| **Effort** | Small |
| **Acceptance criteria** | A 503 on `shop.lebon-grace.com` alerts within minutes without anyone looking. |

### A-21 · Persistent login throttle — **DONE** (2026-08-08)
| | |
|---|---|
| **Status** | Migration `0006` adds `login_attempts`; `src/lib/login-throttle.ts` sits **behind** the in-memory limiter rather than replacing it — memory absorbs bursts with no round trip, Postgres remembers across restarts. Only failures count, and a success clears the address so an admin who mistypes and then gets in is not locked out of their own shop. **Acceptance proven end-to-end, with the control that makes it mean something:** five wrong passwords → 401, sixth → 429; the process was then killed and a *new* one started with empty in-memory buckets — the same address still got **429** while a different address still got **401**. Without that second address the result would equally have fitted a blanket block. Fails **open** with a loud log if Postgres is unreachable: failing closed turns a database blip into "nobody can administer the shop", and the in-memory limiter is still in front. |
| **Priority** | P3 |
| **Reason** | S-3 — the rate limiter is in-memory, so **every deploy clears every bucket**. With eight deploys in one day, `admin/login` brute-force protection is materially weaker than the configured numbers suggest. |
| **Effort** | Small |
| **Acceptance criteria** | Failed-login counters survive a container restart. |

### A-22 · Load-test before optimising
| | |
|---|---|
| **Priority** | P4 |
| **Reason** | P-3 — scaling recommendations in the audit are static-analysis based. At 42 products and single-digit orders nothing is under pressure. |
| **Effort** | Medium |
| **Acceptance criteria** | Measured numbers exist before any performance work is funded. |

---

## Phase 5 — Strategic opportunities

### A-23 · UAE toy-safety registration
| | |
|---|---|
| **Priority** | **P1 by risk, P5 by engineering** — it is not a code task, which is exactly why it keeps slipping |
| **Reason** | Section 26.1 — toys are a regulated product (ECAS/MoIAT, Gulf Conformity Mark, GSO EN 71). Local manufacture makes Lebon Grace the responsible party with no importer's certificate to inherit. **Eleven products are labelled for ages 1–3 with no EN 71-1 small-parts assessment.** Payments are live. |
| **Dependencies** | One written answer: is Lebon Grace registered with MoIAT? |
| **Effort** | Unknown until that is answered |
| **Expected outcome** | Either a labelling exercise or a registration project — the answer decides which. |
| **Acceptance criteria** | A documented position, and either assessment behind the under-three claims or those claims removed. See `docs/COMPLIANCE-UAE-TOY-SAFETY.md`. |

### A-24 · Name-puzzle generator
| | |
|---|---|
| **Priority** | P4 |
| **Reason** | `lib/puzzle/geometry.ts` already implements and tests the hard part — minimum feature width, island detection, path closure — the validation deciding whether a shape survives being cut from 3 mm MDF. |
| **Dependencies** | **Font licensing for physical goods is the real blocker, not the geometry.** Most free fonts are not licensed for resale of derived physical products. |
| **Effort** | Large |
| **Risk** | Licensing exposure if unresolved |
| **Acceptance criteria** | Preview matches the cut file; nothing customer-supplied cuts without review. |

### A-25 · Arabic / RTL storefront
| | |
|---|---|
| **Priority** | P4 |
| **Reason** | U-2 — English-only, LTR-only, selling to UAE consumers. |
| **Effort** | Large |
| **Acceptance criteria** | A deliberate decision either way, rather than a default. |

---

## Recommended implementation order

> **Revised.** A-0 now precedes everything: until there is one deployment, "did it ship?" has no answer.

```
A-0b rotate exposed PAT  ═══► do this first, today

(A-0 withdrawn — cutover already done; A-19 already done, workstation is off)

A-3  scope lint          ─┐
A-2  add CI (FORGEJO)    ─┴─► gate everything after this point
A-1  fix RLS policy         (independent, do immediately)
A-5  verify deploys         (independent, do immediately)
A-4  money-path tests    ── needs A-2
A-6  patch sharp         ── needs A-2
A-8  forward migrations  ─┐
A-7  DB constraints      ─┴─► A-14 status emails
A-12 index /account      ── needs A-8
A-9  delete dead routes  ─┐
A-10 archive scripts     ─┼─► smaller, clearer repo
A-11 prune deps          ─┘
A-16 clearance recount      (needs physical count — start early, it blocks nothing)
A-15 production queue    ── needs A-7
A-19 move off workstation   (start the decision now; long lead time)
A-23 MoIAT answer           (start now; one email, long external lead time)
```

**Three things to start today because they are blocked on other people, not on code:** A-16 (physical stock recount), A-19 (hosting budget decision), A-23 (MoIAT registration question).

---

## Suggested implementation phases

| Phase | Objective | Main tasks | Expected result |
|---|---|---|---|
| 0 | Emergency | *(none — nothing qualifies)* | — |
| 1 | Stabilization | A-1…A-7 | Mistakes become visible before customers find them |
| 2 | Structure | A-8…A-13 | Smaller, clearer, constrained codebase |
| 3 | Product & UX | A-14…A-18 | Less support load, more trust |
| 4 | Scaling | A-19…A-22 | Uptime stops depending on a desktop app |
| 5 | Strategic | A-23…A-25 | Compliance resolved; new capability on a proven core |

---

## A note on sequencing

The temptation with a list this long is to start with the satisfying deletions — the dead routes, the 45 cruft scripts, the unused dependencies. Those are Phase 2 for a reason.

**A-3 and A-2 come before them because they change what happens to every subsequent change.** Deleting code without CI means the first deletion that breaks something is discovered by a customer. With CI in place, the same deletions become routine and reversible.

**A-0b comes before even that** — a disclosed credential with `write:packages` on an estate whose standing rule is that GHCR packages stay private is not something to schedule.

### A note on how this plan was corrected twice

The first draft was written against the workstation stack, because that is what I could see. The second draft, after estate context arrived, declared a Critical split-brain deployment and made resolving it the only P0. **Both were wrong**, and the second was wrong in a way worth naming: I compared a live measurement of Hetzner against a `dpl=` value for `shop.lebon-grace.com` that I had *remembered from three days earlier* and printed in an `echo` as though it were current.

Three times in this engagement I reported something I had not actually measured — a font check that grepped HTML for names that only live in generated CSS, a content check against a client-rendered page, and this. Each time the command returned a result that could not have been informative, and each time I read it as evidence.

The practical lesson for whoever works this plan: **when a check's result would look identical whether the thing is true or false, it is not a check.** Ask what the failing case would look like before trusting the passing one.

The genuinely-highest-leverage item is A-0b, then A-2 — *in Forgejo*.
