/**
 * Product intelligence — schema.
 *
 * CJ exposes no sales or ranking data (verified: hotProduct/trending/bestSellers
 * all return "Interface not found", and listedNum is 0 for ~80% of products).
 * The one demand signal we can derive ourselves is INVENTORY VELOCITY: snapshot
 * stock levels over time, and infer sell-through from how fast they fall.
 *
 * Two tables:
 *   product_intel_watchlist  — what we track
 *   product_intel_snapshots  — append-only stock readings
 *
 * Snapshots are deliberately append-only: the value of this data is that it
 * accumulates. Never UPDATE a snapshot; the history IS the asset.
 *
 * Run: node scripts/intel/schema.mjs
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";

const SQL = `
CREATE TABLE IF NOT EXISTS public.product_intel_watchlist (
  cj_pid        text PRIMARY KEY,
  product_name  text,
  category      text,
  source        text DEFAULT 'catalog',   -- catalog | discovery | manual
  added_at      timestamptz DEFAULT now(),
  active        boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.product_intel_snapshots (
  id           bigserial PRIMARY KEY,
  cj_pid       text NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  inventory    integer,
  variant_count integer,
  sell_price   numeric(10,2),
  sale_status  text,
  UNIQUE (cj_pid, captured_at)
);
CREATE INDEX IF NOT EXISTS pis_pid_time_idx
  ON public.product_intel_snapshots (cj_pid, captured_at DESC);

-- Velocity view: pairs each snapshot with the previous one for the same product.
-- Stock INCREASES are restocks, not negative sales, so they are reported
-- separately rather than being allowed to cancel out real sell-through.
CREATE OR REPLACE VIEW public.product_intel_deltas AS
SELECT
  s.cj_pid,
  s.captured_at,
  LAG(s.captured_at) OVER w              AS prev_at,
  s.inventory,
  LAG(s.inventory)   OVER w              AS prev_inventory,
  LAG(s.inventory)   OVER w - s.inventory AS drop,
  EXTRACT(EPOCH FROM (s.captured_at - LAG(s.captured_at) OVER w)) / 86400.0 AS days
FROM public.product_intel_snapshots s
WINDOW w AS (PARTITION BY s.cj_pid ORDER BY s.captured_at);
`;

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
console.log("product intelligence schema ready");
