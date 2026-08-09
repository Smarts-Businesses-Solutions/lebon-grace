# Moving lebon-grace from a Coolify *service* to a git-backed *application*

**Status:** the git-backed application exists and is configured. It cannot
deploy yet: Coolify will not attach the deploy key over its API, which is an
upstream bug and needs one click in the UI. Details under *Where it stands*.

| | |
|---|---|
| application uuid | `m11i6a5ekwhbflhnfb9ipr48` (name `lebon-grace-git`) |
| old service uuid | `lixqbqbkz39l0bnz9xv2227t` — still serving all traffic |
| project / server | `lacyl74b0vxk0e30v5hx8c34` / `z27mmhwdcrjul0h7olool629` |
| deploy key | Coolify `s161t6sy0krhqhim9mc0a9tm`, GitHub key id `159716243`, read-only |
| temporary FQDN | `m11i6a5ekwhbflhnfb9ipr48.116.203.242.215.sslip.io` |

---

## The defect

Every deploy this app has ever run reported success, and some of them shipped
nothing. The cause is not a broken deploy — it is that the deploy was never
connected to the source in the first place.

Measured from the running container's own labels on 2026-08-09:

```
coolify.managed=true
coolify.type=service          <-- not "application"
coolify.serviceId=67837
image: lebon-grace:cx53       <-- a tag built by hand, on the host
```

A Coolify **service** is recreated from a compose file. That compose file names
an image tag that already exists on the host. Coolify never clones the
repository and never runs `docker build`. So "Deploy" does exactly what it says
— it recreates the container — and the container it recreates is whatever was
last built by hand. A commit can sit unshipped indefinitely while the control
plane reports green, which is the worst shape a deployment can take: silent.

An **application** with `build_pack: dockerfile` clones the branch and builds it.
That is the fix. Coolify has no in-place conversion between the two, so this is
create-new → verify → cut over → retire-old.

## Prerequisite, now fixed: the build id

`next.config.ts` sets `deploymentId: process.env.DEPLOYMENT_ID`, and Next writes
that into every asset URL as `?dpl=<id>`. `npm run verify:deploy` reads it back
off the live site — it is the whole mechanism by which we can tell a live build
from a stale one.

Nothing supplies `DEPLOYMENT_ID` in a Coolify git build. The hand-rolled
`docker build` passed it explicitly; Coolify's build pack does not. So the first
git-backed deploy would have built assets with **no `dpl=` at all**, and the one
check capable of detecting a stale deploy would have gone quiet — while we were
in the middle of fixing stale deploys.

The Dockerfile now defaults it:

```dockerfile
ARG DEPLOYMENT_ID=""
RUN DEPLOYMENT_ID="${DEPLOYMENT_ID:-$(date -u +%Y%m%d%H%M%S)}" \
 && export DEPLOYMENT_ID \
 && npm run build
```

Verified on cx53, both directions:

| case | result |
|---|---|
| old Dockerfile, no build-arg | build **fails** the numeric assertion — `dpl` empty |
| new Dockerfile, no build-arg | serves `dpl=20260809095822` across 247 asset refs |
| new Dockerfile, explicit arg | `20260809094044` passed through unchanged |

A UTC stamp rather than `SOURCE_COMMIT` for two reasons: `verify-deploy.mjs`
matches `/dpl=(\d+)/` and orders ids numerically, so a hex SHA would not parse;
and Coolify's own docs warn that enabling *Include Source Commit in Build*
invalidates the Docker layer cache on **every** commit. Generating the stamp
inside the build layer means it changes when the source changes and not
otherwise — the cache behaviour we want, for free.

## Do the env surface at the same time

The migration re-enters environment variables by hand, which makes it the moment
to fix something worse than the deploy problem.

The running container carries **67** environment variables. The application code
reads **25**. Of the 50 it never reads, **36 are credentials**:

```
ANTHROPIC_API_KEY  OPENAI_API_KEY  KIMI_API_KEY  MINIMAX_API_KEY
MINIMAX_CODE_API_KEY  GitHub_PAT_classic  SHOPIFY_ADMIN_TOKEN
VERCEL_PERSONAL_ACCESS_TOKEN  SUPABASE_DB_PASSWORD  SENTRY_PAT
SUPABASE_Generate_New_Token_Never  STRIPE_SECRET_KEY_LIVE
STRIPE_WEBHOOK_SECRET_LIVE  STRIPE_PUBLISHABLE_KEY_LIVE
CLOUDFLARE_API_TOKEN  CLOUDFLARE_Access_Key_ID  CLOUDFLARE_Secret_Access_Key
CLOUDFLARE_R2_Account_Token  CLOUDFLARE_WORKERS_API_TOKEN
Hostinger_Hermes_API_KEY  Hostinger_Hermes_ssh_keys  Hostinger_ZCode_API_KEY
POSTIZ_API_KEY  POSTFORME_ONE_API_KEY  TWITTERAPI_IO_API_KEY  ZERNIO_API_KEY
POSTHOG_PERSONAL_API_TOKEN  NEXT_PUBLIC_POSTHOG_KEY  Cron_Job_API_Key
App_automation_token  CRON_SECRET  REVALIDATE_SECRET  SITE_PASSWORD
Secret  NEXT_PUBLIC_SUPABASE_ANON_KEY  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

This is close to the whole estate's credential set, sitting inside a container
that serves the public internet and takes card payments. It is also the direct
explanation for A-0b — "exposed GitHub PAT in nine containers" — `GitHub_PAT_classic`
is right there, and it is not something this app has any use for.

Do not copy these forward. The new application should receive the 25 it reads
and nothing else. `scripts/coolify-register-git-app.sh` prints that list.

Two smaller notes from the same audit, both verified in source rather than
assumed:

* `NEXT_PUBLIC_POSTHOG_HOST` / `_KEY` survive here even though A-19b purged
  PostHog, because the service's env lives in a hand-maintained compose file
  that no code change can reach. Symptomatic of the whole problem.
* `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` are absent, so
  `src/lib/whatsapp.ts:75` takes its guard and returns `false` after a
  `console.warn`. WhatsApp order notifications are not running in production.
  Nothing is broken by it, but nothing is sending, either.

## Why the secrets are not copied by script

The script sets only values that are already public — the app URL, the internal
Umami origin. Every credential is listed by name for you to paste into the
Coolify UI.

That is not squeamishness. Those keys are being rotated anyway: several were
printed into terminal output on 2026-08-09 while reading the service's compose
file. Copying the current values into the new application would migrate the
compromised set. Enter the **new** values, once, in the UI.

## Where it stands

Done, on the live control plane:

* Deploy key created — a dedicated read-only ed25519 key, not the existing
  server SSH key. Reusing that one would have coupled "Coolify can reach the
  Hetzner box" to "Coolify can read the source", which are different questions
  and should fail independently.
* Application `lebon-grace-git` created against `main`, build pack `dockerfile`,
  port 3000, auto-deploy **off**, on the same project and server as the service.
* `BUILD_ENV` set as a build-time multi-line variable: real values for the
  `NEXT_PUBLIC_*` set and `UMAMI_ORIGIN`, placeholders for the six secrets the
  build needs present but not real. The Dockerfile writes it to
  `.env.production.local` in the builder stage, which is never copied into the
  runner, so no placeholder reaches runtime.

**Blocked, and not by anything in this repo.** Coolify accepts
`private_key_uuid` on `POST /applications/private-deploy-key`, answers `201`,
and stores nothing — the application reads back `private_key_id=null`. The
update endpoint refuses to repair it, rejecting both `private_key_uuid` and
`private_key_id` with *"This field is not allowed."* So there is no API path at
all. Upstream: [coolify#2872](https://github.com/coollabsio/coolify/issues/2872)
and [#2874](https://github.com/coollabsio/coolify/issues/2874) report the same
validation contradiction; [#8562](https://github.com/coollabsio/coolify/issues/8562)
is the sibling case where the key is stored but never injected.

The symptom is unhelpful and worth recognising: deploys fail in about 8 seconds
with **no build log at all**, and the helper container exits having written
nothing. That is not a build failure — it is Coolify unable to clone.

**The one manual step:** in the Coolify UI open `lebon-grace-git` → *Source* →
select the private key `lebon-grace-github-deploy-key`, then deploy. Everything
else is already set.

## Procedure

```bash
bash scripts/coolify-register-git-app.sh          # dry run — prints the plan
bash scripts/coolify-register-git-app.sh --apply  # creates the application
```

Blocked on one thing: a Coolify SaaS API token. This app is controlled by the
SaaS instance at `app.coolify.io`, and no token for it is recorded — the Coolify
tokens that do exist in `supabase.local` authenticate against different Coolify
instances and will not work here. Create one under *Keys & Tokens → API tokens*
(read+write) and put it in `.env.local` as `COOLIFY_API_TOKEN=` — gitignored,
and the script reads it from there so it never reaches a command line or this
transcript.

You will also need a **deploy key**: add a private key under *Keys & Tokens →
Private Keys*, then its public half to the GitHub repo under
*Settings → Deploy keys*. Read-only is enough — Coolify only clones.

Then, in order:

1. Add the env vars listed by the script. Rotated values.
2. Deploy. It builds from `main`; watch the log for `>> building with DEPLOYMENT_ID=`.
3. Give the new app a throwaway FQDN and run `npm run verify:deploy` against it.
   It must report a `dpl` **newer** than the live one. Do not skip this — it is
   the check that would have caught the original defect.
4. Move `shop.lebon-grace.com` across, then stop the old service.
5. Enable auto-deploy on push only once a real order has completed end-to-end.

## Rollback

The old service is stopped, not deleted, and `lebon-grace:cx53` stays on the
host, as does the tagged `lebon-grace:rollback-20260809`. Reverting is starting
the service again and moving the domain back — no rebuild, no restore.

The one thing that does not follow is the ISR cache volume
(`lixqbqbkz39l0bnz9xv2227t_next-cache` → `/app/.next/cache`). The new
application gets an empty one. That costs a slow first render per page, nothing
more; do not try to share the volume between the two.
