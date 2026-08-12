-- 0010 — stop the cart-recovery endpoint being a mail relay (SH-06)
--
-- `POST /api/cart-recovery` sends branded mail from our domain to an address
-- supplied in the request body. The only control was 3 requests per hour per IP,
-- which bounds one attacker's throughput and does nothing for the victim:
-- rotating IPs is cheap and every one of them can mail the same person again.
--
-- The audit rated this LOW because at the time every e-mail was being refused by
-- Resend (B-30). Fixing the sender domain made it live. Worth stating plainly:
-- a dormant abuse path became reachable because an unrelated bug was fixed, and
-- nothing in the test suite noticed.
--
-- This table backs a per-RECIPIENT cooldown, so the limit follows the person
-- being mailed rather than the machine doing the mailing.

CREATE TABLE IF NOT EXISTS cart_recovery_sends (
  -- HMAC-SHA256 of the lower-cased address, keyed with ADMIN_SESSION_SECRET.
  --
  -- NOT the address itself, and that is the point. This table only ever needs
  -- equality — "have we mailed this one recently" — and storing the addresses
  -- would build a list of people who never asked to be on one, since anyone can
  -- add an entry by POSTing. The key stops a leaked table being reversed with a
  -- dictionary of common addresses.
  recipient_hash text PRIMARY KEY,

  last_sent_at timestamptz NOT NULL DEFAULT now(),

  -- Kept because an address being targeted repeatedly is worth being able to
  -- see, even though the address itself is not recoverable from this row.
  send_count int NOT NULL DEFAULT 1,

  -- Set when someone opts out. Never mailed again, no expiry.
  suppressed boolean NOT NULL DEFAULT false
);

-- The cooldown sweep reads by recency; the primary key already covers lookup.
CREATE INDEX IF NOT EXISTS idx_cart_recovery_last_sent
  ON cart_recovery_sends (last_sent_at DESC);

COMMENT ON TABLE cart_recovery_sends IS
  'Per-recipient cooldown for /api/cart-recovery (SH-06). Addresses are stored as a keyed hash, never in clear — this table must not become a mailing list of people who never asked to be on one.';
