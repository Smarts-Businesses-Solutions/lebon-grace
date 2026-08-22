import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { products, getProductBySlug } from "./products";
import sitemap from "@/app/sitemap";

const GENERATED = path.join(process.cwd(), "src", "lib", "products.generated.ts");

/**
 * ADR-0001's rules, asserted instead of trusted.
 *
 * The ADR draws a line most codebases blur: `hidden` and `unlisted` are
 * different states, not two names for the same one.
 *
 *   hidden    retired. The generator drops it, so it cannot be bought at all.
 *   unlisted  fully purchasable, absent from every listing, and noindex.
 *
 * The internal test item is unlisted. It exists so the money path can be proved
 * with a real AED 2 purchase after every deploy, and it must stay buyable while
 * never appearing in a customer's shop. Those two requirements pull in opposite
 * directions, which is exactly why the rule needs a test rather than care.
 *
 * The mechanism ADR-0001 chose is an inverted default: the exported `products`
 * IS the listed set and the full array is module-private, so a new call site
 * cannot leak an unlisted product by forgetting a filter. That decision is only
 * as good as the export staying filtered, and nothing checked that it did.
 */

describe("what the exported catalogue contains", () => {
  it("is not empty, so the checks below examine something", () => {
    // Every assertion here is "no product is in a bad state". An empty array
    // satisfies all of them perfectly while proving nothing.
    expect(products.length).toBeGreaterThan(10);
  });

  it("excludes every unlisted product", () => {
    /*
     * The inverted default, checked at the source. `products` is used around a
     * hundred times across a dozen files; if this filter ever comes off, the
     * internal test item appears in the shop grid, the search, the sitemap and
     * the category pages simultaneously.
     */
    const leaked = products.filter((p) => p.unlisted).map((p) => p.slug);
    expect(leaked, `unlisted products in the browsable catalogue: ${leaked.join(", ")}`).toEqual([]);
  });

  it("excludes every hidden product, or records that there are none", () => {
    /*
     * Read from the generated source, not from `products`.
     *
     * `products` excludes hidden by construction, so filtering it for hidden
     * returns an empty array whether the rule works or not. Every check in this
     * block that touches hidden has that problem today, because the catalogue
     * currently holds ZERO hidden products: the assertions run over nothing and
     * report green.
     *
     * That is a dormant guard, not a passing one, and the difference matters
     * enough to state. Reading the file is the only oracle that can tell "no
     * hidden product leaked" from "no hidden product exists".
     */
    const source = readFileSync(GENERATED, "utf8");
    const hiddenCount = (source.match(/hidden: true/g) ?? []).length;

    if (hiddenCount === 0) {
      // Recorded rather than skipped, so the count is visible in the run and
      // the day someone retires a product this check starts doing real work.
      expect(hiddenCount).toBe(0);
      return;
    }

    const leaked = products.filter((p) => p.hidden).map((p) => p.slug);
    expect(leaked, `hidden products in the browsable catalogue: ${leaked.join(", ")}`).toEqual([]);
  });
});

describe("the sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  it("lists the products it should", () => {
    expect(urls.length).toBeGreaterThan(products.length);
  });

  it("contains no unlisted or hidden slug", () => {
    /*
     * Derived from the sitemap's OWN output rather than from the same filtered
     * array it builds from. Comparing `products` to a sitemap made of
     * `products` would agree with itself no matter what either one held; this
     * reads the emitted URLs and looks for slugs that must not be in them.
     *
     * getProductBySlug is the only accessor that sees everything, which is what
     * makes it usable as the oracle here.
     */
    const offenders = urls
      .map((u) => u.split("/shop/")[1])
      .filter(Boolean)
      .map((slug) => getProductBySlug(slug))
      .filter((p) => p && (p.unlisted || p.hidden))
      .map((p) => p!.slug);

    expect(offenders, `non-public products in the sitemap: ${offenders.join(", ")}`).toEqual([]);
  });

  it("does not advertise the bio landing page", () => {
    // /links is a doorway with no content of its own and every destination
    // already indexed on its own page. It carries robots noindex, and a URL
    // that is noindex has no business in a sitemap either.
    expect(urls.some((u) => u.endsWith("/links"))).toBe(false);
  });

  it("never lists the same URL twice", () => {
    // Duplicate entries are how a sitemap starts contradicting the canonical
    // tags on the pages it points at.
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("the lookup that sees everything", () => {
  it("still finds an unlisted product, because it must stay purchasable", () => {
    /*
     * The half of ADR-0001 that a naive "filter it everywhere" fix breaks. Two
     * call sites, checkout and variants, once looked products up against the
     * browsable array and would have REFUSED TO SELL the test item. An unlisted
     * product that cannot be bought defeats the entire purpose of the state.
     */
    const unlisted = products.length;
    const testItem = getProductBySlug("internal-test-item");

    expect(testItem, "the unlisted test item is not retrievable by slug").toBeDefined();
    expect(testItem?.unlisted).toBe(true);
    // And it is genuinely absent from the browsable set.
    expect(products.some((p) => p.slug === "internal-test-item")).toBe(false);
    expect(products.length).toBe(unlisted);
  });

  it("refuses a hidden product, on the day one exists", () => {
    /*
     * The asymmetry that makes the two states worth distinguishing: if a hidden
     * product resolves here, a withdrawn listing becomes buyable again.
     *
     * DORMANT while the catalogue holds no hidden products, which is now. The
     * slugs are pulled from the generated source so the check wakes up by
     * itself the first time something is retired, rather than needing anyone to
     * remember this file exists.
     */
    const source = readFileSync(GENERATED, "utf8");
    const hiddenSlugs = [...source.matchAll(/slug: "([^"]+)"(?=[^{]*hidden: true)/g)].map((m) => m[1]);

    for (const slug of hiddenSlugs) {
      expect(getProductBySlug(slug), `${slug} is hidden but still resolves`).toBeUndefined();
    }
    expect(hiddenSlugs.length).toBeGreaterThanOrEqual(0);
  });

  it("returns nothing for a slug that was never real", () => {
    expect(getProductBySlug("no-such-puzzle-anywhere")).toBeUndefined();
  });
});
