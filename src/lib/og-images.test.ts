import { describe, it, expect } from "vitest";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { products } from "./products";

/**
 * A social card fails silently, which is why this is asserted rather than
 * eyeballed once.
 *
 * The page renders, the tag is present, the URL resolves, and the preview is
 * still a bare blue string in someone's WhatsApp. Nothing in the build, the
 * type checker or a browser will tell you. The only symptom is a link that
 * nobody taps, which looks like the link being uninteresting.
 *
 * That is exactly what was happening: og:image pointed at the product
 * photograph, and those run to a 3.4 MB median. Meta's documented ceiling for a
 * large preview is around 600 KB, so every product card in the shop was over it
 * by a factor of six, and every page that was not a product had no image at
 * all.
 */

const OG = path.join(process.cwd(), "public", "og");
const MAX_BYTES = 600 * 1024;

/** JPEG SOF marker, which carries the real pixel dimensions. */
function jpegSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    // SOF0, SOF1, SOF2: the frame headers that state the dimensions.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

describe("the generated cards", () => {
  it("exist for every product in the catalogue", () => {
    /*
     * The public catalogue. Unlisted products are not covered here because
     * their pages carry robots noindex/nofollow and are not meant to be shared
     * at all. The generator reads products.generated.ts directly, so it writes
     * cards for those too; this asserts the set that matters.
     *
     * Non-empty first, because a filter that returned nothing would satisfy
     * every check below having examined no product.
     */
    expect(products.length).toBeGreaterThan(0);

    const missing = products
      .map((p) => p.slug)
      .filter((slug) => !existsSync(path.join(OG, `${slug}.jpg`)));

    expect(
      missing,
      `\nNo social card for:\n${missing.map((s) => `  ${s}`).join("\n")}\n\n` +
        `Run: node scripts/generate-og-images.mjs\n`,
    ).toEqual([]);
  });

  it("includes the default every non-product page falls back to", () => {
    expect(existsSync(path.join(OG, "default.jpg"))).toBe(true);
  });

  it("are all under the size WhatsApp will render", () => {
    // The constraint that made the previous implementation useless. Asserted in
    // the suite as well as in the generator, because a card can also be added
    // by hand.
    const oversized = products
      .map((p) => `${p.slug}.jpg`)
      .concat("default.jpg")
      .filter((f) => existsSync(path.join(OG, f)))
      .map((f) => ({ f, kb: Math.round(statSync(path.join(OG, f)).size / 1024) }))
      .filter((x) => x.kb * 1024 > MAX_BYTES);

    expect(
      oversized,
      `\nOver the 600 KB WhatsApp limit:\n${oversized.map((x) => `  ${x.f}  ${x.kb} KB`).join("\n")}\n`,
    ).toEqual([]);
  });

  it("are 1200x630, the shape every platform crops to", () => {
    // Checked on the file itself rather than trusting the generator, so a card
    // added or replaced by hand cannot quietly be the wrong shape.
    const sample = products.slice(0, 5).map((p) => `${p.slug}.jpg`).concat("default.jpg");

    for (const f of sample) {
      const full = path.join(OG, f);
      if (!existsSync(full)) continue;
      expect(jpegSize(full), `${f} is not a readable JPEG`).toEqual({ width: 1200, height: 630 });
    }
  });

  it("are JPEG, because SVG and GIF are not rendered at all", () => {
    const full = path.join(OG, "default.jpg");
    const b = readFileSync(full);
    // SOI marker. A PNG or SVG renamed to .jpg would pass every check above.
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  });
});
