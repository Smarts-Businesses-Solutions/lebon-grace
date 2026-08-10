-- 0008 — prove the address belongs to the person who typed it
--
-- NS-01. `POST /api/newsletter` took an address and stored it. Anyone could
-- subscribe anyone: a stranger's address, a competitor's, an ex-partner's. The
-- only remedy was the unsubscribe link, which requires the victim to receive
-- the mail first — the harm has already happened by then.
--
-- It mattered less while nothing was being delivered (B-30). It matters now.
--
-- The list is EMPTY at the time of writing (verified: 0 rows), so there is no
-- grandfathering question and nothing to lose. Had there been existing rows the
-- honest choice would be to mark them confirmed with a note, because they did
-- type their address even though nobody proved it — retroactively voiding real
-- subscribers to satisfy a new rule invented after they signed up is its own
-- kind of dishonesty.
--
-- `confirmed_at IS NULL` means pending. Nullable rather than a boolean because
-- WHEN they confirmed is worth keeping and a boolean throws it away.

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- The one-time secret from the confirmation link. Cleared on use, so a link
-- cannot be replayed and a leaked inbox cannot be mined for live tokens later.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirm_token text;

-- UNIQUE so a token identifies exactly one row, and so a collision fails loudly
-- at insert rather than confirming the wrong person's subscription.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_confirm_token
  ON newsletter_subscribers (confirm_token)
  WHERE confirm_token IS NOT NULL;

-- The operator's list is "confirmed subscribers", and that query should not
-- scan pending rows to find them.
CREATE INDEX IF NOT EXISTS idx_newsletter_confirmed
  ON newsletter_subscribers (confirmed_at)
  WHERE confirmed_at IS NOT NULL;

COMMENT ON COLUMN newsletter_subscribers.confirmed_at IS
  'NULL means pending confirmation — never send to these, and never export them as subscribers (NS-01).';
