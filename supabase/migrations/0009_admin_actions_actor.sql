-- 0009 — the column 0007 deliberately refused to create
--
-- AD-02, second half. 0007 shipped `admin_actions` with no `actor` column and
-- said why in its own comment: with one shared password the honest answer is
-- "unknown", and a column filled with a plausible fiction is worse than an
-- absent one. Named operators now exist (ADMIN_USERS + scrypt), so the column
-- can finally be filled with something true.
--
-- NULLABLE, and it stays nullable permanently. Three cases legitimately have no
-- actor and NOT NULL would force each of them to lie:
--   * every row written before this migration;
--   * a session that logged in with the shared fallback password;
--   * anything the system does on its own behalf.
-- NULL reads as "not attributable", which is exactly what those are.

ALTER TABLE admin_actions
  ADD COLUMN IF NOT EXISTS actor text;

-- "What did this person do?" is the question an audit trail exists to answer,
-- and it should not scan the whole table to answer it.
CREATE INDEX IF NOT EXISTS idx_admin_actions_actor
  ON admin_actions (actor, created_at DESC)
  WHERE actor IS NOT NULL;

COMMENT ON COLUMN admin_actions.actor IS
  'E-mail of the operator, from their signed session. NULL = not attributable: written before named logins existed, or done with the shared fallback password. Never invent a value here (AD-02).';
