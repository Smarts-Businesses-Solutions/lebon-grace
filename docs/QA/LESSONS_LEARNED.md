# Lessons learned

MASTER-QA-PROTOCOL §8. Not a list of bugs — `BUGS.md` has those. These are the
patterns that produced them, and the habits that catch them.

Several are recorded against **my own mistakes during this engagement**, because
a lesson learned from someone else's error is a lesson you have read, not one you
have learned.

---

## L-1 · A test that passes without the fix is decoration

The single most useful habit here. Every guard added during this work was
verified by **removing it and watching its own test fail**:

- the order-id wildcard guard → tests returned a live order object for `*` and `a`
- both webhook idempotency layers → each failed only its own test, independently
- the checkout failure fix → exactly the two tests asserting it, and no others
- the delivery persistence fix → `Expected "20", Received "Free"` — the literal
  customer-facing symptom
- the WhatsApp float position → *"it will eat the tap"*

Without that step you have not tested the fix. You have tested that the suite
runs.

## L-2 · Assert the precondition, or you are asserting nothing

**This caught me twice.**

Proving the CI gate could detect a broken asset, I patched the string `<main` —
which does not appear in that file. Nothing was injected, 14 tests passed, and it
read as *the gate is decorative*. It proved nothing. Re-run asserting both that
the defect was in the source **and** in `.next/server/app/about.html`, the
failure appeared instantly.

Later, checking whether anything called `/api/import`, I found "0 hits" in the
container logs — then found the logs contain **zero request lines of any kind**.
The reading could not have been informative either way.

> Any assertion of the form "X is absent" needs a paired assertion proving X
> could have been present.

The mobile overlap tests are written this way: both elements must render before
"they do not overlap" means anything.

## L-3 · Measure it now; do not remember it

The engagement's worst error: a Critical "split-brain deployment" finding,
ranked the only P0, derived from a `dpl=` value **remembered from three days
earlier** and printed as though freshly measured. It was stale. Every conclusion
downstream of it was wrong, and it had to be retracted.

Two smaller instances of the same shape: grepping HTML for a font name that only
ever exists in generated CSS, and grepping a client-rendered page for content
that arrives after hydration. Both returned zero. Both zeros meant nothing.

## L-4 · Search the whole repository, not just `src/`

Twice, findings were wrong because they had only looked at `src/`:

- "`playwright` is imported in zero files" — four scripts `require()` it.
- "eight order statuses" — the admin dropdown has ten; a CHECK constraint built
  from the eight would have rejected statuses the admin sets from a `<select>`,
  turning a hardening change into an outage.

## L-5 · A gate that is red on arrival is a gate people learn to ignore

Lint shipped as `|| true` because 51 pre-existing problems would have made CI red
from its first run — deliberately, and documented. The same repository already
had a dead **Vercel** check failing on every push with "Account is blocked",
which trained everyone to scroll past red.

The corollary: **harden it the moment it is clean.** `src/` reached zero, so the
`|| true` came off in the same change.

Before wiring the E2E suite in, it was run locally first specifically to check it
would not be red on arrival for environmental reasons — the guards hard-fail on
any failed request, and `/account` calling an API without Supabase credentials in
CI would have gone red for reasons that were not defects.

## L-6 · Silence is a valid output, but it has to be deliberate

`statusMap[action] || statusMap.confirmation` looked like defensive coding and
was the opposite: it guaranteed *something* was sent, so an unmapped status sent
the wrong thing. Refunded customers were told their order was confirmed.

The replacement sends **nothing** for an action with no template, and the four
statuses that deliberately stay silent are listed with a reason each. A fallback
that cannot be wrong beats a fallback that is always something.

## L-7 · Generated beats hand-maintained

`tests/fixtures/sitemap.json` — the protocol's own "living inventory" — had
drifted two routes behind the app, broken by work done earlier in this same
engagement. Nobody noticed, because nothing checked.

So the derivable QA artifacts are generated from the codebase and a real test
run (`npm run qa:report`), and `scripts/verify-migrations.sh` proves the
migration set still reproduces production rather than assuming it.

## L-8 · Fix the layer that makes the failure impossible

Where a constraint could move into the database, it did: a status CHECK, non-negative
money, `UNIQUE(order_id, product_slug)`, and a **foreign key** making "every
review is backed by a real order" structural rather than a promise a later edit
can forget.

Same reasoning one level up: the engraved name got its own column instead of
being parsed out of `"Board (engraved: Amira)"`. Every other field the workshop
needs was structured; the one thing cut irreversibly into wood was not.

## L-9 · Some defects only exist between the layers

The strongest argument for the browser suites. Two bugs where **every unit was
individually correct**:

- the cart persisted and the toggle worked, but the delivery choice did not
  survive a page load
- clearing and restoring the cart were both right, but effects run
  child-before-parent, so they raced

Neither is reachable by a unit test, because neither lives inside a unit.

## L-10 · When two authorities disagree, say so rather than pick quietly

The QA kit calls Edge-only "non-negotiable"; `CLAUDE.md` supersedes it in favour
of Chrome, noting the Edge rule "was mitigating the wrong risk". Resolved for
this project with a documented override, flagged as **still open estate-wide**,
and not silently changed in shared tooling that fourteen other projects consume.

## L-11 · Read the header before trusting the tool

A-5 named `build-apps.sh` as the place to add deploy verification. That script's
own header says it does not target the estate, and `PROJECT-CONTEXT.md` records
that this app deploys via Coolify with no deploy script at all. Fixing only what
the task named would have produced a verification that never ran against
production.

## L-12 · A probe that assumes DOM structure invents its own bugs

Added 2026-08-09, from the anonymous-visitor walkthrough. Three of the findings
raised during it were **my own tooling**, not the app:

- `/track` "gave no clear message". The page has three visible inputs; the
  first is the header **search box**. Filling inputs 0 and 1 filled search and
  the order id, leaving the phone blank. Reading the form first — placeholders
  `Search puzzles`, `e.g. abc12345`, `+971 5X XXX XXXX` — showed the refusal
  works exactly as intended.
- A cart "money mismatch". The label and the amount are on separate lines, so a
  single-line regex read `subtotal=null` and reported arithmetic that was in
  fact correct at every step, including the AED 150 boundary.
- "The B-1 fix is not deployed", inferred from commit timestamps. The live image
  had been built from a **working tree**, so it contained changes committed
  hours later. No commit identified what was live.

The shape is identical each time: **asserting against assumed structure instead
of reading it.** L-2 says pair every "X is absent" with proof X could have been
present; this is its sibling — pair every "the app did Y" with proof you drove
the app, not something adjacent to it.

The habit that caught all three was the same: when a result is surprising, dump
the raw evidence — the form's actual inputs, the raw text, the served bundle —
before writing it down as a defect.

## L-13 · Correct behaviour resting on an undocumented property is not correct

`clientIp()` bucketed rate limits on the leftmost, attacker-controlled entry of
`X-Forwarded-For` (B-15). Every public limiter should have been bypassable with
one header. It was not, because Traefik overwrites the header before the app
sees it.

Two things follow. First, the code was wrong and the deployment happened to
save it — a `forwardedHeaders.trustedIPs` change would have removed the
guarantee silently, with no code change and no test failure. Second, the file
credited a *different* mitigation entirely: "the container binds to loopback and
is only reachable through the tunnel", describing a Caddy/SSH deployment that
had already been decommissioned.

> A comment explaining why something unsafe is safe is a liability once the
> architecture it describes is gone. Either the app enforces the property
> itself, or the comment names the exact external setting it depends on.
