# Migrations

The schema is `00000000000000_baseline.sql` **plus every numbered file after it, in
order**. That set is the schema — not a record of it, not an approximation of it.
`scripts/verify-migrations.sh` exists to keep that sentence true.

## Why this is not just bookkeeping

Before 2026-08-08 the schema was one baseline dump with no incremental history.
It had drifted **four tables, a view and three columns** behind production before
anyone noticed and regenerated it (finding D-4). Nothing was lying; there was
simply no mechanism by which a hand-applied change could ever be noticed.

Numbered files alone would not have fixed that. Files can drift too. What fixes
it is being able to *prove* the files and the database agree:

```bash
bash scripts/verify-migrations.sh
```

It builds the schema from scratch in a throwaway database, dumps both that and
production, and diffs them. Production is only ever read. The scratch database is
dropped on exit, including when the check fails.

Green means the migration set reproduces production exactly. Red prints the diff:
`-` is production, `+` is what the repo would build.

## Adding a migration

1. Next number, descriptive name: `0003_short_description.sql`.
2. Write **forward-only** SQL. Never edit an applied migration, and never edit the
   baseline — a file someone has already run is history, and rewriting it means
   two databases built from the same repo no longer match.
3. Make it re-runnable where the cost is trivial. `DROP CONSTRAINT IF EXISTS`
   before `ADD CONSTRAINT` costs nothing and turns a half-applied file into a
   recoverable one.
4. Say **why** in a comment, not what. The SQL already says what.
5. Include a rollback in a trailing comment. `0002` does this.
6. **Audit the data before adding a constraint.** A CHECK against rows that
   violate it does not warn — it fails to apply. `0002` records the counts it was
   written against.
7. Apply it, then run `verify-migrations.sh`. If it is red, the file and the
   database disagree and one of them is wrong.

## Applying to production

```bash
cat supabase/migrations/0003_your_file.sql | ssh -i ~/.ssh/hetzner_ed25519 root@116.203.242.215 \
  'docker exec -i db-ezkokajmmqcv8bw8jy970l91 sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f -"'
```

Two things that will otherwise cost an hour:

- **`supabase_admin`, not `postgres`.** `postgres` is not a superuser on this
  cluster and fails with `must be owner of relation …`.
- **`docker exec -i` only when you are piping in.** Without a pipe, `-i` makes
  the container inherit your shell's stdin and swallow the rest of a heredoc —
  the command appears to hang or silently do nothing.

Wrap anything with more than one statement in `BEGIN; … COMMIT;` so a partial
failure rolls back. DDL is transactional in Postgres; use it.

## Numbering

| File | What |
|---|---|
| `00000000000000_baseline.sql` | Origin. Regenerated 2026-08-04. Do not edit. |
| `0001_restrict_products_write_policy.sql` | Dropped the permissive `anon` write policy (S-1). |
| `0002_add_constraints.sql` | Status CHECK, `NOT NULL`, non-negative money and stock (D-1, D-2). |
| `0003_index_order_email_lookup.sql` | Generated `customer_email_lc` + index, so `/account` stops seq-scanning (D-3). |
| `0004_order_items_personalisation.sql` | Engraved name as its own column, for the workshop queue (A-15). |
| `0005_product_reviews.sql` | Reviews, tied to an order by foreign key so ratings cannot be invented (A-18). |
