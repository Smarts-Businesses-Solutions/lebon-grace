import { describe, it, expect } from "vitest";
import { products, getProductBySlug, getProductsByCategory } from "./products";

/**
 * Unlisted products: buyable by direct URL, invisible in the shop.
 *
 * The live shop takes payments, and the only way to prove the money path works
 * end to end is to buy something. `internal-test-item` at AED 2 exists so that
 * can be repeated after every deploy instead of being a one-off before launch.
 * (AED 2, not 1, because Stripe refuses charges under 2.00 AED.)
 *
 * The safety property is the whole point: `products` is the LISTED set, so every
 * listing, search, sitemap and homepage tile — ~99 usages — excludes unlisted
 * items by default. Only an explicit slug lookup finds one. These tests pin
 * that, because the failure mode is an internal item appearing in a real
 * customer's shop.
 */

const TEST_SLUG = "internal-test-item";

describe("the unlisted test product", () => {
  it("exists and is priced above Stripe's AED minimum", () => {
    const p = getProductBySlug(TEST_SLUG);
    expect(p, "the test item must be resolvable by slug").toBeDefined();
    // Below 2.00 AED Stripe rejects the charge outright, so the test order
    // would never reach the webhook and would prove nothing.
    expect(p!.price).toBeGreaterThanOrEqual(2);
  });

  it("is NOT in the browsable catalogue", () => {
    expect(products.some((p) => p.slug === TEST_SLUG)).toBe(false);
  });

  it("is not in any category listing", () => {
    const p = getProductBySlug(TEST_SLUG)!;
    for (const cat of ["All", p.category]) {
      expect(
        getProductsByCategory(cat).some((x) => x.slug === TEST_SLUG),
        `leaked into category listing: ${cat}`
      ).toBe(false);
    }
  });
});

describe("the listed catalogue", () => {
  it("still contains real products", () => {
    // PRECONDITION. Every "is not present" assertion above would pass on an
    // empty catalogue, which is the exact absence-only trap worth guarding.
    expect(products.length).toBeGreaterThan(30);
  });

  it("contains no unlisted products at all", () => {
    const leaked = products.filter((p) => p.unlisted).map((p) => p.slug);
    expect(leaked, `unlisted products leaked into the shop: ${leaked.join(", ")}`).toEqual([]);
  });

  it("still resolves an ordinary product by slug", () => {
    // getProductBySlug now searches a wider set than `products`; prove that did
    // not break the normal case.
    const ordinary = products[0];
    expect(getProductBySlug(ordinary.slug)?.slug).toBe(ordinary.slug);
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getProductBySlug("no-such-product-xyz")).toBeUndefined();
  });
});
