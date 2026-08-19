import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { sanitiseArtwork, MAX_ARTWORK_BYTES } from "./artwork";

/**
 * The upload sanitiser is the only thing between the public internet and a file
 * the operator will later open. These tests assert the properties it exists
 * for, not that the code runs.
 *
 * The important ones are the hostile cases. A test suite that only feeds it
 * valid JPEGs proves nothing about the job it was written to do.
 */

const jpeg = (w = 40, h = 30) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#c9a96e" } })
    .jpeg()
    .toBuffer();

describe("sanitiseArtwork accepts real images", () => {
  it("re-encodes a JPEG and reports its dimensions", async () => {
    const r = await sanitiseArtwork(await jpeg(120, 80));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contentType).toBe("image/jpeg");
    expect(r.width).toBe(120);
    expect(r.height).toBe(80);
    expect(r.bytes).toBeGreaterThan(0);
  });

  it("converts PNG to JPEG, so downstream has one format to handle", async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#23201c" } })
      .png()
      .toBuffer();
    const r = await sanitiseArtwork(png);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contentType).toBe("image/jpeg");
  });

  it("returns a NEW buffer, never the caller's", async () => {
    const input = await jpeg();
    const r = await sanitiseArtwork(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.buffer.equals(input)).toBe(false);
  });
});

describe("sanitiseArtwork rejects what it must", () => {
  it("rejects HTML renamed to look like an image", async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>', "utf8");
    const r = await sanitiseArtwork(html);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("unrecognised");
  });

  it("rejects HTML hidden behind a JPEG magic number", async () => {
    /*
     * The case the signature check alone cannot catch, and the reason the
     * re-encode exists. A real JPEG header followed by a script payload passes
     * a naive sniff and fails to decode.
     */
    const forged = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('<script>alert(1)</script>'.repeat(20), "utf8"),
    ]);
    const r = await sanitiseArtwork(forged);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Either gate may catch it. What matters is that it never returns ok.
    expect(["unrecognised", "unsupported-type", "not-an-image"]).toContain(r.reason);
  });

  it("rejects SVG, which can carry script when viewed directly", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "utf8",
    );
    const r = await sanitiseArtwork(svg);
    expect(r.ok).toBe(false);
  });

  it("rejects a PDF", async () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n", "utf8"), Buffer.alloc(200, 0x20)]);
    const r = await sanitiseArtwork(pdf);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("unsupported-type");
  });

  it("rejects an empty file", async () => {
    const r = await sanitiseArtwork(Buffer.alloc(0));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("empty");
  });

  it("rejects anything over the cap before parsing it", async () => {
    const huge = Buffer.alloc(MAX_ARTWORK_BYTES + 1);
    const r = await sanitiseArtwork(huge);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("too-large");
  });
});

describe("sanitiseArtwork strips metadata", () => {
  it("removes EXIF, which on a phone photo carries GPS", async () => {
    /*
     * The privacy property, asserted rather than assumed. Customers photograph
     * their children; those files routinely carry coordinates and a device
     * serial. sharp drops metadata by default, and this test is what stops a
     * later "helpful" .withMetadata() silently reintroducing it.
     */
    const withExif = await sharp({
      create: { width: 60, height: 40, channels: 3, background: "#f7f3ec" },
    })
      .withExif({ IFD0: { Copyright: "test", Software: "test-suite" } })
      .jpeg()
      .toBuffer();

    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const r = await sanitiseArtwork(withExif);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await sharp(r.buffer).metadata()).exif).toBeUndefined();
  });

  it("keeps a portrait photo upright once its orientation tag is gone", async () => {
    // autoOrient must run BEFORE the tag is stripped, or the image lands
    // sideways and it looks like a viewer bug rather than a missing call.
    const rotated = await sharp({
      create: { width: 40, height: 90, channels: 3, background: "#4a7c59" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const r = await sanitiseArtwork(rotated);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Orientation 6 means "rotate 90 CW to display", so a 40x90 stored image
    // is a 90x40 displayed one.
    expect(r.width).toBe(90);
    expect(r.height).toBe(40);
  });
});
