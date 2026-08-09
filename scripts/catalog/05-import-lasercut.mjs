/**
 * Import the made-to-order laser-cut range and retire the dropship catalog.
 *
 *   node scripts/catalog/05-import-lasercut.mjs [--dry]
 *
 * Steps:
 *   1. copy each product's 3 images into public/images/lasercut/<slug>-{0,1,2}.<ext>
 *   2. hide all existing products (hidden = true, nothing is deleted)
 *   3. upsert the 41 new products at a flat AED 15
 *
 * The old catalog is hidden rather than removed: it is the only record of what
 * was sold before, and orders in the database still reference those slugs.
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import path from "path";

const SRC = "C:/Users/user/Desktop/lasercut/a-ready-for-lebon-grace-website";
const OUT = "public/images/lasercut";
const DRY = process.argv.includes("--dry");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
};

const spec = JSON.parse(readFileSync("scripts/catalog/products-lasercut.json", "utf8"));
const PRICE = spec.price;

if (!DRY) mkdirSync(OUT, { recursive: true });

// ── 1. images ──
let copied = 0, missing = [];
const imageMap = {};
for (const p of spec.products) {
  const dir = p.sub
    ? path.join(SRC, p.folder, "for-lebon-grace-website", p.sub)
    : path.join(SRC, p.folder, "for-lebon-grace-website");
  if (!existsSync(dir)) { missing.push(p.slug + " (no dir)"); continue; }

  const files = readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (!files.length) { missing.push(p.slug + " (no images)"); continue; }

  imageMap[p.slug] = files.slice(0, 3).map((f, i) => {
    const ext = path.extname(f).toLowerCase();
    const dest = `${p.slug}-${i}${ext}`;
    if (!DRY) copyFileSync(path.join(dir, f), path.join(OUT, dest));
    copied++;
    return `/images/lasercut/${dest}`;
  });
}
console.log(`images: ${copied} copied into ${OUT}`);
if (missing.length) console.log("  MISSING:", missing.join(", "));

// ── 2. retire the dropship catalog ──
if (!DRY) {
  // Only retire the dropship range. Without the cj_pid filter this also hides
  // anything added since (the clearance listing), and re-running the import
  // would silently pull it off the site.
  const r = await fetch(`${SB}/rest/v1/products?hidden=is.false&cj_pid=not.is.null`, {
    method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ hidden: true }),
  });
  console.log(r.ok ? "hid all existing products" : `hide failed ${r.status}`);
}

// ── 3. upsert the new range ──
const rows = spec.products.filter((p) => imageMap[p.slug]).map((p) => ({
  slug: p.slug,
  // Explicit names: title-casing a slug produced "Abc Jigsaw Board" and
  // "Montessori 3d Layer Puzzle".
  name: p.name || titleFrom(p.slug),
  price: PRICE,
  category: p.category,
  stock: 999,                       // made to order: never out of stock
  image_url: imageMap[p.slug][0],
  description: `${p.hook}\n\n${p.desc}`,
  details: {
    material: "3mm MDF, sanded by hand",
    // Printed on the third photograph of each product; see _dimensions_note.
    ...(p.dim ? { dimensions: p.dim } : {}),
    age: p.age,
    made: "Made to order in 2 to 3 working days",
    personalisation: "Add a name free of charge, just ask at checkout",
    images: imageMap[p.slug],
  },
  image_placeholder: { bg: "#C9A96E", initials: titleFrom(p.slug).slice(0, 2).toUpperCase() },
  hidden: false,
  cj_pid: null,
  cj_price: null,
}));

function titleFrom(slug) {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

console.log(`\nprepared ${rows.length} products at AED ${PRICE}`);
rows.slice(0, 5).forEach((r) => console.log(`  ${r.slug.padEnd(34)} ${r.category}`));

if (DRY) { console.log("\nDRY RUN, nothing written"); process.exit(0); }

const res = await fetch(`${SB}/rest/v1/products?on_conflict=slug`, {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(rows),
});
console.log(res.ok ? `imported ${rows.length} products` : `import failed ${res.status} ${(await res.text()).slice(0, 300)}`);
console.log("next: node scripts/catalog/04-generate-catalog.mjs, then rebuild");
