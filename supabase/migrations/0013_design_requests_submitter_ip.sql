-- 0013 — record who submitted a design request, so the flood can be bounded
--
-- Task #72. /custom is an unauthenticated endpoint that accepts a 10 MB file
-- from anyone on the internet and stores it. `src/lib/rate-limit.ts` cannot
-- bound that: it keeps its buckets in process memory and is zeroed by every
-- restart and deploy, which is the exact weakness migration 0006 was written to
-- fix for the login route.
--
-- The threat here is not guessing, it is ACCUMULATION. Nobody is brute-forcing
-- a design request. Someone bored submits four hundred of them overnight, the
-- operator queue becomes unusable, and R2's free tier runs out somewhere around
-- a thousand stored objects. A limiter that forgets everything on deploy does
-- not stop that; it just spreads it over more deploys.
--
-- So the count has to outlive the process, and counting needs an identity.
--
-- ON STORING AN IP ADDRESS. It is personal data and it is stored deliberately,
-- for the narrowest possible purpose: bounding submissions from one source. It
-- is not a login, not a profile, and nothing reads it except the throttle and
-- the expiry sweep, which clears it along with the artwork. `expires_at`
-- already governs the row, so this does not create a new retention question.
--
-- Nullable, because a request created by an operator by hand has no submitter.

ALTER TABLE public.design_requests
  ADD COLUMN IF NOT EXISTS submitter_ip text;

-- The only query shape the throttle uses: how many rows from this address since
-- a cutoff. Partial, because rows with no IP are operator-created and can never
-- match, and there is no point indexing them.
CREATE INDEX IF NOT EXISTS design_requests_submitter_recent_idx
  ON public.design_requests (submitter_ip, created_at DESC)
  WHERE submitter_ip IS NOT NULL;

-- Rollback:
--     DROP INDEX IF EXISTS public.design_requests_submitter_recent_idx;
--     ALTER TABLE public.design_requests DROP COLUMN IF EXISTS submitter_ip;
