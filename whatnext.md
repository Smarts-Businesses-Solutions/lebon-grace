# What Next

**Last Updated:** 2026-08-09

Priority rule: anything that can take a customer's money without delivering a
puzzle jumps the queue. Then security, then revenue, then growth, then DX.
Parked ideas live in [ENHANCEMENTS.md](ENHANCEMENTS.md) until they earn a slot.

## Now (P0)

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Rotate the exposed credentials** | Evariste | Live Stripe keys first. Also Supabase service-role, `SENTRY_PAT`, AI keys, and the Coolify RSA key partially printed in session output |
| 2 | **Enter rotated secrets into `lebon-grace-git`** | Evariste | The app now CLONES, BUILDS and RUNS (2026-08-10). Two fixes: repo switched to HTTPS (public, so no deploy key — the API cannot attach one anyway), and `NODE_ENV` un-marked as build-time, which was making `npm ci` skip devDependencies so the build died on `@tailwindcss/postcss` (216 packages installed instead of ~536). It serves `/` and `/shop`; DB-backed routes 500 because the secrets are deliberate PLACEHOLDERS (service-role key is 17 chars vs 180 live) per D-012. Enter the **rotated** values — do not copy the live ones, they are the exposed set. |
| ~~3~~ | ~~**Gate `/api/variants`**~~ | — | **Done 2026-08-09 — removed, not gated.** No product carries a `cjPid`, so the branch served only an attacker; the dropship model was abandoned. B-25. |

## Next (P1)

| # | Item | Notes |
|---|---|---|
| ~~4~~ | ~~`middleware.ts` denying by default~~ | **Done 2026-08-09** — `src/proxy.ts` (Next 16 renamed the convention). Denies any unlisted `/api/*` with a 404; a test fails the build if a route is added without being listed. |
| 5 | Cut the container env surface 67 → 25 | Do it during the Coolify cut-over; 36 unread credentials incl. `GitHub_PAT_classic` |
| 6 | Answer: is Lebon Grace a UAE-registered supplier? | One written answer unblocks A-23 / A-25 Tier 1 |
| 7 | Seeded order fixture | Everything around order tracking is tested; the happy path is not |

## Later (P2)

| # | Item | Blocked on |
|---|---|---|
| 8 | A-16 clearance recount | 179 photographs, not in the repo |
| 9 | Arabic / RTL | Deliberately deferred until the site is stable — `docs/DECISION-ARABIC-RTL.md` |
| 10 | EN 71-1 assessment for toys labelled ages 1–3 | `docs/COMPLIANCE-UAE-TOY-SAFETY.md` |
| 11 | Per-user admin accounts | Only matters on the first hire |
| 12 | Preview environments per branch | The Coolify git migration finishing |

## Out of scope

Customer accounts, wholesale/B2B, marketplace listings, subscriptions, native
apps. See [DECISIONS.md](DECISIONS.md) D-001.

---

<details>
<summary><b>Superseded — 2026-07-19 Hostinger resume block (kept for history)</b></summary>

> **This describes a migration that was abandoned.** The JSON store was replaced
> by Postgres and the Hostinger move was dropped; the app runs on the Hetzner
> estate under Coolify. Retained only so the older notes below make sense.

> **SESSION SAVE — 2026-07-19 (resume block).** This session migrated lebon-grace
> from Vercel/Supabase to a **self-hosted Hostinger Cloud Professional** Node.js app
> with a local JSON store (no Supabase). Full state in `SESSION_RESUME.md`.
> All session work is **uncommitted** (65 changed/untracked files) — committed only
> if you say "commit it". Two items remain gated on YOUR hPanel clicks (Task A reboot-proof
> Managed App, Task B FTP ticket). See `SESSION_RESUME.md` §4.

## Hide 43 MDF listings + DIY Kits / Kids Toys categories (reversible)

**Date:** 2026-07-10
**Status:** DONE — hidden (not deleted). Can be restored by removing the `hidden` flags.

**What was hidden:**
- 43 MDF products, all in 3 categories: **MDF Cutouts (20) + DIY Kits (15) + Kids Toys (8) = 43**.
  - All have `slug` starting `mdf-` and belong to those 3 categories.
  - Home Decor's 12 `mdf-*` items were LEFT VISIBLE on purpose (not part of the 43).
- 2 category labels hidden: **"DIY Kits"** and **"Kids Toys"** (removed from sidebar, header dropdown, and homepage grid).

**How it's hidden (mechanism — all in code, no data deleted):**
- `src/lib/products.ts`:
  - `Product` interface gained optional `hidden?: boolean`.
  - The 43 products got `hidden: true` appended (mechanical, reversible — just delete the `, hidden: true`).
  - `categories` array: `DIY Kits` and `Kids Toys` entries got `hidden: true`.
  - `getProductBySlug()` now ignores hidden products (`!p.hidden`) → direct URL to a hidden product 404s correctly.
  - `getProductsByCategory("All")` filters hidden.
- `src/lib/product-filters.ts`: `applyFilters()` now starts with `products.filter((p) => !p.hidden)` (shop grid + sidebar counts).
- `src/app/shop/page.tsx`: sidebar category list filters `!c.hidden`.
- `src/app/page.tsx` (homepage): category grid filters `!c.hidden`.
- `src/components/Header.tsx`: search category dropdown filters `!c.hidden`.

**To restore everything:** remove `, hidden: true` from the 43 product lines and from the 2 category entries in `src/lib/products.ts`. No DB/Supabase changes were made (MDF variants live in `product_variants` and are untouched — they just won't surface because the parent product is hidden).

**Verification after deploy:** shop grid shows 43 fewer products; "DIY Kits" / "Kids Toys" absent from category lists; direct URL `/shop/<hidden-slug>` → Product Not Found.

## Option B: Full Competitor Match (IVEI-style)

**Status:** Deferred — to be implemented later if needed

**Context:** Competitor IVEI sells MDF cutouts in SETS (15-20 pieces) with annotated dimension images showing measurement arrows, dual units (inches + mm), thickness callout, set count, and feature icons. Our current products are individual cutouts at AED 1-2 each.

**To implement Option B:**

1. **Product restructuring** — Convert individual cutouts to sets:
   - "MDF Heart Cutout" → "MDF Heart Cutouts – Set of 15"
   - "MDF Star Cutout" → "MDF Star Cutouts – Set of 15"
   - Animal shapes → "MDF Animal Cutouts – Set of 20" (mixed shapes)
   - Circle/square/hexagon → "MDF Shape Cutouts – Set of 20"

2. **Pricing update** — Individual AED 1-2 → Set pricing AED 8-15:
   - Simple shapes (circle, square, triangle): AED 8/set of 20
   - Complex shapes (heart, star, butterfly): AED 10/set of 15
   - Animal mixes: AED 12/set of 20
   - Premium shapes (owl, elephant): AED 10/set of 15

3. **Description updates** — Include set count, thickness (3mm), and feature bullets:
   - "Best gift for craft lovers"
   - "Blank surface for DIY"
   - "High quality MDF"
   - "Easy to paint"

4. **Dimension images** — Already generated (IVEI-style annotated images from Option A)

5. **Inventory/stock** — Update stock counts to reflect sets (currently 100 individual → 100 sets)

---

## TASK A: Reboot-proof via Hostinger Managed Node.js App — DEAD, 2026-08-19

> **Do not do this.** The shop left Hostinger in July. It runs in a container
> on cx53 under Coolify, which restarts it on boot, so the problem this task
> solved no longer exists. Kept so the queue still shows what was once asked.

**Status (historic):** DRAFTED + verified; needed 1 click. Cannot be done by assistant — `from-archive` API is Cloudflare-blocked from assistant IP (proven), and no other API path exists. hPanel UI is the only route.

**Why:** Current deploy uses PHP proxy + self-heal (survives routine crashes + first-visit-after-reboot). A full server reboot needs the Managed App to own the process.

**hPanel steps:**
1. `hpanel.hostinger.com` → Websites → `shop.lebon-grace.com` → **Node.js App** → Create/Enable
2. Entry point: `server.js` · Node version: **20** · Root directory: `/` (maps to `public_html/shop`) · App type: Other
3. Paste env vars below
4. **Start**

**Env vars (paste block) — fill `xxx` from local `.env.local`:**
```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://shop.lebon-grace.com
STRIPE_SECRET_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
ORDER_NOTIFY_EMAIL=orders@lebongrace.com
ADMIN_EMAIL=admin@lebongrace.com
CJ_API_KEY=xxx
CJ_EMAIL=xxx
CJ_PASSWORD=xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=smarts-business-solutions
SENTRY_PROJECT=lebon-grace
SENTRY_AUTH_TOKEN=xxx
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
WHATSAPP_PHONE=9715xxxxxxx
WHATSAPP_TOKEN=xxx
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
```
Var names verified against `src/**` + `next.config.ts` (STRIPE_SECRET_KEY, RESEND_API_KEY, CJ_API_KEY, NEXT_PUBLIC_POSTHOG_*, NEXT_PUBLIC_SENTRY_DSN, WHATSAPP_*).

**After it serves `shop.lebon-grace.com`:** remove the PHP proxy so the Managed App owns the process:
`rm public_html/shop/index.php public_html/shop/.htaccess`
Keep `server.js` + `.next/` + `public/` + `.data/` in `public_html/shop/`.

---

## TASK B: Hostinger FTP support ticket — DEAD, 2026-08-19

> **Do not submit this.** The account it concerns is no longer used to serve
> anything. Kept as the record of why FTP deployment was abandoned.

**Status (historic):** DRAFTED; needed 1 click. Cannot be auto-submitted — no ticket API in Hostinger spec (the `reach` endpoints are email-marketing, not support). Per standing rule, no external actions without explicit approval.

**hPanel steps:** Help → New ticket → paste below → submit.

**Subject:** FTP connection fails (no auth response) for all users on u298223980 — SSH works
**Priority:** Low

**Body:**
```
Account: u298223980 (Cloud Professional)
Server IP: 147.79.97.138
Domains: lebongrace.com, lebon-grace.com, shop.lebon-grace.com

Issue:
FTP returns no usable response for every credential set:
- Master FTP (u298223980): connection opens but auth never completes (no 220 banner, no 530 — hangs/timeout)
- Subdomain FTP (u298223980.deploynew / ftp.new.lebon-grace.com): same
Tested from two independent networks with multiple FTP clients. Never a 530, so it is not a password issue — the FTP service/port appears unreachable.

What works:
- SSH (port 65002) with key auth works perfectly — file management, deploy, site all fine.
- DNS API, hosting API, and the site itself are healthy.

Request:
Investigate why FTP is not responding on this account. Either (a) restore FTP (confirm correct endpoint/port/credentials), or (b) confirm FTP is deprecated in favour of SSH/SFTP and close as expected.
Note: not urgent — SSH fully covers file management. Raising for visibility in case other users on the account are affected.
```

**Note:** SSH already bypasses FTP entirely, so this is low-value visibility only.

---

## DONE THIS SESSION (verified)
- [x] Migrate shop to Hostinger, keep `shop.lebon-grace.com` live (FTP-blocked → SSH + PHP-proxy)
- [x] Comprehensive Playwright+Chrome end-to-end test (browse→cart→checkout→**Order Confirmed**)
- [x] Prove self-heal recovers from real crash (killed node, browser still serves app)
- [x] Clean up `new.lebon-grace.com` (DNS repoint, delete dup proxy, delete subdomain)
- [x] Saved skill `hostinger-ssh-php-proxy-deploy`
- [x] Drafted Task A env vars + Task B ticket (gated on user hPanel clicks)

</details>
