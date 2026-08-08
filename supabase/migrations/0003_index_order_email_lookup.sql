-- 0003 — make the /account order lookup indexable
--
-- Finding D-3. `getByEmailPhone` filtered with `.ilike("customer_email", email)`
-- and no index existed on the column. `ilike` cannot use a plain btree index, so
-- every /account lookup was a sequential scan of the whole orders table, and the
-- phone check then ran in JavaScript on every row transferred back.
--
-- Note the `ilike` carried no wildcards — it was case-insensitive *equality*
-- written with a pattern operator. That is the whole reason it could not be
-- indexed, and it is why the fix costs nothing in behaviour.
--
-- Approach: a stored generated column holding the lowercased address, plus a
-- btree index on it. The query becomes `.eq("customer_email_lc", …)`.
--
-- Why not the two obvious alternatives:
--
--   citext — needs an extension and an ALTER COLUMN TYPE on a live table, and
--     PostgreSQL's own documentation now steers away from it, recommending
--     nondeterministic collations instead.
--
--   a nondeterministic ICU collation — what those docs recommend, and genuinely
--     the better answer for a greenfield schema. Not here: a nondeterministic
--     collation does not support pattern-matching operators at all, so any
--     LIKE/ILIKE against this column would start erroring. `getById` already
--     uses ilike on another column and the admin surface may grow more.
--
-- The generated column needs no extension, no type change and no collation
-- semantics; PostgREST treats it as an ordinary column, so `.eq()` just works.
-- It is also computed for existing rows automatically and is trivially
-- reversible.
--
-- GENERATED ALWAYS means it cannot be written to. Nothing writes it: the webhook
-- inserts `customer_email` and never this column.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email_lc text
  GENERATED ALWAYS AS (lower(customer_email)) STORED;

CREATE INDEX IF NOT EXISTS orders_customer_email_lc_idx
  ON public.orders (customer_email_lc);

-- Deliberately NOT indexed: the phone.
--
-- The plan suggested pushing the phone comparison into the query too. It should
-- not be. `phoneMatches` compares the LAST EIGHT DIGITS, which in SQL is
-- `… LIKE '%' || $1` — a trailing-wildcard match that no btree index can serve.
-- It would need a reverse() expression index or pg_trgm, to save filtering the
-- handful of rows one email address returns. The email index already reduces the
-- scan from every order in the table to one customer's; the phone check in
-- src/lib/store.ts is what turns that into an authorisation decision, and it is
-- cheap once the set is that small.

-- Rollback:
--     DROP INDEX IF EXISTS public.orders_customer_email_lc_idx;
--     ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_email_lc;
