/**
 * Phase 2b step 1 — extend the Postgres `products` table so it can hold every
 * field the storefront needs, making Postgres the single source of truth.
 *
 * Adds:
 *   details          jsonb  — { material, weight, dimensions?, care? }
 *   image_placeholder jsonb — { bg, initials }  (colored fallback tile)
 *   hidden           boolean — replaces the `hidden: true` flags in products.ts
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS. Safe to re-run.
 *
 * Run:  node scripts/catalog/01-extend-schema.mjs
 */
import { readFileSync } from "fs";
import { Client } from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

// Connect directly to the stack's Postgres. The self-hosted stacks require
// `supabase_admin` for DDL — `postgres` is not superuser (see ops HANDOVER) —
// and the DDL password is the STACK's POSTGRES_PASSWORD, which is NOT the same
// value as the app's SUPABASE_DB_PASSWORD.
const stackEnv = Object.fromEntries(
  readFileSync("../ops/selfhost/stacks/lebon-grace.env", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

const client = new Client({
  host: "127.0.0.1",
  port: Number(process.env.PGPORT || 9113),
  user: "supabase_admin",
  password: stackEnv.POSTGRES_PASSWORD,
  database: stackEnv.POSTGRES_DB || "postgres",
});

const SQL = `
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_placeholder jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;
`;

try {
  await client.connect();
  await client.query(SQL);
  const { rows } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products'
      AND column_name IN ('details','image_placeholder','hidden')
    ORDER BY column_name;`);
  console.log("columns now present:");
  for (const r of rows) console.log("  ", r.column_name, "->", r.data_type);
  if (rows.length !== 3) { console.error("EXPECTED 3 COLUMNS"); process.exit(1); }
  console.log("schema extended OK");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
