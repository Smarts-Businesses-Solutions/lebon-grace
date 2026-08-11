# The staging database

A second, disposable copy of the shop's database, so tests that create and
destroy orders never touch the live one. This is TR-03.

## Why it exists

There was exactly one database: the live one, with real orders in it. A test
that follows an order all the way to `refunded` has to create an order, walk it
through statuses, and delete it. Run that on every CI run and you are writing
and deleting real rows in a shop that takes payments — several times a day — and
a run that dies halfway leaves a fake order sitting in the workshop queue.

So it was never automated. Playbook **P-006** covers it by hand, for exactly
that reason. The automation was never the hard part; the safe place to run it
was.

## What it is

Three containers on cx53, mirroring production's stack and its **exact image
versions** — a staging database running a different Postgres is not staging, it
is a second thing to debug.

| | Production | Staging |
|---|---|---|
| Postgres | `supabase/postgres:17.6.1.111` | same |
| PostgREST | `supabase/postgrest:v14.10` | same |
| Kong | `supabase/kong:2.8.1` | same |
| REST endpoint | `sb-lebon-grace.axiomsynapse.com` | `127.0.0.1:8114` |
| Postgres port | `127.0.0.1:9113` | `127.0.0.1:9114` |
| Managed by | Coolify | **nothing — by hand, from this directory** |
| Public route | Traefik + TLS | **none** |

Three properties are deliberate:

1. **Not Coolify-managed.** No `coolify.*` labels, so it never appears in the
   Coolify UI and cannot be Deployed, restarted or deleted by a mis-click meant
   for the live stack.
2. **Not publicly reachable.** No Traefik labels, every port bound to
   `127.0.0.1`. It has no hostname. Reaching it means an SSH tunnel.
3. **Impossible to confuse with production.** Every container, volume and
   network is prefixed `lg-staging-`.

## Using it

```bash
npm run test:lifecycle:staging
```

That is the whole thing. It opens a tunnel to cx53, fetches the service key from
the server, runs the suite, and closes the tunnel. One command, because a test
that needs three manual steps first is a test that stops being run — which is
how P-006 stayed manual for so long.

To run the suite against some other database, set the env yourself:

```bash
STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_KEY=... npm run test:lifecycle
```

## Rebuilding it from nothing

```bash
# on cx53, from a checkout at /root/lg-staging
bash ops/staging/setup.sh              # secrets, containers, migrations, verify
bash ops/staging/verify-schema.sh      # does it still match production?
bash ops/staging/setup.sh --status     # what is running (secret LENGTHS only)
bash ops/staging/setup.sh --destroy    # stop and delete the volume
```

`setup.sh` is safe to re-run. Existing secrets are kept, migrations are
idempotent, and `--destroy` refuses unless the database can prove it is staging.

## The guard, and why it is shaped this way

The lifecycle suite writes and deletes rows, so it must be certain what it is
pointed at.

The obvious guard is a blocklist of production URLs. That is **fail-open**: it
permits every URL not on the list, so a typo, a new host, a copied environment
variable or a future production domain goes straight through to the live shop.
The list has to be exhaustive to work, and there is no way to know when it has
stopped being exhaustive.

This is the **fail-closed** inverse. `setup.sh` creates a `staging_marker` table
holding one row that says, in the database's own words, that it is safe to
destroy. The suite refuses to run unless it can read that row. Production has
never had that table and never will, so the check cannot be satisfied by
accident — only by someone having deliberately built a throwaway database.

The production-host rejection is still there, as a second belt. It is not the
guard; it is a clearer error message for the most likely mistake.

Both were verified by watching them refuse:

| Pointed at | Result |
|---|---|
| nothing configured | refuses, 0 tests run |
| `sb-lebon-grace.axiomsynapse.com` | refuses by name, 0 tests run |
| staging | 6 passed, 0 rows left behind |

There is a second, independent barrier: the suite lives in its own Vitest config,
so `npm test` never collects it. CI runs it deliberately, in a dedicated job
against a database it creates itself — never as a side effect of the ordinary
test run. Either barrier alone would probably do. Both, because the failure mode
is writing to a live shop.

## How it runs in CI

Not against this stack. The `lifecycle` job in `.forgejo/workflows/ci.yml`
starts its **own** Postgres and PostgREST as Forgejo Actions *service
containers* — same image versions, created empty at the start of the job,
reachable only from that job's private network, destroyed when it ends.

That was chosen over pointing CI at this long-lived stack, and the reasons are
worth keeping:

- **No shared-infrastructure change.** Service containers share the job's
  network automatically, so nothing has to be attached to the `coolify` network
  and CI stays uncoupled from any long-lived machine.
- **No shared state.** Concurrent runs cannot race on cleanup, and a cancelled
  run leaves nothing behind.
- **CI does not go red because staging is down** for maintenance.
- **Every migration is applied from nothing on every push**, so a migration that
  only works against an already-migrated database fails in CI rather than at the
  next deploy.

CI runs **without kong**, talking to PostgREST directly with
`STAGING_REST_DIRECT=1`. Kong contributes API-key auth, ACLs and CORS — none of
which this suite exercises — and its declarative config must be a mounted file,
which a service container cannot have because it starts before checkout. Both
shapes were verified against this stack before the job was written, and the
`STAGING_REST_DIRECT` shim was proven to actually do something by watching the
same URL be refused without it.

CI also connects PostgREST as **`postgres`, not `authenticator`**. That is not a
shortcut: `authenticator` has no password on a fresh volume, it is a reserved
role only a superuser may alter, `postgres` is not a superuser in this image,
and `supabase_admin` refuses a passwordless connection from another container.
`postgres` is already a member of `anon` and `service_role`, which is all
PostgREST needs. Verified by running a real PostgREST wired that way and getting
a 200 for a service_role query.

This stack remains the place to run the suite **by hand**, and it is the one
that exercises the full production-shaped path including kong.

## Schema parity

`verify-schema.sh` compares staging's `public` schema against production's —
columns, constraints and indexes — and fails if they differ. It is strictly
read-only against production.

That is the gate the migration step deliberately is not. The baseline migration
is a production `pg_dump` restored into an image that already owns the `auth`
and `storage` schemas, so it emits ~300 harmless "already exists" errors and its
exit code says nothing useful. What matters is the outcome: after every
migration has run, is staging the same shape as the live database?

It also answers **A-8** first-hand — whether the forward migrations can rebuild
production from nothing. As of 2026-08-11 they can: 130 columns, 31 constraints
and 32 indexes, all matching.

The check was verified by injecting a column and an index into staging and
confirming it reported both, then removing them and confirming it went clean
again. A parity check that has never been seen to fail is not a check.

## Credentials

Generated by `setup.sh` into `ops/staging/.env.staging` (mode 0600, gitignored)
and copied into `supabase.local` under `#----LEBON_GRACE_STAGING_DB----`.

`kong.yml` is generated too, and is also gitignored: it embeds the literal
service-role key. `kong.template.yml` is the version-controlled artefact.

Nothing here is shared with production. These credentials protect a database
whose whole purpose is to be destroyed by tests, and they are still generated
properly — "it's only staging" is how a reused password ends up somewhere that
matters.

## Things that will bite you

- **`kong.yml` must be mode 0644.** Kong runs as a non-root user inside its
  container; a 0600 root-owned bind mount is unreadable to it and the container
  crash-loops with `Permission denied`, which reads like a config syntax error.
  The host-side protection is `/root` being mode 700, not the file bit.
- **The active `pg_hba.conf` is `/etc/postgresql/pg_hba.conf`,** not the one in
  the data directory — that one is a decoy saying `local all all trust`. The
  real file requires a password for `supabase_admin` over the socket but trusts
  TCP from `127.0.0.1` inside the container, which is how `setup.sh` sets the
  `authenticator` password.
- **PostgREST caches the schema at connect time** and never polls. Migrations
  applied afterwards are invisible until `NOTIFY pgrst, 'reload schema'`, and
  until then every insert fails with `PGRST204: Could not find the '<column>'
  column` — naming a column that demonstrably exists. `setup.sh` does the
  NOTIFY.
- **The Supabase image does not set the `authenticator` password** from
  `POSTGRES_PASSWORD` on a fresh volume ([supabase/supabase#18836]). PostgREST
  then crash-loops on `password authentication failed for user
  "authenticator"`. `setup.sh` sets it explicitly rather than depending on image
  behaviour that a version bump could change again.

[supabase/supabase#18836]: https://github.com/supabase/supabase/issues/18836
