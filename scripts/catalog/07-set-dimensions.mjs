/**
 * Set `details.dimensions` on the made-to-order range.
 *
 *   node scripts/catalog/07-set-dimensions.mjs [--dry]
 *
 * Where these numbers come from
 * -----------------------------
 * Each product's THIRD photograph carries its size printed onto the image —
 * "196mm x 149mm" and so on. That was the only record: 40 of the 42 visible
 * products had no dimensions in Postgres, so the product page showed material
 * and weight and went silent on the one question a customer actually asks about
 * a physical toy.
 *
 * The values below were read off those photographs (the unwatermarked copies in
 * originals/images/lasercut/) and are kept here so the work is reproducible
 * without doing it again. Postgres remains the source of truth; this script
 * exists to re-apply after a restore, or to diff against if a photo is replaced.
 *
 * Two products from that pass are deliberately absent:
 *
 *   duck-shape-board — its third photograph carries no printed size at all.
 *     Left without dimensions rather than estimated from the image. A wrong
 *     measurement on a physical product is worse than an absent one, and the
 *     product page simply omits the row.
 *
 *   phone-case-clearance — not part of the made-to-order range.
 *
 * One value is worth re-checking against a physical piece:
 *
 *   shape-peg-board — "45mm x 135mm". Unlike every other caption this one sits
 *     to the RIGHT with a dimension arrow rather than top-left, and the board in
 *     the photograph reads wider than tall, so the pair may be height-then-width
 *     rather than the width-then-height the rest of the range uses. Recorded
 *     verbatim as printed rather than silently reordered.
 */
import { readFileSync } from "fs";

const DRY = process.argv.includes("--dry");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error("missing Supabase env in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const DIMENSIONS = {
  "abc-jigsaw-board": "196mm x 149mm",
  "alphabet-car-puzzle": "190mm x 103mm",
  "alphabet-fish-puzzle": "195mm x 130mm",
  "alphabet-learning-board": "190mm x 171mm",
  "alphabet-snail-puzzle": "196mm x 155mm",
  "bear-alphabet-puzzle": "148mm x 196mm",
  "build-a-house-3d-puzzle": "130mm x 156mm",
  "cement-mixer-shape-puzzle": "175mm x 200mm",
  "colour-me-dinosaur-alphabet-puzzle": "130mm x 185mm",
  "count-and-match-number-board": "130mm x 200mm",
  "counting-hands-board-1": "200mm x 106mm",
  "counting-hands-board-2": "200mm x 106mm",
  "elephant-number-puzzle": "190mm x 133mm",
  "excavator-puzzle": "201mm x 175mm",
  "farmyard-animal-board": "157mm x 200mm",
  "first-animals-peg-board": "183mm x 132mm",
  "geometric-shape-board": "198mm x 192mm",
  "giraffe-number-puzzle": "93mm x 201mm",
  "heart-tangram-nine-pieces": "130mm x 130mm",
  "little-builders-tool-set-puzzle": "130mm x 86mm",
  "montessori-3d-layer-puzzle": "130mm x 130mm",
  "number-maths-peg-board": "195mm x 195mm",
  "owl-number-tower-puzzle": "161mm x 195mm",
  "rocket-number-puzzle": "197mm x 99mm",
  "sea-creatures-peg-board": "128mm x 117mm",
  "shape-peg-board": "45mm x 135mm",
  "shape-stencil-set": "169mm x 234mm",
  "solar-system-peg-puzzle": "175mm x 134mm",
  "stacking-animal-friends-3d": "143mm x 99mm",
  "teddy-bear-layer-board": "128mm x 128mm",
  "toddler-alphabet-board": "196mm x 131mm",
  "tractor-shape-puzzle": "201mm x 139mm",
  "truck-peg-puzzle-1": "130mm x 130mm",
  "truck-peg-puzzle-2": "130mm x 123mm",
  "truck-peg-puzzle-3": "130mm x 135mm",
  "truck-peg-puzzle-4": "198mm x 198mm",
  "truck-peg-puzzle-5": "130mm x 75mm",
  "truck-peg-puzzle-6": "129mm x 89mm",
  "vehicles-peg-board": "130mm x 73mm",
  "watermelon-maths-game": "195mm x 195mm",
};

const entries = Object.entries(DIMENSIONS);
const bad = entries.filter(([, v]) => !/^\d{2,3}mm x \d{2,3}mm$/.test(v));
if (bad.length) { console.error("malformed values:", bad); process.exit(1); }
console.log(`${entries.length} dimensions to apply${DRY ? " (dry run)" : ""}`);
if (DRY) process.exit(0);

let ok = 0, missing = [];
for (const [slug, value] of entries) {
  const res = await fetch(`${SB}/rest/v1/products?slug=eq.${slug}&select=details`, { headers: H });
  const rows = await res.json();
  if (!rows.length) { missing.push(slug); continue; }
  // Read-modify-write: `details` is an open jsonb object carrying age, images,
  // material and personalisation too, so it must be merged rather than replaced.
  const details = { ...(rows[0].details || {}), dimensions: value };
  const put = await fetch(`${SB}/rest/v1/products?slug=eq.${slug}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ details }),
  });
  if (put.ok) ok++; else console.error(`  failed ${slug}: ${put.status}`);
}
console.log(`applied ${ok} of ${entries.length}`);
if (missing.length) console.log("  not in database:", missing.join(", "));
console.log("next: node scripts/catalog/04-generate-catalog.mjs, then build-apps.sh lebon-grace");
