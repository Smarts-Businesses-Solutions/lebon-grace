# Lebon Grace — Progress Tracker

**Single source of truth for narrative. Git is ground truth for code.**
**Last Updated:** 2026-08-09 — remediation merged to `main`; 12 bugs fixed; QA protocol implemented; Coolify git-registration in flight

---

## Session 2026-08-09 — remediation, QA protocol, deploy, git registration

**Shipped (commit SHAs on `main`):**

- `0bd33c6` — lint 54 → 0, and the two real bugs hiding behind the warnings
- `53942ab` — MASTER-QA-PROTOCOL gap-analysed against this project
- `b0ebfce` — Playwright wired into `.forgejo/workflows/ci.yml` as a release gate
- `b4e288d` — Module C: the money path in a browser (12 specs)
- `84d135b` — Module E: failure modes (8 specs); **fixed B-1**, a failed payment claiming success
- `37c316c` — mobile viewports (7 specs); fixed a 27px tap target on the money path
- `850556c` — QA §5.1 artifacts, generated where derivable (`npm run qa:report`)
- `7fc2087` — axe-core over the rendered DOM; 51 failing nodes fixed
- `05987d0` — removed the footer link to the hidden clearance category
- `20a0a84` — `DEPLOYMENT_ID` defaults to a UTC stamp so a git build still emits `?dpl=`
- `2cc4a02` — git-backed Coolify application created; blocked upstream
- `9d434f9` — `docs/QA/ACTORS.md`, the actor model
- `bf7c695` — **merge to `main`** (PR #1 + PR #2). `main` is current for the first time this engagement.

**Deployed.** Built on cx53 with `DEPLOYMENT_ID=20260809094044`; `verify:deploy`
confirmed the live site is serving that build. Rollback image tagged
`lebon-grace:rollback-20260809`.

**12 bugs fixed**, each with a regression test verified to fail without its fix
— full write-ups in `docs/QA/BUGS.md`. The two worst: a failed payment told the
customer "Order Confirmed" and emptied their basket while nothing was charged
(B-1); and order lookup accepted `?id=*`, which PostgREST aliases to `%`,
matching the entire orders table (B-3).

**Not finished, and why:**

- **Coolify git registration** — application `m11i6a5ekwhbflhnfb9ipr48` exists and
  is configured, but Coolify will not attach a deploy key over its API (accepts
  `private_key_uuid`, returns 201, stores nothing; `PATCH` rejects the field).
  One click in the UI finishes it. See `docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md`.
- **Secret rotation** — live Stripe keys, the Supabase service-role key, several
  PATs and one RSA private key were printed into session output. All need
  rotating. Operator action.
- **A-16 clearance recount** — listing and footer link removed; the recount needs
  179 photographs that are not in the repo.

## Earlier — the pivot (PR #1, merged 2026-08-09)

Dropship catalogue → made-to-order laser-cut workshop. Editorial redesign,
catalogue regenerated from Postgres, MDF range imported then retired from the
shop, product dimensions read off photographs, age and small-parts warnings,
accessibility pass, and the move off Vercel/Hostinger onto the Hetzner estate.

---

## In flight

| Item | State | Blocker |
|---|---|---|
| Coolify service → git application | app created, cannot deploy | one UI click (upstream API bug) |
| Env surface 67 → 25 vars | documented | happens during the cut-over |
| Secret rotation | listed | operator |

## Paused

| Item | Why |
|---|---|
| Arabic / RTL | Deliberate — until the site is stable. `docs/DECISION-ARABIC-RTL.md` |
| A-16 clearance recount | Needs the photographs |
| A-23 / A-25 Tier 1 | Needs one answer: is Lebon Grace a UAE-registered supplier? |

## Cancelled

| Item | Why |
|---|---|
| Vercel deployment | Account blocked; the estate is self-hosted |
| PostHog | Purged (A-19b); Umami is the analytics |
| Dropship catalogue + routes | Superseded by the workshop pivot |
