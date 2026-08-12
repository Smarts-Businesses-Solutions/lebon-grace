# SH-08 — source-driven deploys: the plan

## What SH-08 actually is

Today a deploy means: build a Docker image by hand on cx53, tag it
`lebon-grace:cx53`, recreate the container. Coolify does not clone and does not
build — pressing **Deploy** in its UI recreates the container from whatever
image was last built by a human.

The consequence is the finding: **a green CI result does not prove the fix is
deployed.** CI tests a commit; the image on the server was built from whatever
happened to be in `/root/build/lebon-grace` when someone last ran the command.
Nothing connects the two except attention.

## Where it actually stands — this is further along than the ticket suggests

A git-backed Coolify application already exists and *works*:

| | |
|---|---|
| uuid | `m11i6a5ekwhbflhnfb9ipr48` (`lebon-grace-git`) |
| source | `https://github.com/Smarts-Businesses-Solutions/lebon-grace.git`, branch `main` |
| build | `build_pack=dockerfile`, base `/`, exposes 3000 |
| container | **up 2 days**, image tagged `…:705b0fe0a6b5…` |
| startup | clean — `Next.js 16.3.0 … Ready`, proxy guard active |

So the hard part — *can Coolify clone this repo and build a working image from
the Dockerfile* — is **already answered: yes**.

Three things are in the way, and only one of them is fiddly:

**1. It is 39 commits stale.** It built `705b0fe`, whose own message reads
*"the Coolify git app now builds and runs; it needs rotated secrets."* A previous
attempt got this far and stopped at the secrets. Nothing has rebuilt it since.

**2. It has 11 environment variables; the live service has 56.** Five of the 11
are duplicates (`APP_URL`, `BUILD_ENV`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_URL`,
`UMAMI_ORIGIN` each appear twice), so it really has about six. Everything that
matters is missing: the Stripe live keys, the Supabase service-role key, the
Resend key, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_USERS`. It boots,
but it cannot take a payment, reach the database, or send an e-mail.

**3. Its FQDN does not answer.** `http://m11i6a5ekwhbflhnfb9ipr48.116.203.242.215.sslip.io/`
times out (000 after 20s) even though the container is up and Next is listening.
Routing was never finished. That has to work before anything can be verified on
it, because a staging URL nobody can load cannot be tested.

## The complication nobody has addressed

**The git app clones from GitHub. GitHub is now the FALLBACK, not the primary.**

Forgejo became primary on 2026-08-11. `origin` has two push URLs and CI runs on
what reaches Forgejo. So a source-driven deploy from GitHub would deploy from a
mirror of the truth rather than the truth.

That is not theoretical. On 2026-08-12 three pushes reached GitHub while their
Forgejo half failed with `remote: mirror repository is read-only`, and the
failure was invisible because only the successful GitHub line was read. Under
auto-deploy-from-GitHub, **each of those would have deployed code that CI had
never seen.**

Coolify is the SaaS instance at `app.coolify.io`, so it can only clone what is
publicly reachable. Forgejo is not — `ROOT_URL=http://localhost:3900`, no
published ports, no Traefik route. It cannot clone from the primary today.

### The options

| | Approach | Cost | What it gets wrong |
|---|---|---|---|
| **A** | Deploy from GitHub on push | nothing to build | Deploys whatever reached the fallback, tested or not. This is the failure that already happened. |
| **B** | Expose Forgejo publicly, deploy from it | TLS, a hostname, an auth surface on a box running eight other projects | Adds public attack surface to shared infrastructure to solve a deploy problem |
| **C** | **Deploy only a commit CI has passed** | one webhook or one polling script | Nothing — it makes "deployable" mean "verified" |
| **D** | Leave it; automate the hand-build instead | least work | Keeps the gap between "CI is green" and "that is what is running" |

**Recommendation: C.** The requirement was never *"build from git."* It is
**"never run a commit CI has not passed."** Building from git is one way to get
there and, on its own, does not get there at all — option A is source-driven and
still ships untested code.

Concretely: keep Coolify cloning GitHub (it is reachable and it already works),
but **do not enable auto-deploy on push**. Trigger the deploy from a green CI
run instead — Coolify exposes a per-application deploy webhook, and the CI job
already knows both the commit and the verdict. A commit that fails CI, or that
never reached Forgejo at all, never triggers anything.

That also fixes the GitHub-as-fallback problem without touching Forgejo's
exposure: CI runs on Forgejo, so only a commit Forgejo has can ever produce a
green run, and only a green run can deploy.

## The plan

Each step ends in a check. Nothing proceeds on a step that has not been seen to
work — the live shop takes payments.

### Phase 0 — decide (blocking, ~5 minutes of your time)
Confirm option C, or pick another. Everything below assumes C.

### Phase 1 — make the git app reachable and current
1. Fix the routing so the sslip FQDN answers. Compare its Traefik labels with
   the live service's; the live one works, so the difference is the answer.
   **Check:** `curl` returns 200, not 000.
2. Trigger a rebuild at current `main`.
   **Check:** its image tag is HEAD's SHA, not `705b0fe`; `?dpl=` on the page
   matches the new build.

### Phase 2 — configuration parity
3. Diff the 56 live variables against the git app's 11 and close the gap.
   Remove the five duplicates.
   **Check:** a script comparing the two key sets prints an empty difference.
   Names only — no value is read, printed, or logged.
4. Secrets are entered by you in the Coolify UI, not by me. The previous attempt
   stalled here for the same reason: I do not handle key values.
   **Check:** the app answers on its FQDN with the database reachable —
   `/api/admin/login` returns JSON rather than a 500.

### Phase 3 — prove it on the throwaway FQDN
5. Run the full E2E suite against the sslip URL (`QA_BASE_URL=…`), read-only.
   **Check:** the same 268 passing that the live build gets.
6. Run `npm run verify:deploy` against it.
7. Place **one real order** end to end on the throwaway FQDN with a real card,
   then refund it. This is the only way to know the live Stripe keys and the
   webhook work from the new container.
   **Check:** the order appears in `/admin`, the confirmation e-mail arrives,
   the refund completes.

### Phase 4 — deploy on green CI, not on push
8. Add a final CI step that calls the Coolify deploy webhook, gated on the whole
   workflow having passed and on `github.ref == main`.
   **Check:** push a trivial commit; a run appears, goes green, and *then* a
   deployment starts. Push a deliberately failing commit on a branch; nothing
   deploys.

### Phase 5 — cut the domain across
9. Move `shop.lebon-grace.com` from the service to the application.
   **Check:** `?dpl=` changes, all six key pages 200, one order placed and
   refunded on the real domain.
10. **Keep the old service stopped, not deleted, for two weeks.** The rollback is
    starting it again.

## Rollback

At every phase before 9, rollback is *do nothing* — the live service is
untouched and still serving. After step 9:

```bash
# point the domain back and start the old service
docker tag lebon-grace:rollback-20260812 lebon-grace:cx53
cd /data/coolify/services/lixqbqbkz39l0bnz9xv2227t
docker compose up -d --force-recreate --no-deps lebon-grace
```

The rollback image is on the host now and the `cx53` tag exists. Both were
checked on 2026-08-12.

## What could go wrong

- **The build works but the runtime does not**, because a variable is missing
  that only matters under load — a webhook secret, say. Phase 3's real order is
  there specifically to catch that, and it is why the order is real rather than
  a test card.
- **Two containers serving the same domain.** Only one can hold the Traefik
  route; the risk is a window where neither does. Do step 9 when nobody is
  shopping.
- **Auto-deploy gets switched on by a UI click** later, quietly reintroducing
  option A. Worth a note in the Coolify description field, since the UI is where
  someone would do it.
- **`DEPLOYMENT_ID` differs.** The git build sets it from a UTC stamp; the hand
  build passes it explicitly. `verify:deploy` reads `?dpl=`, so it keeps working
  — but confirm the value actually changes between builds, or the check becomes
  a constant that always passes.

## Estimate

Phases 1–3 are a focused half-day, most of it waiting on builds and the order
test. Phase 4 is an hour. Phase 5 is ten minutes plus two weeks of leaving the
old service alone.

The riskiest step is 9, and it is also the most reversible.
