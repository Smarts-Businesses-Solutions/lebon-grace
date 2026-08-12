# Letting operators change their own password — the plan

## What is wrong today

There is no change-password screen. Credentials are scrypt hashes inside the
`ADMIN_USERS` environment variable, so changing one means re-running
`scripts/setup-admin-users.mjs`, writing to the server over SSH and recreating
the container.

Three consequences, in order of how much they matter:

**Only the person with SSH can change a password.** An operator who thinks their
password is compromised cannot act. They must find someone with server access.

**Both passwords change at once.** The script rebuilds `ADMIN_USERS` from
scratch, so rotating one operator forces you to re-enter the other's too.

**The credential store lies.** `supabase.local` is only written in `--generate`
mode, so after a manual run it holds passwords that no longer work while looking
authoritative.

It also blocks the thing that was originally asked for — issuing a temporary
password that the operator changes on first login.

## The tension this has to resolve, and it is real

`src/lib/admin-auth.ts` says, deliberately:

> Credentials live in the ENVIRONMENT, not the database, and that is deliberate.
> A database-backed login fails closed during a Supabase outage — locking the
> operator out of their own admin during exactly the incident they need it for.
> The auth path should not depend on the thing most likely to be broken.

That reasoning is still correct. A change-password feature needs **mutable**
storage, which the environment is not. So this cannot be built without
addressing the decision it contradicts.

**Resolution: two tiers, with different jobs.**

| | Source | Changeable | When it is used |
|---|---|---|---|
| Primary | `admin_operators` table | yes, self-service | normally |
| Break-glass | `ADMIN_USERS` env | no | only when the database is UNREACHABLE |

The property worth preserving was never "credentials live in env". It was **"a
Supabase outage must not lock the operator out."** A break-glass env credential
preserves that exactly, while day-to-day credentials become editable.

### The distinction that makes or breaks this

The fallback must fire on **"the database did not answer"**, never on **"the
database answered, and that person is not there."**

Get this wrong and every removed operator keeps a working login forever via a
stale env entry — a backdoor that no amount of admin UI would reveal. In code
terms: fall back inside `catch`, never on an empty result.

This is the single highest-risk line in the feature and deserves its own tests,
including one that proves a DELETED operator is refused while the database is up
and their env entry still exists.

## Design

### Schema — `0011_admin_operators.sql`

```
email                 text primary key
salt                  text not null
password_hash         text not null
token_version         integer not null default 1
must_change_password  boolean not null default false
disabled_at           timestamptz
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

`token_version` is what makes a password change actually mean something.

`must_change_password` is what the original request wanted: issue a temporary
password, force a change at first login.

`disabled_at` rather than deleting rows, so the audit log's actor references
still resolve.

### Session invalidation, which is the part people forget

Changing a password today would leave every existing session valid. Anyone who
already has the cookie keeps access — so the change does nothing against the
threat it exists for.

Current token: `admin.<base64url(email)>.<exp>.<sig>`. Add the version:

```
admin.<base64url(email)>.<version>.<exp>.<sig>
```

`isValidSessionToken` compares the token's version against the operator's
current `token_version`; a password change increments it and every other session
dies at once. Three shapes then exist — 3-part legacy, 4-part current, 5-part
versioned — and all three need explicit tests, because the parser is what stands
between a forged token and the admin.

### The endpoint — `POST /api/admin/password`

Requires **the current password**, even though the caller already holds a valid
session. A stolen cookie must not be enough to lock the real owner out; that is
the whole point of re-authentication on a sensitive action.

- throttled by ACTOR as well as IP — reuse `checkLoginThrottle`
  (`MAX_FAILURES = 5`, `WINDOW_MS = 15 min`), since an authenticated attacker
  brute-forcing the current password from one session is not IP-limited in any
  useful way
- minimum 12 characters, matching what the setup script already enforces
- rejects reuse of the current password
- writes to `admin_actions` (actor already exists, migration 0009) recording
  that a password changed — never anything about the password itself
- increments `token_version`, then re-issues the caller's own cookie so the
  person making the change is not logged out by their own action

### The UI

A form in `/admin`: current password, new, confirm. Plus a gate — if
`must_change_password` is set, every admin route redirects there until it is
cleared.

## Phases

Each ends in something verifiable, and each is small enough to review.

**Phase 1 — schema and seed.** Migration, plus a script that reads the existing
`ADMIN_USERS` and inserts both operators with their CURRENT hashes, so nothing
changes for anyone. Applied to staging first, then production.
*Check:* both rows exist with hashes byte-identical to the env value; login is
untouched because no code reads the table yet.

**Phase 2 — read from the table.** `verifyOperator` becomes async: query the
table, fall back to env ONLY on a thrown error.
*Check:* tests for a valid DB login, a wrong password, an operator absent from
the DB but present in env with the DB UP (must be REFUSED), and the same with
the DB DOWN (must be ALLOWED). The third is the backdoor test.

**Phase 3 — token versioning.** Fifth token segment, with all three shapes
tested.
*Check:* bumping `token_version` invalidates an existing cookie; legacy tokens
still validate.

**Phase 4 — the endpoint.** Change-password route with re-auth, throttle, audit
and cookie re-issue.
*Check:* wrong current password refused and throttled; success invalidates other
sessions but not the caller's own.

**Phase 5 — the UI and the forced-change gate.**
*Check:* Playwright — set `must_change_password`, confirm every admin route
redirects to the form, and that clearing it restores normal access.

**Phase 6 — demote the env.** Rename the intent in documentation: `ADMIN_USERS`
becomes break-glass only. Keep it set. Retire `--generate` from the setup script
in favour of the UI, and make the script's remaining job "seed or repair the
break-glass credential".

## What could go wrong

- **Locking yourself out of a live shop.** Mitigated by keeping the env
  credential permanently, and by phases 1 and 2 being separately reversible. Do
  not do Phase 2 on a day when nobody can reach the server.
- **The fallback becomes a permanent backdoor** if it fires on "not found". See
  above; it is the one behaviour with a dedicated adversarial test.
- **scrypt cost.** Already measured at 19.4 ms per call, ~39 ms per login with
  two operators. A DB round trip adds little. At roughly ten operators the sync
  `scryptSync` should become async — noted, not yet needed.
- **`verifyOperator` becoming async** ripples into the login route and its
  tests. Small, but it is a signature change on the security-critical path, so
  it gets its own commit rather than riding along with the feature.

## Estimate

Phases 1–2 are the substance: half a day including the adversarial tests.
Phases 3–4 another half day. Phase 5 depends on how much the form should match
the design system. Phase 6 is documentation.

Not started — this is post-launch work by agreement. The launch blocker remains
one real order end to end.
