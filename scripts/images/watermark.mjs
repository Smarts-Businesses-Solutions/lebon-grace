#!/usr/bin/env node
/**
 * Anti-crop watermarking for product photography.
 *
 * Why tiled rather than a corner badge
 * ------------------------------------
 * A single logo in one corner is removed by cropping that corner, which takes
 * about four seconds in any image editor. The point of this script is that the
 * mark repeats across the whole frame on a diagonal, so every region of the
 * image large enough to be worth stealing still carries a legible mark. To
 * remove it you have to crop down to something too small to use, or paint it
 * out by hand across the entire surface.
 *
 * Originals
 * ---------
 * This NEVER edits an image in place. Originals are copied to originals/images/
 * on first run and every watermark is rendered from there. That makes the
 * script idempotent — running it twice does not stack two watermarks — and it
 * means the clean files stay available for print, for a marketplace listing
 * that forbids watermarks, or for re-rendering with a different design later.
 *
 * Usage
 * -----
 *   node scripts/images/watermark.mjs            # watermark everything
 *   node scripts/images/watermark.mjs --check    # report only, change nothing
 *   node scripts/images/watermark.mjs --restore  # put the originals back
 */
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ORIGINALS = path.join(ROOT, "originals/images");
const SERVED = path.join(ROOT, "public/images");

// Only the ranges actually on sale. public/images/mdf holds photography for the
// retired dropship catalogue; those products are unpublished, so there is
// nothing to protect and no reason to churn 122 files through git.
const DIRS = ["lasercut", "clearance"];

const MARK = "lebon-grace.com";

/**
 * Builds a full-size SVG of repeating diagonal text.
 *
 * The mark is drawn twice per position: a dark stroke under a light fill. Our
 * photographs are pale wood on pale linen, but the clearance shots are dark
 * phone cases, and a single colour legible on one is invisible on the other.
 * The pair reads on both without having to know the image content.
 *
 * Spacing is derived from the image's own size rather than fixed in pixels, so
 * a 4080px clearance photo and a 1024px puzzle photo end up with a comparable
 * density of marks rather than one being covered and the other nearly bare.
 */
function overlaySvg(width, height) {
  const diag = Math.hypot(width, height);
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.028));
  const stepX = Math.round(fontSize * 17);
  // Row spacing is the setting that trades protection against how much of the
  // product you can see. At 8x the font size a mark lands roughly every 8% of
  // the frame's height, so any crop big enough to pass as a product photo still
  // contains one, while the puzzle underneath stays readable.
  const stepY = Math.round(fontSize * 8);

  const marks = [];
  // Start well outside the frame: the whole layer is rotated about the centre,
  // so the corners are only covered if the grid overhangs the edges.
  for (let y = -diag; y < diag; y += stepY) {
    // Offset every other row so the marks do not line up into visible columns,
    // which would leave clean vertical lanes an attacker could crop between.
    let rowOffset = ((y / stepY) % 2 === 0) ? 0 : stepX / 2;
    for (let x = -diag; x < diag; x += stepX) {
      marks.push(
        `<text x="${Math.round(x + rowOffset)}" y="${Math.round(y)}" class="m">${MARK}</text>`
      );
    }
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>
        .m {
          font-family: Helvetica, Arial, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 600;
          letter-spacing: ${(fontSize * 0.08).toFixed(2)}px;
          fill: #ffffff;
          fill-opacity: 0.22;
          stroke: #000000;
          stroke-opacity: 0.10;
          stroke-width: ${Math.max(1, fontSize * 0.045).toFixed(2)};
          paint-order: stroke fill;
        }
      </style>
      <g transform="rotate(-30 ${width / 2} ${height / 2})">${marks.join("")}</g>
    </svg>`
  );
}

async function listImages(dir) {
  const entries = await fs.readdir(dir).catch(() => []);
  return entries.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
}

/** Copies served images into originals/ the first time only. Never overwrites. */
async function preserveOriginals() {
  let copied = 0, already = 0;
  for (const d of DIRS) {
    await fs.mkdir(path.join(ORIGINALS, d), { recursive: true });
    for (const f of await listImages(path.join(SERVED, d))) {
      const dest = path.join(ORIGINALS, d, f);
      try {
        // 'wx' fails if it exists, so an original is captured once and is then
        // immutable. Without this a second run would archive the watermarked
        // copy over the clean one and the original would be gone for good.
        await fs.copyFile(path.join(SERVED, d, f), dest, fs.constants.COPYFILE_EXCL);
        copied++;
      } catch (e) {
        if (e.code === "EEXIST") already++;
        else throw e;
      }
    }
  }
  return { copied, already };
}

async function watermarkAll() {
  let done = 0;
  for (const d of DIRS) {
    for (const f of await listImages(path.join(ORIGINALS, d))) {
      const src = path.join(ORIGINALS, d, f);
      const out = path.join(SERVED, d, f);
      const meta = await sharp(src).metadata();
      const format = meta.format;

      // Cap the long edge before compositing.
      //
      // The photography came in at up to 4080px and 8.8MB a file, with 82 of
      // 129 over 1MB. Nothing on the site displays an image wider than about
      // 700 CSS pixels, so every one of those bytes was being downloaded and
      // thrown away — on mobile data, for a AED 15 product. MAX_EDGE still
      // leaves enough resolution for a retina product page.
      //
      // Resizing first also means the watermark is generated at final size, so
      // the mark stays crisp instead of being scaled down after rendering.
      const MAX_EDGE = 1600;
      const resized = sharp(src).resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });

      const { width, height } = await resized.toBuffer({ resolveWithObject: true })
        .then((r) => r.info);

      let pipeline = resized.composite([{ input: overlaySvg(width, height), top: 0, left: 0 }]);
      // Re-encode in the format the file already claims, so the extension on
      // disk keeps matching the bytes and the catalogue's imageUrl stays valid.
      pipeline = format === "png"
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.jpeg({ quality: 86, mozjpeg: true });

      const buf = await pipeline.toBuffer();
      await fs.writeFile(out, buf);
      done++;
    }
  }
  return done;
}

async function restore() {
  let n = 0;
  for (const d of DIRS) {
    for (const f of await listImages(path.join(ORIGINALS, d))) {
      await fs.copyFile(path.join(ORIGINALS, d, f), path.join(SERVED, d, f));
      n++;
    }
  }
  return n;
}

const mode = process.argv[2];

if (mode === "--check") {
  for (const d of DIRS) {
    const served = (await listImages(path.join(SERVED, d))).length;
    const orig = (await listImages(path.join(ORIGINALS, d))).length;
    console.log(`  ${d.padEnd(12)} served ${String(served).padStart(4)}   originals ${String(orig).padStart(4)}`);
  }
} else if (mode === "--restore") {
  console.log(`  restored ${await restore()} images from originals/`);
} else {
  const { copied, already } = await preserveOriginals();
  console.log(`  originals: ${copied} newly archived, ${already} already held`);
  console.log(`  watermarked ${await watermarkAll()} images`);
}
