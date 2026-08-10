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

## L-14 · `set -o pipefail` plus `grep -q` is a false-negative factory

Writing the deployment-correctness check, this line reported that the homepage
had no `<title>` — while, three lines later, successfully reading the build id
out of that same response:

```bash
printf '%s' "$home" | grep -qF "<title>Lebon Grace"
```

`grep -q` exits the instant it matches. `printf` is then killed by SIGPIPE and
exits non-zero, and `pipefail` takes the pipeline's status from the rightmost
non-zero command. **The match succeeding is what makes the pipeline fail.** The
bigger the input, the more reliably it happens.

The same shell tested it correctly in isolation, because the isolated version
had no `pipefail`. That is what made it confusing rather than obvious.

Use `case "$s" in *pattern*)` for string conditions in shell: no subprocess, no
pipe, cannot SIGPIPE, and faster.

## L-15 · A monitor asserting liveness will pass every correctness failure

The uptime check asserts HTTP 200, a `<title>`, and a `dpl=` build id. Every
fault found walking production on 2026-08-09 satisfied all three: the stale
deploy, the dead Clearance link, the soft 404. **The monitor was green for the
entire period the shop was wrong.**

`verify-deploy.mjs` shares the flaw from the other end — it asserts
`status < 400`, so a soft 404 (B-13) was invisible to the tool built to detect
bad deploys, *by construction*.

> "Is it up?" and "is it serving what we shipped?" are different questions, and
> a check that answers the first tells you nothing about the second.

Two corollaries, both learned by shipping them wrong first:

- **Every absence assertion needs its precondition** (L-2 again). "A bogus slug
  404s" also passes on a shop that 404s everything, so it is paired with "a
  known product returns 200".
- **Test a monitor in both directions before trusting it.** All four assertions
  here were forced to fail — wrong expected build, build id moved backwards,
  host unresolvable — because a monitor that cannot fail is decoration. Two of
  them were still wrong on the first attempt and alerted confidently about a
  perfectly healthy shop.

## L-16 · A pipeline that has never run is indistinguishable from one that passes

`.forgejo/workflows/ci.yml` was committed, hardened twice, and named in four
documents as this project's quality gate. It had **never executed once** — the
repository did not exist in Forgejo, so nothing was listening.

Nothing reported that, and nothing could have. A pipeline that never runs
produces no failures. Neither does a healthy one. **The two are identical from
the outside**, which is the same shape as L-15: a liveness check passing on a
shop that sells nothing.

So a gate does not become trustworthy by being green. It becomes trustworthy by
being **seen going red for a real defect, then green when the defect is
removed** — in that order. A deliberately failing test was pushed for exactly
this, and the run was checked for failing *at the right step*: a pipeline that
dies at `npm ci` is red without telling you anything about your gate.

It repaid the effort immediately. Its first full run found two genuine defects
(L-17, L-18) that every existing check had been passing for months.

**Corollary — watch for the silence, not the failure.** A red run is loud and
someone is looking at it. A gate that has quietly stopped being connected is
silent. `lebon-grace-ci-freshness` therefore asserts the gate is still
*connected* — repo present, runner online, mirror fresh, nothing stuck — and
deliberately does not care whether the last run passed.

## L-17 · A mock can hide a failure that only the real thing has

201 unit tests were green the entire time `next build` was broken.

`src/lib/email.ts` did `const resend = new Resend(process.env.RESEND_API_KEY)`
at module scope, which throws when the key is absent. Next evaluates every route
module during the build to collect its config, so an absent environment variable
became a **build** failure rather than a send failure — and the build therefore
depended on production secrets.

`email.test.ts` mocks `resend`. A mock is registered before resolution, so the
real constructor never ran in the suite. The defect lived precisely in the gap
between *"unit tests pass"* and *"it builds"*, and nothing occupied that gap
because the only build that ever ran was the Docker one, which passes
placeholders.

> If your test replaces the thing that would have failed, it is not testing
> that thing.

`module-import-safety.test.ts` deliberately mocks nothing and imports the real
route modules with **no environment at all** — the state a fresh runner is in.
Note that *absent* and *placeholder* are different, and only one of them had
ever been tested.

**And do not fix it by feeding CI placeholders.** The trap was already written
down in FOR-EVARISTE — "builds need placeholder env values" — and had been
faithfully forgotten in every new build context since. A workaround that must be
remembered is a defect with homework attached. Construct SDK clients lazily and
the advice becomes unnecessary.

## L-18 · If it imports from outside the repository, the repository is not the unit of truth

`playwright.config.ts` imported `../ops/qa/playwright.base.config` — a path
*outside* this repo, into a sibling directory that exists only on the operator's
workstation.

On that one machine it resolves. A clone does not. So the entire E2E suite — 216
tests across three viewports, the thing D-008 calls a hard gate — had never been
runnable anywhere but one laptop, and CI died with `Cannot find module` the
first time it got that far.

It survived because **no project in this estate had ever run Playwright in CI**.
The only green pipeline, vouchnexus's, is typecheck + unit. Five projects share
the same out-of-tree import and not one of them would survive a clone.

> A green suite on the author's machine says the author's machine works.

Vendoring buys portability and costs the risk of silent divergence, so pay the
difference explicitly: `qa-kit-drift.test.ts` compares the vendored copy to the
shared one byte-for-byte **when the shared one is reachable**, and *skips* when
it is not — absent is correct in CI, and failing there would make every run red
for a condition that is right.

**Three knock-on effects, each found by the next red run**, which is the real
argument for having the gate at all:

1. `tsconfig.json` type-checks `**/*.ts` under `strict`; the vendored kit is
   deliberately untyped, so it had to be excluded — which is why the
   `tsconfig.e2e.json` split existed in the first place.
2. eslint then linted it and found three `no-explicit-any`. Ignored rather than
   fixed: a local fix would return as drift. Corrections go upstream.
3. `npm run typecheck:e2e` — the very thing covering the excluded files — **was
   never invoked by anything**. Written, never run, exactly like the workflow.

## L-19 · Run the whole gate locally before asking CI three times

Three consecutive CI rounds each failed at a later step: build, then Playwright
resolution, then lint. Each round cost six minutes and told me one thing I could
have learned in ninety seconds.

The suite was being run selectively — `vitest`, `tsc`, `playwright --list` — and
each time the *unrun* step was the one that failed. Running every step the
workflow runs, in order, found the remaining failure immediately.

**Flakes are not defects, and must not be reported as such.** Six of 216
Playwright tests failed locally under default parallelism; all six passed at
`--workers=1`. Re-running before drawing a conclusion is what separates "the
mobile checkout is broken" from "the local server was overloaded". The shared
kit already sets `workers: 2, retries: 2` under CI and `retries: 0` locally —
deliberately, so flakes surface to the person who caused them rather than being
retried into silence.

## L-20 · A credential that gets weaker the less you type

The phone half of the guest-order credential compared `ca.endsWith(cb.slice(-8))`.
`slice(-8)` of a short string is the whole string, so **the less an attacker
typed, the more it matched**. One digit matched any number ending in that digit.

The rate limit did not save it. Ten attempts an hour was sized for guessing a
whole phone number; there are only ten single digits.

> Any comparison whose strictness depends on the *length of the input* is
> controlled by the attacker. Fix the window, and refuse to compare below it.

Two corollaries, both paid for here:

- **Extract it to test it.** This lived as two private functions in `store.ts`
  with no way to reach them without a database, which is why it survived. The
  extraction immediately caught a second flaw in the *fix* — measuring length
  after `^0 → 971` lets a seven-digit entry pass as nine, because the
  substitution adds digits.
- **A stricter credential locks people out.** There are no accounts and no
  password reset, so `/account` is the only route back to an order. The window
  is eight digits, not the nine a UAE mobile has, because a UAE landline has
  eight — and Dubai is full of expatriate foreign numbers. Before shipping it,
  the database was queried for stored phones that the new rule would orphan:
  one order, twelve digits, none.

## L-21 · Clicking before hydration is a silent no-op, and reads as a broken page

Twice during the returning-customer walkthrough `/account` looked broken: fill
the form, click, nothing happens, no request. Both times the page was fine.

A click that lands before React has attached to the server-rendered markup does
nothing at all — no handler, no request, no error. A human cannot hit that
window, because filling two fields takes seconds. **A test hits it every time.**

> "Nothing happened" has two causes — the feature is broken, or you got there
> before it was listening. They are indistinguishable from the outside.

Wait for the app to settle before interacting, and assert on the **request**
rather than a timeout: waiting for `/api/orders` makes the absence assertion
that follows meaningful, where a fixed sleep would let a form that never
submitted pass as "nothing was disclosed" (L-2 again).

The same investigation was derailed a third time by targeting inputs by type:
the header search box is also a text input and the WhatsApp float is another
`tel` input. That is L-12 for the third time this engagement, and the fix is the
same each time — give the page test ids and stop guessing at its DOM.

---

## L-22 · A comment asserting that something works is not evidence that it does

`stripe-webhook/route.ts` carried the line *"console.error so it reaches
GlitchTip, not console.log"*. It was written deliberately, by someone reasoning
correctly about which log level to choose — and it was false, because
`captureConsoleIntegration` is opt-in and had never been configured. A
`console.error` was a breadcrumb, not an event.

That comment then did active harm. It was read three times across this
engagement, by me, as confirmation that the B-18 alert path was covered. Each
reading skipped the check. **The claim was believed precisely because someone
had bothered to explain their reasoning** — the more considered a comment looks,
the less likely anyone is to verify it.

The same shape as the CI pipeline that had never run (L-16) and the backup that
never covered this database: **a mechanism that produces no output is
indistinguishable from a healthy one, and documentation about it is not
evidence.** Neither is a passing test suite, if what you changed is the
configuration that decides whether the code under test reports anything.

The check that would have caught it takes a minute: does the SDK actually route
`console.error` anywhere by default? The answer was in the first paragraph of
Sentry's own docs for the integration.

**Corollary for this repo.** The three claims of the form "X is loud" now have a
test each. Where an assertion cannot be tested — "the operator will get this
e-mail" — it is written in OPERATIONS.md as a table of what is and is not
alerted, so the gaps are visible rather than implied.

---

## L-23 · Two ways the same test run lied in ten minutes

Running the local gate for B-29, the E2E suite reported **24 failures**, all in
the `mobile-android` project: every static page — `/about`, `/terms`,
`/privacy` — "renders without defects" failing at once. Nothing in the change
touched rendering.

**Neither problem was in the application.**

**1. `next build` deletes `.next/standalone` out from under a running suite.**
The suite serves the app through `scripts/serve-standalone.mjs`. I started a
build in another shell while it was running; the build wiped the directory, the
web server died, and every test after that point failed. The 192 that passed ran
*before* the collision. The failure lands on whichever project happens to be
running when it happens, which is why it read as "mobile is broken" rather than
"the server is gone" — and the first build also failed, with `EBUSY: resource
busy`, which was the actual signal and easy to skim past.

**Never run a build while the E2E suite is running.** They share `.next`.

**2. `cmd | tail` reported exit code 0 on a failing run.** Without
`set -o pipefail` a pipeline exits with the status of the *last* command, so
`playwright test | tail -20` is always 0. The harness dutifully said "completed
(exit code 0)" above a report containing 24 failures.

That is the same family as the pipefail trap already recorded for
`ci-freshness.sh` — there, pipefail turned a success into a false failure; here,
its absence turned a failure into a false success. **Any pipeline whose exit
code you intend to trust needs `set -o pipefail`, and any pipeline that ends in
`grep -q` or `head` needs it off.** Decide which you are doing before writing
the pipe.

---

## L-24 · Verifying a deploy means exercising it, not inspecting it

The B-29 deploy passed every check this project had: build id moved,
`deploy-verify.sh` OK, `ci-freshness.sh` OK, every surface returned its correct
status, and the new code was confirmed *present in the image by grep*.

It was still broken. Two separate faults — the sending domain unverified (B-30)
and Sentry's init chunk dropped from the standalone output (B-31) — and **not
one of those checks could have found either.**

What found them was posting a real review to production and then asking a
question the checks do not ask: *did the thing that was supposed to happen,
happen?* The answer came from Resend's own API — the newest email on the account
was two hours old, and none of the last fifty was from this shop.

**Presence is not behaviour.** Grepping the image proved the code shipped, and
the code did run — it just reported success for a refusal. An artefact check can
only ever tell you the right bytes are on disk.

Two corollaries this cost real time to learn:

- **A library's error convention is part of its contract, and worth thirty
  seconds.** `Resend.emails.send` resolves `{data, error}`. Every path here was
  written for throw-on-error. The installed `.d.ts` said otherwise the whole
  time.
- **A mock encodes a belief about the library.** `send` was mocked as resolving
  `{ id: "e1" }`, so no test *could* express a rejection. When a mock's shape
  is wrong, the tests built on it are not weak — they are aimed at a library
  that does not exist.

**And an absence check needs proof it could have been present (L-2), including
when it is a log.** "No `[operator-notice]` error in the container logs" was
offered as evidence the send worked. The logs contained nothing at all — not one
request line — so that check could not have failed. It was recognised as
worthless only after Resend's API contradicted it.

---

## L-25 · The first fix passed every check and did nothing

Fixing B-31 meant getting `Sentry.init` into the standalone output. The first
attempt copied the missing chunk. Afterwards:

- the chunk was in `.next/standalone` — **checked**;
- `CaptureConsole` was greppable in the output — **checked**;
- the build succeeded, tests passed, the guard I had written passed.

It sent **nothing**. `.next/server/instrumentation.js` — the file Next loads to
call `register()` — was also missing, so the chunk sat in the image with nothing
importing it. Every check I had written was a check on *the thing I had done*,
not on *the outcome I wanted*.

The only reason it did not ship is that the outcome was testable: run the
standalone server against a fake Sentry ingest and count envelopes. Zero before,
one after. That check does not care which file was missing or why.

**Write the assertion against the outcome, not the mechanism.** "The chunk is
present" is a statement about my patch. "An event reaches the ingest" is a
statement about the system, and it stays true through refactors, version bumps
and whatever Next changes about tracing next.

The corollary bit twice in one session: when a fix is about a *reporting*
mechanism, static checks are especially weak, because the failure mode of
reporting is silence and silence is what a passing static check also looks like.
B-30 was the same shape (a send that returned true), and so was B-29 (a
console.error that went nowhere). Three in a row, all found by asking "did the
thing that was supposed to happen, happen?" rather than "is the code right?".

---

## L-26 · A runtime proof that doesn't reproduce production isn't a proof

L-25 says to assert against the outcome, not the mechanism. This is the sequel,
and it cost an 11-minute outage.

The B-31 fix *was* checked behaviourally — a fake Sentry ingest, the real
standalone server, an envelope counted. Zero before, one after. That is the
right shape of test, and it still passed on a build that crashes at boot in the
container.

`node .next/standalone/server.js` was run **from the project root**, where the
full `node_modules` sits one directory up. Node resolved the external the copied
chunk needed. The container ships only the *pruned* standalone `node_modules`,
where that module does not exist — so production got
`Cannot find module 'require-in-the-middle-…'` and no server at all.

**The environment is part of the test.** For anything that ships as a container,
"it works locally" and "it works in the artefact" are different claims, and the
gap between them is precisely the pruning, path layout and env that make
containers reproducible. The proof should have run `docker run` against the
built image — the same image that would be deployed.

Two smaller things this also taught:

- **A build that silently omits something can be safe; a build that half-omits
  it is not.** The missing instrumentation was invisible for months and harmed
  nothing but observability. Supplying *part* of it — the chunk without its
  dependencies — converted a silent gap into a hard crash. When you cannot ship
  all of a subgraph, ship none of it.
- **Tag a rollback before recreating, always.** `lebon-grace:rollback-b31`
  existed because P-005 says to make one, and it turned an outage into an
  11-minute one instead of a rebuild-under-pressure.

---

## L-27 · Compare against a known-good configuration before theorising

B-31 took three attempts. The first two blamed `output: "standalone"` and
Turbopack file tracing, and produced an elaborate, entirely wrong story —
complete with chunk-count tables — that survived because every measurement I
took was *consistent* with it. 19 of 40 chunks copied, `instrumentation.js`
missing from standalone, `@sentry` absent from the pruned `node_modules`: all
true, all irrelevant.

The step that ended it took two minutes: **run the same test against
`next start`.** It sent zero envelopes too. Standalone was not the variable.

I had never checked whether the thing worked in *any* configuration before
explaining why it failed in one. Every fact I gathered was about the failing
setup, so nothing could contradict the theory — I was measuring inside the
hypothesis.

**Before explaining why X fails under condition C, check whether X works
without C.** If it fails both ways, C was never the cause and every hour spent
on C is wasted. It is the cheapest possible experiment and it goes first.

The second half of the same lesson: when a hypothesis needs a *mechanism* to
explain it — tracing, pruning, bundler internals — that complexity is itself
evidence against it. The actual cause was a file in the wrong folder.
