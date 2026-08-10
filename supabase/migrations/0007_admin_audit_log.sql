-- 0007 — record what the admin actually did
--
-- AD-02, the tractable half. The finding is "shared admin identity gives no
-- human accountability or action audit trail", which is two problems wearing one
-- number:
--
--   (a) WHO did it — needs real accounts, sessions and a login rewrite.
--   (b) WHAT was done, and WHEN — needs a table.
--
-- (b) is worth having on its own and does not wait for (a). Today an order can
-- move from `processing` to `refunded`, e-mail the customer "Refund issued", and
-- leave **no trace anywhere** that it happened or when. The order row shows the
-- new status and nothing else: not the old one, not the time, not that a message
-- went out. If a customer says "I never asked to be cancelled", there is nothing
-- to check.
--
-- With one shared password this cannot say *who*, and it deliberately does not
-- pretend to: there is no `actor` column to fill with a fiction. When accounts
-- arrive, add one — the rows written before that will honestly read "unknown".
--
-- Deliberately append-only in spirit: no UPDATE path in the application, and
-- nothing reads it on the customer-facing side. An audit trail the app can edit
-- is not an audit trail.

CREATE TABLE IF NOT EXISTS admin_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What happened, in the app's own vocabulary: "order.status_changed".
  -- Free text rather than an enum, because a CHECK here would mean a migration
  -- every time a new admin action is logged, and the pressure would then be to
  -- skip logging rather than to migrate.
  action      text NOT NULL,

  -- What it happened to. `target_id` is text, not uuid: orders use uuids but
  -- products are keyed by slug, and a column that only fits half the targets
  -- would quietly exclude the other half.
  target_type text NOT NULL,
  target_id   text NOT NULL,

  -- The before/after, and anything else worth keeping. jsonb so a new field
  -- costs nothing, and so a status change can record BOTH values — "it is
  -- refunded now" is much less useful than "it went from processing to
  -- refunded".
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The two questions this table exists to answer: "what happened to this order?"
-- and "what happened in the last hour?".
CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON admin_actions (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created
  ON admin_actions (created_at DESC);

COMMENT ON TABLE admin_actions IS
  'Append-only record of operator actions. No actor column until real accounts exist (AD-02) — an unfillable column is worse than an absent one.';
