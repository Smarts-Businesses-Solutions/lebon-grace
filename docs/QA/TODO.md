# QA TODO

MASTER-QA-PROTOCOL §9.

**This file deliberately does not restate the work.** `ACTION_PLAN.md` is the
tracker for this project — 26 items, each with its status, evidence and
corrections. Copying it here would create a second list that disagrees with the
first within a week, which is the failure this file is supposed to prevent.

What follows is the protocol's own checklist, mapped to where the work actually
lives.

| §9 item | Status | Where |
|---|---|---|
| discovery / system map | ✅ | `docs/QA/SYSTEM_MAP.md` — generated |
| inventory generation | ✅ | `docs/QA/COVERAGE_INVENTORY.md` — generated · `tests/fixtures/USER_ACTIONS_INVENTORY.md` — hand-kept |
| auth suite | ➖ n/a + ✅ | no customer accounts exist; the admin throttle is covered end-to-end (A-21) |
| navigation crawl | ✅ | `tests/e2e/navigation/smoke.spec.ts`, 14 routes × 3 viewports |
| user action suites | ✅ | `tests/e2e/money-path/` — Module C |
| failure mode suites | ✅ | `tests/e2e/failure-modes/` — Module E |
| security baseline | ✅ | authorization boundaries, IDOR (found one), rate limiting — see `BUGS.md` B-3, B-11, B-12 |
| CI/CD integration | ✅ **running** (since 2026-08-09) | `.forgejo/workflows/ci.yml` — lockfile gate, typecheck, unit, lint, build, E2E × 3 viewports — executes on `kairos/lebon-grace`, a 10-minute pull mirror of GitHub on the cx53 Forgejo. Proven by pushing a deliberate failure and watching it go red, then green. Results are **not** visible on GitHub, and a push is checked within ~10 min rather than instantly. `lebon-grace-ci-freshness.timer` watches for the gate silently disconnecting. See `DECISIONS.md` D-014 (and D-013 for the 5 months it never ran). |
| production safe run | ✅ | read-only walkthrough; `npm run verify:deploy` checks the served build id |
| bug fixes + regressions | ✅ | 12 in `BUGS.md`, each with a regression test verified to fail without its fix |
| final report | ✅ | `docs/QA-PROTOCOL-GAP-ANALYSIS.md` |

## Still open

Only two QA gaps remain, and both are small:

- **Rendered-DOM accessibility sweep.** `npm run audit:contrast` checks 24
  declared colour pairs with the WCAG 2.1 arithmetic, but not the live DOM — a
  live audit was attempted and abandoned because the admin page would not
  hydrate inside the in-app browser. An `axe-core` pass in the Playwright suite
  would close it properly.
- **Three uncovered user actions**, listed at the foot of
  `tests/fixtures/USER_ACTIONS_INVENTORY.md`.

Everything else outstanding is product or operations work, tracked in
`ACTION_PLAN.md`, and the items blocking it need the operator rather than a
tester: the deploy, the exposed PAT, the clearance photos, and the UAE
registration answer.

## Regenerating

```bash
npx playwright test --reporter=json > playwright-results.json
npm run qa:report
```

`SYSTEM_MAP.md`, `COVERAGE_INVENTORY.md` and `ROUTE_COVERAGE_REPORT.md` are
generated. `BUGS.md`, `LESSONS_LEARNED.md`, this file and the user-actions
inventory are written by hand, because what broke and what it taught is
judgement rather than data.
