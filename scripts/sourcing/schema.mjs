/**
 * Sourcing agent — review-queue table.
 *
 * The agent NEVER writes to `products` directly. It proposes candidates here;
 * a human approves, and only then is a candidate promoted into the catalog.
 *
 * Run:  node scripts/sourcing/schema.mjs
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";

const SQL = `
CREATE TABLE IF NOT EXISTS public.sourcing_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cj_pid                text UNIQUE NOT NULL,
  product_title         text NOT NULL,
  category              text,
  primary_material      text,
  packaging_type        text,

  sourcing_cost_usd     numeric(10,2),
  freight_usd           numeric(10,2),
  actual_weight_kg      numeric(10,3),
  dims_cm               jsonb DEFAULT '{}'::jsonb,
  volumetric_weight_kg  numeric(10,3),
  volumetric_ratio      numeric(10,2),

  landed_cost_aed       numeric(10,2),
  suggested_retail_aed  numeric(10,2),
  expected_margin_aed   numeric(10,2),

  competition           jsonb DEFAULT '{}'::jsonb,
  market_price_aed      numeric(10,2),
  market_source         text,

  passes_all_filters    boolean DEFAULT false,
  filter_results        jsonb DEFAULT '{}'::jsonb,
  score                 numeric(10,2) DEFAULT 0,

  status                text DEFAULT 'pending_review',
  reviewer_note         text,
  raw                   jsonb DEFAULT '{}'::jsonb,
  created_at            timestamptz DEFAULT now(),
  reviewed_at           timestamptz
);
CREATE INDEX IF NOT EXISTS sourcing_candidates_status_idx ON public.sourcing_candidates(status);
CREATE INDEX IF NOT EXISTS sourcing_candidates_score_idx  ON public.sourcing_candidates(score DESC);
`;

// DDL needs supabase_admin, and the stack's POSTGRES_PASSWORD (not the app's
// SUPABASE_DB_PASSWORD). Run inside the db container — no shell, args as an
// array, secret passed via the environment rather than the command line.
const stackEnv = Object.fromEntries(
  readFileSync("../ops/selfhost/stacks/lebon-grace.env", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

const out = execFileSync(
  "docker",
  ["exec", "-e", `PGPASSWORD=${stackEnv.POSTGRES_PASSWORD}`, "sh-lebon-grace-db-1",
   "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", SQL],
  { encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" } }
);
console.log(out.trim());
console.log("sourcing_candidates ready");
