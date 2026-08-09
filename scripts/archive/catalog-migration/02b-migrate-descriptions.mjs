/**
 * Phase 2b step 2b — migrate the REAL product descriptions from products.ts
 * into Postgres.
 *
 * Every one of the 515 rows in Postgres currently has the same filler
 * description ("A quality everyday item from trusted suppliers."), while
 * products.ts carries unique per-product copy. Generating the catalog from
 * Postgres without this step would give 515 identical descriptions — bad for
 * customers and duplicate-content for SEO.
 *
 * Only writes where products.ts has a longer/richer description than the DB.
 * Idempotent.
 *
 * Run:  node scripts/catalog/02b-migrate-descriptions.mjs [--dry]
 */
import { readFileSync } from "fs";

const DRY = process.argv.includes("--dry");
const FILLER = "A quality everyday item from trusted suppliers.";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

// Parse slug -> description out of products.ts
const src = readFileSync("src/lib/products.ts", "utf8");
const byslug = new Map();
for (const block of src.split(/\n  \{ slug: "/).slice(1)) {
  const slug = block.match(/^([^"]+)"/)?.[1];
  const desc = block.match(/description:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  if (slug && desc) byslug.set(slug, desc.replace(/\\"/g, '"'));
}
console.log(`parsed ${byslug.size} descriptions from products.ts`);

const rows = await (await fetch(`${SB}/rest/v1/products?select=slug,description&limit=2000`, { headers: H })).json();
const targets = rows.filter((r) => {
  const d = byslug.get(r.slug);
  return d && d.length > 40 && (r.description === FILLER || !r.description || d.length > (r.description?.length || 0));
});
console.log(`${targets.length} of ${rows.length} Postgres rows will get a richer description`);

if (DRY) {
  for (const t of targets.slice(0, 2)) console.log(`  ${t.slug}\n    old: ${t.description}\n    new: ${byslug.get(t.slug).slice(0, 120)}…`);
  process.exit(0);
}

let ok = 0, fail = 0;
for (const t of targets) {
  const r = await fetch(`${SB}/rest/v1/products?slug=eq.${encodeURIComponent(t.slug)}`, {
    method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ description: byslug.get(t.slug) }),
  });
  if (r.ok) ok++; else { fail++; if (fail <= 3) console.log("  fail", t.slug, r.status); }
}
console.log(`updated ${ok}, failed ${fail}`);
