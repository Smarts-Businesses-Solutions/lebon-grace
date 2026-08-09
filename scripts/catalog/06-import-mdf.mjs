/**
 * Import the MDF range (cutouts, DIY kits, kids toys, home decor) into Postgres.
 *
 *   node scripts/catalog/06-import-mdf.mjs [--dry] [--hidden]
 *
 * Postgres is the single source of truth for the catalog, so this writes there
 * and nowhere else. data/mdf-products.json is the authored input; the storefront
 * never reads it. After this runs:
 *
 *   node scripts/catalog/04-generate-catalog.mjs   # emit products.generated.ts
 *   bash ../ops/selfhost/scripts/build-apps.sh lebon-grace
 *
 * Two things this deliberately does NOT copy from the source JSON:
 *
 *   cjPid / cjPrice — the JSON carries invented ids ("MDF-001", price "0").
 *     They look harmless but they are load-bearing: 05-import-lasercut.mjs
 *     retires the old dropship range with `?hidden=is.false&cj_pid=not.is.null`,
 *     meaning "visible AND sourced from CJ". Writing a cj_pid onto an in-house
 *     MDF product puts it inside that filter, so the next lasercut import would
 *     silently pull all of these off the site. cj_pid means "this came from CJ";
 *     these are cut in the workshop, so it stays null and the invariant holds
 *     (verified: no visible product carries a cj_pid).
 *
 *   any product whose image is missing or blank — see below.
 */
import { readFileSync, existsSync, statSync } from "fs";

const DRY = process.argv.includes("--dry");
// Import retired rather than live when you want to stage a batch and review it
// on the site before customers see it.
const HIDDEN = process.argv.includes("--hidden");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const spec = JSON.parse(readFileSync("data/mdf-products.json", "utf8"));

// ── image validation ──
//
// These images are generated, and generation fails quietly: one of them
// (mdf-alphabet-puzzle-hero.png) is a 4096x4096 field of pure white. A missing
// file is obvious on the site; a blank one is not — it renders as an empty
// product card that looks like a broken layout rather than a missing asset.
// So a product is only imported if its image exists AND carries actual detail.
//
// sharp arrives transitively with Next rather than as a direct dependency, so
// treat it as optional: without it we still catch missing and zero-byte files,
// and we say plainly that the blank check was skipped rather than implying a
// clean bill of health.
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* optional */ }
if (!sharp) console.log("note: sharp unavailable — checking existence only, NOT blankness");

async function imageProblem(publicPath) {
  const fp = "public" + publicPath;
  if (!existsSync(fp)) return "missing";
  if (statSync(fp).size === 0) return "zero bytes";
  if (!sharp) return null;
  try {
    // stdev over the greyscale image: a solid colour has ~0 variation.
    const { channels } = await sharp(fp).greyscale().stats();
    if (channels[0].stdev < 3) return `blank (stdev ${channels[0].stdev.toFixed(2)})`;
  } catch (e) {
    return "unreadable: " + String(e.message).slice(0, 60);
  }
  return null;
}

const rows = [];
const skipped = [];
for (const p of spec) {
  const problem = await imageProblem(p.imageUrl);
  if (problem) { skipped.push(`${p.slug} — ${problem}`); continue; }
  rows.push({
    slug: p.slug,
    name: p.name,
    price: p.price,
    category: p.category,
    stock: p.stock ?? 100,
    image_url: p.imageUrl,
    description: p.description,
    // `images` is what the product gallery reads. Each MDF product has a single
    // photograph, so the gallery is an array of one rather than absent — the
    // detail page then takes the same code path as the laser-cut range.
    details: { ...(p.details || {}), images: [p.imageUrl] },
    image_placeholder: { bg: "#C9A96E", initials: initials(p.name) },
    hidden: HIDDEN,
    cj_pid: null,
    cj_price: null,
  });
}

function initials(name) {
  return String(name || "?").replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "MD";
}

const byCategory = {};
for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + 1;

console.log(`\nprepared ${rows.length} of ${spec.length} products${HIDDEN ? " (hidden)" : ""}`);
for (const [c, n] of Object.entries(byCategory).sort()) console.log(`  ${c.padEnd(16)} ${n}`);
const prices = rows.map((r) => r.price).sort((a, b) => a - b);
if (prices.length) console.log(`  price range      AED ${prices[0]} – ${prices[prices.length - 1]}`);
if (skipped.length) {
  console.log(`\nSKIPPED ${skipped.length} (not imported):`);
  skipped.forEach((s) => console.log("  " + s));
}

if (DRY) { console.log("\nDRY RUN, nothing written"); process.exit(0); }
if (!rows.length) { console.error("\nrefusing to run: nothing passed validation"); process.exit(1); }

const res = await fetch(`${SB}/rest/v1/products?on_conflict=slug`, {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(rows),
});
if (!res.ok) { console.error(`\nimport failed ${res.status}: ${(await res.text()).slice(0, 400)}`); process.exit(1); }
console.log(`\nimported ${rows.length} products`);
console.log("next: node scripts/catalog/04-generate-catalog.mjs, then build-apps.sh lebon-grace");
