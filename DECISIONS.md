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

## D-008 — Playwright as a CI gate, added only once green

> **Correction, 2026-08-09.** This said "CI gate" when there was no CI: the
> workflow was written but had never run — see D-013. **Resolved the same day**
> by D-014; the gate now executes on every mirror sync. The reasoning below
> about not shipping a red gate always stood; only the enforcement was missing.

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

## D-013 — Keep GitHub; the question was wrong, and the answer is that there is no CI

**Context.** The question asked was "why do we still need GitHub when we have
Forgejo?" Investigating it found something more important than the answer.

**What is actually true**, verified on the box rather than assumed:

| Claim | Reality |
|---|---|
| Forgejo runs this project's CI | **False.** lebon-grace is in *neither* Forgejo instance. Their repos are mirrortales, ci-pilot, axiom-synapse, ops-toolkit, vouchnexus, eliania-house, company-os-business. |
| The act_runner has run our pipeline | **False.** Zero mentions of "lebon" in its logs. |
| GitHub Actions is halted for this repo | **Misleading.** There is no `.github/workflows` directory and zero run history — it was never configured here. |
| Something enforces the gates | **False.** No git hooks, no husky, no lint-staged. PRs report no checks. |

So `.forgejo/workflows/ci.yml` — typecheck, lockfile gate, unit, lint, build,
Playwright across three viewports — **has never executed**. Every gate this
project relies on is run by hand.

I had repeated the "CI lives in Forgejo" premise throughout this engagement,
including when hardening lint from `|| true` and when adding the lockfile gate.
Those changes are still right; the enforcement they claimed does not exist.
D-008 and the README have been corrected.

**Decision. Keep GitHub.** Not because it beats Forgejo, but because Forgejo
currently gives this project *nothing*, while GitHub is:

1. the **only copy of the code that is not on cx53** — the same box that runs
   the shop and its database;
2. the review surface (PRs #1–#3 and the `gh` tooling used throughout);
3. the target of the read-only deploy key the git-backed Coolify application
   uses to clone.

Dropping it would remove the off-box copy and break the deploy path, to gain
nothing.

**Alternatives considered.**

| Option | Verdict |
|---|---|
| Consolidate onto self-hosted Forgejo | Rejected. Puts source, CI, app and database on one machine, and Forgejo hosts nothing for this project today. |
| **Keep GitHub for hosting + review** | ✅ Picked |
| Mirror to Forgejo as a second copy | Reasonable later; it is a second copy *on the same box*, so it adds little against the risk that matters. |

**Consequences.** *Easier:* nothing changes; the deploy key and PR flow keep
working. *Harder:* the real gap is untouched — this project still has no
automated CI, so quality depends on someone remembering to run five commands.

**The follow-up this actually generated**, and it is worth more than the ADR:
get CI running. OpenAI argued for GitHub Actions and against running it on cx53,
because `next build` and Playwright are memory-hungry and that box already runs
~128 containers plus this shop — persuasive, with the caveat that Actions has a
billing history here ($256.70). Adding lebon-grace to the existing Forgejo is
free and the runner already exists, at the cost of contending with production
for memory. Either beats the present state of nothing.

**On backups**, since the council raised it: MiniMax argued the single-box risk
dwarfs this decision and assumed there were no off-server backups. That
assumption is **wrong** — `backup-cx53.timer` runs a nightly restic backup to
Cloudflare R2 with 14/8/36 retention and `restic check --read-data-subset=2%`.
Whether it covers this project's Postgres volume is **not verified**: the paths
are discovered dynamically and the script names no database explicitly. Worth
confirming, and not a reason to change this decision.

**Revisit if** GitHub starts charging for what is used here, if lebon-grace is
added to Forgejo and CI actually runs there, or if a second person joins and the
review surface has to change.

---

## D-014 — Run CI on Forgejo, fed by a pull mirror of the public GitHub repo

**Context.** D-013 established that `.forgejo/workflows/ci.yml` had never
executed. Asked to close that gap using Forgejo.

**The obstacle.** The Forgejo instance on cx53 is genuinely private:
`ROOT_URL = http://localhost:3900/`, no published container ports, no Traefik
route. Nothing outside the box can reach it, so "just add a second git remote"
requires an SSH tunnel to be up for every push — friction that would rot.

**The question that decided the design:** does a pull-mirror sync fire `push`
workflows, or does Forgejo suppress it? The docs say workflows are not triggered
for changes "authored with this token" (the automatic Actions token) and say
nothing about mirrors. [gitea#24824] reports mirror syncs failing to trigger
when the workflow has *branch filters*, because the mirrored code path passes
`main` rather than `refs/heads/main` — and our `ci.yml` filters on
`branches: ["**"]`. [gitea#32412] complains of the opposite, that mirror syncs
*do* trigger.

Rather than trust either, this was settled **empirically on the instance
itself**: `mirrortales` is a mirror (`is_mirror=1`), and its run history shows
`trigger_event=push`, `ref=refs/heads/main` — correct prefix. The 2023 bug is
fixed in 11.0.16. Confirmed again by our own first sync.

**Decision.** `kairos/lebon-grace` in Forgejo is a **pull mirror of the public
GitHub repo**, 10-minute interval. GitHub stays the source of truth (D-013);
Forgejo is the CI host only.

**Why a mirror rather than a token-authenticated push:**

| Option | Verdict |
|---|---|
| Pull mirror of the **public** repo | **Chosen.** Needs no credential at all. |
| Pull mirror with a classic PAT | Rejected. Forgejo stores pull-mirror credentials in the remote URL, and the available classic PAT carries `repo` scope — write access to *every* repository in the account — for what is a read-only sync. |
| Read-only deploy key | Not possible: SSH auth exists for **push** mirrors only ([forgejo#4416]); pull mirrors are HTTPS + token. |
| Second remote pushed over an SSH tunnel | Rejected. Works, but every push depends on a tunnel being up. |
| Timer on cx53 fetching GitHub and pushing to Forgejo | Rejected as unnecessary once the repo proved public — more moving parts for the same result. |

**Verified by being made to fail first.** A deliberately failing test was pushed
and the pipeline went **red** — and red *for the stated reason*: `1 failed | 15
passed`, error annotation on the intended line, after checkout, the lockfile
gate, `npm ci` and `tsc` had all passed. A pipeline that has never been seen
failing is indistinguishable from one that does nothing, which is the entire
finding of D-013.

**It earned its keep within one run.** With the deliberate failure removed, the
build then failed for real: `new Resend(...)` at module scope threw during
`next build`'s page-data collection, so the build depended on production
secrets. That had survived indefinitely because the only build that ever ran was
the Docker one, which passes placeholders. Fixed by lazy construction rather
than by feeding CI placeholders — see the commit; the workaround was already
written down in FOR-EVARISTE and had been forgotten in exactly the way written-
down workarounds are.

**Detecting the gate dying silently.** A third systemd timer,
`lebon-grace-ci-freshness`, every 30 minutes: repo exists and has run at least
once, a runner is online, the mirror is not stale, nothing is stuck. It
deliberately does not check whether the last run *passed* — a red run is loud.
The failure mode being watched for is silence, because no-failures is exactly
what a healthy pipeline looks like too.

[gitea#24824]: https://github.com/go-gitea/gitea/issues/24824
[gitea#32412]: https://github.com/go-gitea/gitea/issues/32412
[forgejo#4416]: https://codeberg.org/forgejo/forgejo/issues/4416

## D-015 — Test the payment path with synthetic signed events; do not touch Stripe

**Context.** The operator walkthrough called for end-to-end Stripe testing —
payments, payouts, refunds, cancellations. This shop runs on **live keys**, and
a real `cs_live_` Checkout Session was already created by accident earlier in
this engagement while testing a server-side guard.

**Decision.** Exercise the webhook by mocking `constructEvent` and feeding it
synthetic events. Nothing in the test suite reaches Stripe, in any mode.

**Why this is not a compromise.** The webhook's whole job is to react to events.
Mocking the signature-verification boundary and driving the handler directly
tests *everything the shop actually owns*: which events are acted on, the order
written, idempotency against retries, the emails sent, and the refusal of an
unsigned request. What it cannot test is Stripe's own behaviour — which is not
this project's to verify.

It also found a real defect that way: **B-28**, a refund in the Stripe dashboard
never reaching the shop.

**What was checked, and deliberately not built.** Three event families looked
like gaps and are not, verified against how the shop is wired rather than
assumed:

| Event | Why no handler |
|---|---|
| `checkout.session.expired` | The order row is created **only** in the completed branch, so an abandoned checkout left nothing to update. Cart recovery is driven from the browser via `CartRecoveryBanner`, not from Stripe. |
| `payment_intent.canceled` | `mode: "payment"` with no `capture_method` means automatic capture, so a cancelled PaymentIntent never succeeded and has no order. **If manual capture is ever introduced this stops being true** — the route comment names that cause, not the effect. |
| `payout.*` | Stripe moving money to a bank. Says nothing about any order, and an order's state must never depend on it. |

So the only order-affecting events are `checkout.session.completed` and
`charge.refunded`, and both are handled. "No handler" and "we decided not to
handle it" look identical in code, so the decision is pinned by tests asserting
each ignored event mutates nothing — with a precondition test proving the same
harness *does* act on a handled event, so the block cannot pass on a webhook
that ignores everything.

**What this does not cover.** A genuine payment through Stripe Checkout, and a
real refund arriving over the network. Those need test-mode credentials; they
are worth doing once before the shop takes real volume, and they verify the
wiring between Stripe and this endpoint rather than the endpoint itself.

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
| D-013 | Keep GitHub; there is no CI | Superseded in part by D-014 |
| D-014 | CI on Forgejo via a pull mirror | Active |
| D-015 | Synthetic Stripe events; never touch Stripe | Active |
