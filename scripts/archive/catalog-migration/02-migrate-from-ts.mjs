/**
 * Phase 2b step 2 — migrate the fields that live ONLY in src/lib/products.ts
 * into Postgres: details (material/weight/dimensions/care), imagePlaceholder,
 * and the `hidden` flags.
 *
 * No CJ API calls. Only touches slugs that already exist in Postgres (515), so
 * the 36 duplicate "-N" slugs are intentionally NOT imported — Postgres stays
 * authoritative.
 *
 * Idempotent: re-running just re-writes the same values.
 *
 * Run:  node scripts/catalog/02-migrate-from-ts.mjs [--dry]
 */
import { readFileSync } from "fs";

const DRY = process.argv.includes("--dry");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

// ── Parse products.ts ────────────────────────────────────────────────────────
// The catalog is a literal TS array; parse each entry's fields with targeted
// regexes rather than eval'ing the module (it's TS, and we want no side effects).
const src = readFileSync("src/lib/products.ts", "utf8");
const entries = src.split(/\n  \{ slug: "/).slice(1);

function jsonish(block, key) {
  // details: { dimensions?: "...", material: "...", care?: "...", weight?: "..." }
  const m = block.match(new RegExp(key + ":\\s*\\{([^}]*)\\}"));
  if (!m) return null;
  const obj = {};
  for (const pair of m[1].split(/,(?![^"]*"\s*[,}])/)) {
    const kv = pair.match(/\s*(\w+):\s*"([^"]*)"/);
    if (kv) obj[kv[1]] = kv[2];
  }
  return Object.keys(obj).length ? obj : null;
}

const parsed = [];
for (const block of entries) {
  const slug = block.match(/^([^"]+)"/)?.[1];
  if (!slug) continue;
  const head = block.slice(0, 1400); // fields live near the top of each entry
  parsed.push({
    slug,
    details: jsonish(head, "details"),
    image_placeholder: jsonish(head, "imagePlaceholder"),
    hidden: /hidden:\s*true/.test(head),
  });
}
console.log(`parsed ${parsed.length} entries from products.ts`);

// ── Fetch the authoritative slug set from Postgres ───────────────────────────
const pgRes = await fetch(`${SB}/rest/v1/products?select=slug&limit=2000`, { headers: H });
const pgSlugs = new Set((await pgRes.json()).map((r) => r.slug));
console.log(`postgres has ${pgSlugs.size} products`);

const toUpdate = parsed.filter((p) => pgSlugs.has(p.slug) && (p.details || p.image_placeholder || p.hidden));
const skipped = parsed.filter((p) => !pgSlugs.has(p.slug));
console.log(`will update ${toUpdate.length} rows; skipping ${skipped.length} slugs not in Postgres (duplicates/hidden-only)`);

if (DRY) {
  console.log("DRY RUN — sample:", JSON.stringify(toUpdate.slice(0, 2), null, 2));
  process.exit(0);
}

// ── Apply (PATCH per slug; small catalog, keeps it simple and restartable) ───
let ok = 0, fail = 0, hiddenCount = 0;
for (const p of toUpdate) {
  const body = {};
  if (p.details) body.details = p.details;
  if (p.image_placeholder) body.image_placeholder = p.image_placeholder;
  body.hidden = p.hidden;
  if (p.hidden) hiddenCount++;
  const r = await fetch(`${SB}/rest/v1/products?slug=eq.${encodeURIComponent(p.slug)}`, {
    method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body),
  });
  if (r.ok) ok++; else { fail++; if (fail <= 3) console.log("  fail", p.slug, r.status, (await r.text()).slice(0, 120)); }
}
console.log(`updated ${ok}, failed ${fail}, marked hidden ${hiddenCount}`);
