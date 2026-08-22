/**
 * Build the social preview cards, and refuse to emit one that will not render.
 *
 *   node scripts/generate-og-images.mjs
 *
 * WHY THIS EXISTS. Product pages already declared an og:image. It pointed at
 * the product photograph itself, and those photographs have a median weight of
 * 3.4 MB, up to 6.2 MB. WhatsApp will not build a large preview from an image
 * over roughly 600 KB, so the tag was present, correct, and produced nothing.
 * Every other page declared no image at all.
 *
 * That combination matters more here than it would elsewhere: this is a UAE
 * shop, WhatsApp is how a link actually travels, and a link that arrives as a
 * bare blue string is a link nobody taps.
 *
 * THE CONSTRAINTS, from Meta's own link-preview documentation:
 *   under ~600 KB          or the preview collapses to a small thumbnail
 *   1200x630               the standard card, and inside the 4:1 limit
 *   JPG, PNG or WebP       SVG and GIF are not rendered at all
 *   absolute URL in the tag
 *
 * Each output is measured against those before it is accepted. A generator that
 * writes a 2 MB card and exits 0 has produced exactly the bug it was written to
 * fix.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "og");
mkdirSync(OUT, { recursive: true });

const W = 1200;
const H = 630;
const MAX_BYTES = 600 * 1024;
const BAND = 132;

// From globals.css.
const PAPER = "#f7f3ec";
const INK = "#23201c";
const SAND = "#c9a96e";

/**
 * The band along the bottom that makes a card ours rather than a photograph.
 *
 * Drawn as one SVG composited over the image. Text is set in a generic serif
 * for the same reason the icon generator does it: the build box has no Georgia,
 * and a missing family renders as nothing at all.
 */
const band = (title) => {
  const safe = String(title)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 42);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="${H - BAND}" width="${W}" height="${BAND}" fill="${INK}"/>
  <text x="56" y="${H - 78}" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#fdfbf7">${safe}</text>
  <text x="56" y="${H - 34}" font-family="Georgia, 'Times New Roman', serif" font-size="24" fill="${SAND}">Lebon Grace  ·  AED 15, name engraved free</text>
</svg>`);
};

/**
 * Compose one card.
 *
 * `contain` rather than `cover`: these are photographs of cut boards, and
 * cropping to fill would slice letters off the edge of an alphabet puzzle,
 * which is the one thing the picture is meant to show.
 */
async function card(sourcePath, title, outFile) {
  const photo = sourcePath
    ? await sharp(sourcePath)
        .resize(W, H - BAND, { fit: "contain", background: PAPER })
        .toBuffer()
    : null;

  const layers = [];
  if (photo) layers.push({ input: photo, top: 0, left: 0 });
  layers.push({ input: band(title), top: 0, left: 0 });

  let quality = 82;
  let out;
  // Step the quality down rather than emit something over the limit.
  // Photographs of pale MDF on a pale ground compress well, so this rarely
  // loops, but "rarely" is not "never" and the limit is the point of the file.
  for (;;) {
    out = await sharp({ create: { width: W, height: H, channels: 3, background: PAPER } })
      .composite(layers)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= MAX_BYTES || quality <= 40) break;
    quality -= 8;
  }

  writeFileSync(path.join(OUT, outFile), out);
  return { bytes: out.length, quality };
}

/** slug, name and imageUrl for every catalogue entry, in source order. */
function catalogue() {
  const src = readFileSync(path.join(ROOT, "src", "lib", "products.generated.ts"), "utf8");
  const pattern = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?imageUrl:\s*"([^"]+)"/g;
  return [...src.matchAll(pattern)].map((m) => ({ slug: m[1], name: m[2], imageUrl: m[3] }));
}

const products = catalogue();
if (products.length === 0) {
  console.error("FAIL  parsed no products out of products.generated.ts");
  process.exit(1);
}

let failed = 0;

// The card every page that is not a product falls back to.
const heroSource = products
  .map((p) => path.join(ROOT, "public", p.imageUrl))
  .find((f) => existsSync(f) && !/\.svg$/i.test(f));

const def = await card(heroSource ?? null, "Puzzles for children", "default.jpg");
console.log(`  default.jpg  ${(def.bytes / 1024) | 0} KB  q${def.quality}`);

for (const p of products) {
  const src = path.join(ROOT, "public", p.imageUrl);
  // A missing or vector source is not an error: the card falls back to the
  // branded band on a plain ground, which still previews.
  const usable = existsSync(src) && !/\.svg$/i.test(p.imageUrl) ? src : null;
  const { bytes, quality } = await card(usable, p.name, `${p.slug}.jpg`);
  if (bytes > 400 * 1024) console.log(`  warn ${p.slug}.jpg  ${(bytes / 1024) | 0} KB  q${quality}`);
}

/*
 * Verify what was WRITTEN, not what was intended. Re-reading each file catches
 * a truncated write and a wrong canvas size, neither of which the loop above
 * can see from a buffer length.
 */
for (const f of [...products.map((p) => `${p.slug}.jpg`), "default.jpg"]) {
  const full = path.join(OUT, f);
  const size = statSync(full).size;
  const meta = await sharp(full).metadata();

  if (size > MAX_BYTES) {
    console.error(`FAIL  ${f} is ${(size / 1024) | 0} KB, over the 600 KB WhatsApp limit`);
    failed++;
  }
  if (meta.width !== W || meta.height !== H) {
    console.error(`FAIL  ${f} is ${meta.width}x${meta.height}, not ${W}x${H}`);
    failed++;
  }
}

console.log(`\n${products.length} product cards + 1 default, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
