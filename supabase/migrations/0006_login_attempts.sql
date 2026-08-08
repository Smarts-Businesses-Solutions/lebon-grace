-- 0006 — make admin brute-force protection survive a restart
--
-- ACTION_PLAN.md A-21, finding S-3. `src/lib/rate-limit.ts` keeps its buckets in
-- a `Map` in process memory. That is a deliberate, documented choice for a
-- single-container app and it is fine for the ordinary routes.
--
-- It is not fine for the login route, for a reason the original note did not
-- draw out: **every deploy clears every bucket.** There were eight deploys on
-- 2026-08-04 alone. An attacker does not need to defeat the limiter, they only
-- need to be mid-run when someone ships — the counter goes back to zero on its
-- own. "5 attempts per 15 minutes" is therefore a much weaker claim than it
-- reads, and the weakness is invisible from the configuration.
--
-- This table holds the failed attempts so the count outlives the process.
--
-- Only FAILURES are counted against an address. A successful login clears that
-- address's history, so an admin who fat-fingers their password three times and
-- then gets it right does not spend the rest of the window locked out of their
-- own shop.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           bigserial PRIMARY KEY,
  -- Client IP as seen by the proxy. Not a stable identity — it is the only
  -- thing available before authentication, which is the point.
  ip           text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded    boolean NOT NULL DEFAULT false
);

-- The only query shape: recent failures for one address.
CREATE INDEX IF NOT EXISTS login_attempts_ip_time_idx
  ON public.login_attempts (ip, attempted_at DESC);

-- Deny by default, like every other table here. The application reads and
-- writes through the service role, which bypasses RLS; the anon key is
-- published to browsers, so it gets no policy. A table of login activity is
-- exactly what an attacker would like to read.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Rollback:
--     DROP TABLE public.login_attempts;
