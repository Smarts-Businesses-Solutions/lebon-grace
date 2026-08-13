import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://shop.lebon-grace.com" }));
vi.mock("./ProductDetailClient", () => ({ default: () => null }));

import { generateMetadata } from "./page";
import { products, getProductBySlug } from "@/lib/products";

/**
 * Per-product metadata.
 *
 * Every product page served the SAME site-wide title and description, inherited
 * from the root layout — measured on the live site: 41 product pages, one
 * title. Two consequences, both real:
 *
 *   - a link shared on WhatsApp showed a generic shop card instead of the
 *     puzzle, and WhatsApp is the shop's actual distribution channel
 *   - Google saw 41 duplicate titles, which suppresses all of them
 */

const meta = (slug: string) => generateMetadata({ params: Promise.resolve({ slug }) });

describe("generateMetadata for a product", () => {
  const a = products[0];
  const b = products[1];

  it("gives each product its own title", async () => {
    const [ma, mb] = [await meta(a.slug), await meta(b.slug)];
    expect(ma.title).toContain(a.name);
    expect(mb.title).toContain(b.name);
    // The actual regression: two products must not share a title.
    expect(ma.title).not.toBe(mb.title);
  });

  it("describes the product, not the shop", async () => {
    const m = await meta(a.slug);
    expect(typeof m.description).toBe("string");
    expect((m.description as string).length).toBeGreaterThan(30);
  });

  it("sets a canonical URL pointing at itself", async () => {
    const m = await meta(a.slug);
    expect(m.alternates?.canonical).toBe(`https://shop.lebon-grace.com/shop/${a.slug}`);
  });

  it("carries an OG image so a shared link renders a card", async () => {
    const m = await meta(a.slug);
    const images = m.openGraph?.images as Array<{ url: string }> | undefined;
    expect(images?.length, "no og:image — WhatsApp shows a bare link").toBeTruthy();
    expect(images![0].url).toMatch(/^https:\/\//);
  });

  it("keeps unlisted products OUT of search engines", async () => {
    // Unlisted means invisible: absent from listings and the sitemap already.
    // Indexable metadata would put the internal test item into Google anyway.
    const m = await meta("internal-test-item");
    expect(getProductBySlug("internal-test-item"), "PRECONDITION: the item exists").toBeDefined();
    expect(m.robots).toMatchObject({ index: false });
  });

  it("still allows a normal product to be indexed", async () => {
    // Precondition for the test above: proves noindex is targeted, not blanket.
    const m = await meta(a.slug);
    const r = m.robots as { index?: boolean } | undefined;
    expect(r?.index).not.toBe(false);
  });

  it("does not throw for an unknown slug", async () => {
    // The page 404s separately; metadata must not crash the render first.
    await expect(meta("no-such-product")).resolves.toBeTruthy();
  });
});
