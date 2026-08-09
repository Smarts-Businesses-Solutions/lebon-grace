# Lebon Grace — Technical Decisions Log

**Last Updated:** 2026-08-09 (D-008 … D-012 added — the remediation and Coolify decisions)

Lightweight ADRs. One per non-obvious choice. The test for inclusion is whether
the rejected option was genuinely tempting — if the alternative was obviously
worse, it is not a decision, it is just the code.

Memory-side mirror with the reasoning that would not survive a `git log`:
`project_lebon-grace_decisions.md`.

---

## D-001 — No customer accounts (guest checkout + phone lookup)

**Context.** Every e-commerce template starts with registration and login.

**Decision.** No accounts at all. Buy as a guest; afterwards, look an order up
with a phone number plus an order id or email.

**Alternatives.**

| Option | Verdict |
|---|---|
| Full accounts (register / login / reset) | Rejected — a signup step in front of a AED 15 impulse purchase, in exchange for nothing the buyer wants |
| Magic-link email login | Rejected — still an inbox round-trip per lookup, for a once-a-year purchase |
| **Guest + phone lookup** | ✅ Picked |

**Consequences.** *Easier:* no password store, no reset flow, no credential
stuffing, no session fixation — whole categories of risk deleted. *Harder:*
identity is re-established per lookup, and the credential is effectively a phone
number; a hit returns name, email, phone and address.

**Revisit if** repeat-purchase rate becomes material, or wholesale/B2B starts.

## D-002 — Self-hosted Postgres via Supabase, reached server-side only

**Context.** The catalogue, orders and reviews need a real database.

**Decision.** Self-hosted Supabase on cx53. All access is server-side through
`src/lib/store.ts` with the service-role key. The anon key is never used.

**Consequences.** *Easier:* real constraints and foreign keys; no vendor lock; no
database credentials in the browser bundle. *Harder:* we operate it, and one
early policy (`CREATE POLICY "Allow all write" ... USING (true)`) meant anyone
reaching PostgREST could rewrite the catalogue (B-11).

## D-003 — Stripe Checkout by redirect, not embedded

**Decision.** Create a session server-side and redirect.

**Consequences.** *Easier:* card data never touches our servers; PCI scope
collapses. *Harder:* the customer leaves the site, so the **return** path is a
first-class case — and forgetting it was B-2, where a customer who had paid came
back to a checkout form with a full basket.

## D-004 — Constraints belong in the database

**Decision.** Where a rule can be a constraint, it is one: a status `CHECK`,
non-negative money, `UNIQUE(order_id, product_slug)`, and a foreign key from
reviews to orders.

**Consequences.** "Every review is backed by a real order" is structural rather
than a promise a later edit can forget. **Sharp edge:** a `CHECK` evaluates to
*unknown* on `NULL` and therefore passes — every one needs a `NOT NULL` beside it.

## D-005 — An unmapped email action sends nothing

**Context.** `buildEmailHTML` ended `statusMap[action] || statusMap.confirmation`.

**Decision.** Templates come from one `TEMPLATES` map; an unmapped action sends
**nothing**, and the statuses that stay silent are listed with a reason each.

**Consequences.** The old fallback looked defensive and was the opposite — it
guaranteed *something* was sent, so refunding a customer emailed them "Order
Confirmed! We're preparing your items now" (B-5). A fallback that cannot be
wrong beats a fallback that is always something.

## D-006 — The engraved name gets its own column

**Decision.** Personalisation is a column on `order_items`, not text parsed out
of `"Board (engraved: Amira)"`.

**Consequences.** Every other field the workshop needs was structured; the one
thing cut irreversibly into wood was not. Now it is.

## D-007 — Rate limiting in the database, not in memory

**Context.** The login throttle kept buckets in process memory.

**Decision.** Persist attempts (migration `0006_login_attempts.sql`).

**Consequences.** With eight deploys in one day, an attacker never had to outlast
"5 attempts per 15 minutes" — only to still be running when someone shipped
(B-12). The weakness was invisible from the configuration.

## D-008 — Playwright as a hard CI gate, added only once green

**Decision.** Run the browser suite in Forgejo CI across 3 viewports, and harden
lint from `|| true` to a real gate in the same change that reached zero problems.

**Consequences.** A gate that is red on arrival is a gate people learn to ignore
— this repo already had a dead Vercel check failing on every push, which trained
everyone to scroll past red. The suite was run locally first specifically to
confirm it would not be red for environmental reasons.

## D-009 — Build stamp from `date`, not Coolify's `SOURCE_COMMIT`

**Context.** A git-backed build needs a `DEPLOYMENT_ID`; Coolify offers
`SOURCE_COMMIT` for exactly this.

**Alternatives.**

| Option | Verdict |
|---|---|
| `SOURCE_COMMIT` (Coolify built-in) | Rejected — `verify-deploy.mjs` matches `/dpl=(\d+)/` and orders ids numerically, so a hex SHA does not parse; and Coolify's docs warn it invalidates the layer cache every commit |
| Require the arg, fail the build without it | Rejected — makes the git path unusable |
| **`${DEPLOYMENT_ID:-$(date -u +%Y%m%d%H%M%S)}`** | ✅ Picked |

**Consequences.** Numeric, monotonic, generated inside the build layer — so it
changes when the source changes and not otherwise, keeping layer caching that the
obvious option would have destroyed. Verified both directions on cx53.

## D-010 — A dedicated deploy key, not the existing server SSH key

**Decision.** A fresh read-only ed25519 key scoped to this repository, rather
than reusing the key Coolify already holds for the server.

**Consequences.** "Coolify can reach the Hetzner box" and "Coolify can read this
source" stay independent questions that can fail and rotate separately.

## D-011 — Merge the pivot branch last, not first

**Context.** PR #1 (pivot → main) with PR #2 (remediation) stacked on it.

**Decision.** Merge #2 into the pivot branch first, then one merge into `main`.

**Consequences.** `main` never sits in a state carrying the pivot *without* the
fix for B-1, where a failed payment told the customer "Order Confirmed" and
emptied their basket. Nothing auto-deploys off `main` today, so the risk was
theoretical — but the property costs nothing to keep true.

## D-012 — Do not copy the service's env vars to the replacement application

**Context.** Mirroring env between two Coolify resources is two API calls, and is
what the estate's other migration scripts do.

**Decision.** Set only already-public values from the script; list the rest by
name for manual entry with **rotated** values.

**Consequences.** The container carries 67 variables; the code reads 25; 36 of
the unread ones are credentials, including `GitHub_PAT_classic` — which is
A-0b's "exposed PAT in nine containers". Mirroring would carry all of it into the
replacement. Slower, and the only version that does not migrate a compromised set.

---

## Index

| ID | Decision | Status |
|---|---|---|
| D-001 | No customer accounts | Active |
| D-002 | Self-hosted Postgres, server-side only | Active |
| D-003 | Stripe Checkout by redirect | Active |
| D-004 | Constraints in the database | Active |
| D-005 | Unmapped email action sends nothing | Active |
| D-006 | Engraved name gets its own column | Active |
| D-007 | Rate limiting in the database | Active |
| D-008 | Playwright as a hard CI gate | Active |
| D-009 | Build stamp from `date` | Active |
| D-010 | Dedicated deploy key | Active |
| D-011 | Merge pivot last | Done (2026-08-09) |
| D-012 | Do not copy env vars forward | In flight |
