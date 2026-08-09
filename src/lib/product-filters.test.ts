/**
 * Price-tier partitioning and the Clearance rule.
 *
 * The price predicate was inclusive at both ends until 2026-08-04, so tiers
 * overlapped at every boundary: a AED 5 product matched both "Under AED 5" and
 * "AED 5 – 10", and tier counts summed to more than the catalogue. It is
 * half-open now, and this pins that — boundary logic is exactly what regresses
 * silently, because nothing looks broken until someone counts.
 *
 * ACTION_PLAN.md A-4.
 */
import { describe, it, expect } from "vitest";
import {
  applyFilters,
  PRICE_TIERS,
  DEFAULT_FILTERS,
  CLEARANCE_CATEGORY,
  type EnrichedProduct,
  type FilterState,
} from "./product-filters";

/** Minimal products; only the fields the price/category rules read. */
const p = (slug: string, price: number, category = "Alphabet & Literacy"): EnrichedProduct =>
  ({ slug, name: slug, price, category, hidden: false } as EnrichedProduct);

const catalogue: EnrichedProduct[] = [
  p("a", 1), p("b", 2),                       // under 5
  p("c", 5), p("d", 8),                       // 5–10
  p("e", 10), p("f", 15), p("g", 19),         // 10–20
  p("h", 20), p("i", 25),                     // 20+
  p("clear", 5, CLEARANCE_CATEGORY),
  { ...p("hidden-one", 15), hidden: true } as EnrichedProduct,
];

const withTier = (min: number, max: number): FilterState =>
  ({ ...DEFAULT_FILTERS, priceMin: min, priceMax: max });

describe("price tiers", () => {
  it("partition the catalogue exactly — no product counted twice, none missed", () => {
    // The property that matters. If the predicate ever goes back to inclusive
    // at both ends, this sum exceeds the catalogue size and the test says so.
    const visible = catalogue.filter((x) => !x.hidden && x.category !== CLEARANCE_CATEGORY);
    const counts = PRICE_TIERS.map((t) => applyFilters(catalogue, withTier(t.min, t.max)).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(visible.length);
  });

  it("puts a boundary price in exactly one tier", () => {
    // AED 5 belongs to "AED 5 – 10", not also to "Under AED 5".
    const inTiers = PRICE_TIERS.filter((t) => 5 >= t.min && 5 < t.max);
    expect(inTiers).toHaveLength(1);
    expect(inTiers[0].min).toBe(5);
  });

  it("excludes the upper bound and includes the lower", () => {
    const slugs = applyFilters(catalogue, withTier(10, 20)).map((x) => x.slug);
    expect(slugs).toContain("e");     // 10 — included
    expect(slugs).toContain("g");     // 19 — included
    expect(slugs).not.toContain("h"); // 20 — belongs to the next tier
  });

  it("lets the open-ended top tier match everything above it", () => {
    const top = PRICE_TIERS.at(-1)!;
    const slugs = applyFilters(catalogue, withTier(top.min, top.max)).map((x) => x.slug);
    expect(slugs).toEqual(expect.arrayContaining(["h", "i"]));
  });
});

describe("visibility rules", () => {
  it("never returns a hidden product", () => {
    const all = applyFilters(catalogue, DEFAULT_FILTERS).map((x) => x.slug);
    expect(all).not.toContain("hidden-one");
  });

  it("keeps Clearance out of the All grid", () => {
    // Clearance is stock being emptied, not part of the made-to-order range.
    // It has its own category page; it must not sit between two puzzles.
    const all = applyFilters(catalogue, DEFAULT_FILTERS).map((x) => x.slug);
    expect(all).not.toContain("clear");
  });

  it("still shows Clearance when it is the selected category", () => {
    const only = applyFilters(catalogue, { ...DEFAULT_FILTERS, category: CLEARANCE_CATEGORY });
    expect(only.map((x) => x.slug)).toEqual(["clear"]);
  });
});
