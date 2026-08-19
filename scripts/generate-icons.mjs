/**
 * Draw the app icons the manifest points at.
 *
 * A script rather than three files someone once exported from a design tool,
 * because the mark is four numbers and a colour and will change again. Run it
 * and commit what it writes:
 *
 *   node scripts/generate-icons.mjs
 *
 * WHY NOT public/logo.svg. That file is the wordmark: 200x40, and it @imports
 * Inter from Google Fonts, which means rasterising it depends on a network
 * fetch that will not happen inside a renderer. public/favicon.svg is the right
 * source shape, but it hardcodes #2D2D2D rather than the brand ink, so the mark
 * is redrawn here from the design tokens instead of traced.
 *
 * TWO ICONS, NOT ONE. Android masks an icon to whatever shape the launcher
 * uses — circle, squircle, teardrop — and crops to a safe zone of the middle
 * 80%. An icon with its own rounded corners gets those corners cut off and its
 * content clipped. So:
 *
 *   icon-192 / icon-512   "any"       draws its own rounded rect
 *   icon-maskable-512     "maskable"  full bleed, mark small and centred
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public");
mkdirSync(OUT, { recursive: true });

// From src/app/globals.css. Kept literal rather than parsed: two constants are
// not worth a CSS parser, and a wrong colour here is visible immediately.
const INK = "#23201c";
const SAND = "#c9a96e";

/**
 * Georgia is not on the Linux box that builds this, and a missing family
 * renders as a blank box or a fallback nobody chose. `serif` resolves to
 * whatever serif the renderer does have, which is the point: the mark is two
 * letters in a serif, not two letters in one specific serif.
 */
const FACE = "Georgia, 'Times New Roman', serif";

/** The mark on its own rounded rect, edge to edge. */
const plain = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" rx="6" fill="${INK}"/>
  <text x="16" y="21" text-anchor="middle" font-family="${FACE}" font-size="15"
        font-weight="600" fill="${SAND}" letter-spacing="1">LG</text>
</svg>`;

/**
 * The same mark at 62% of the canvas, on a full-bleed square.
 *
 * 62% sits inside the 80% safe zone with room to spare. Sizing it AT the safe
 * zone means a circular launcher mask clips the letter edges, because the safe
 * zone is a circle and the text is a rectangle inscribed in it.
 */
const maskable = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" fill="${INK}"/>
  <text x="16" y="20" text-anchor="middle" font-family="${FACE}" font-size="11"
        font-weight="600" fill="${SAND}" letter-spacing="0.6">LG</text>
</svg>`;

const targets = [
  { file: "icon-192.png", size: 192, svg: plain },
  { file: "icon-512.png", size: 512, svg: plain },
  { file: "icon-maskable-512.png", size: 512, svg: maskable },
];

/*
 * Every icon is checked for the sand colour after it is written.
 *
 * The letters are the only sand in the image. If the renderer has no serif
 * face, or drops the text element entirely, the output is a plain dark square
 * that looks like a deliberate minimal icon and is in fact a failure. Nothing
 * about the file size or the exit code would say so.
 */
const near = (a, b) => Math.abs(a - b) <= 12;
const [SR, SG, SB] = [0xc9, 0xa9, 0x6e];

let bad = 0;

for (const { file, size, svg } of targets) {
  const out = path.join(OUT, file);
  await sharp(Buffer.from(svg(size))).png({ compressionLevel: 9 }).toFile(out);

  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  let sand = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (near(data[i], SR) && near(data[i + 1], SG) && near(data[i + 2], SB)) sand++;
  }
  const pct = (sand / (info.width * info.height)) * 100;

  if (pct < 1) {
    console.error(`FAIL  ${file}: ${pct.toFixed(2)}% sand pixels — the letters did not render`);
    bad = 1;
  } else {
    console.log(`ok    ${file}  ${size}x${size}  ${pct.toFixed(1)}% sand`);
  }
}

process.exitCode = bad;
