/**
 * Cart line identity.
 *
 * `lineId` is small and looks obvious, which is why it is worth pinning: it is
 * the rule that stops two differently-engraved copies of the same puzzle from
 * collapsing into one line with quantity 2. If that regressed, the shop would
 * take payment for two personalised pieces and the workshop would see one —
 * the customer finds out when the wrong parcel arrives.
 *
 * ACTION_PLAN.md A-4.
 */
import { describe, it, expect } from "vitest";
import { lineId, UAE_DELIVERY, FREE_DELIVERY_OVER, type CartItem } from "./cart-context";
import type { Product } from "./products";

const puzzle = { slug: "abc-jigsaw-board", price: 15 } as Product;
const other = { slug: "alphabet-car-puzzle", price: 15 } as Product;
const line = (product: Product, personalisation?: string): CartItem =>
  ({ product, quantity: 1, personalisation });

describe("lineId", () => {
  it("keys a plain item by slug AND name", () => {
    // Was `slug` alone. Name joined it so that two variants of one product —
    // which share a slug and differ only in name — stop merging into a single
    // line. Pinned exactly, on purpose: this id decides what the customer is
    // charged for, so it should not drift without someone noticing.
    expect(lineId(line(puzzle))).toBe(`abc-jigsaw-board::${puzzle.name ?? ""}`);
  });

  it("keeps two different engravings of the same puzzle apart", () => {
    expect(lineId(line(puzzle, "Amira"))).not.toBe(lineId(line(puzzle, "Yousef")));
  });

  it("keeps an engraved copy apart from a plain one", () => {
    expect(lineId(line(puzzle, "Amira"))).not.toBe(lineId(line(puzzle)));
  });

  it("merges two identical engravings into one line", () => {
    expect(lineId(line(puzzle, "Amira"))).toBe(lineId(line(puzzle, "Amira")));
  });

  it("does not emit the literal \"undefined\" for a product with no name", () => {
    // Caught by the fixture, which has no name: the first version of this
    // change produced "abc-jigsaw-board::undefined", so every nameless product
    // would have collided on one id — the same merge bug, reintroduced.
    expect(lineId(line(puzzle))).not.toContain("undefined");
  });

  it("keeps two variants of the same product apart", () => {
    // Selecting a variant overrides name/image/price on the product object but
    // NOT the slug (ProductDetailClient.handleAddToCart), and lineId keyed on
    // slug alone — so picking variant A, adding, then variant B, adding, merged
    // them into ONE line of quantity 2 showing whichever was added first. The
    // customer would receive two of the wrong thing.
    //
    // Dormant today: zero VISIBLE products have variants and /api/variants
    // returns {"source":"none"}. This pins the contract so re-enabling variants
    // cannot quietly reintroduce it.
    const red = { ...puzzle, name: puzzle.name + " — Red" };
    const blue = { ...puzzle, name: puzzle.name + " — Blue" };
    expect(lineId(line(red))).not.toBe(lineId(line(blue)));
  });

  it("still merges genuinely identical lines", () => {
    // The other direction: the fix must not turn every add into a new line.
    expect(lineId(line(puzzle))).toBe(lineId(line(puzzle)));
  });


  it("keeps different products apart", () => {
    expect(lineId(line(puzzle))).not.toBe(lineId(line(other)));
  });

  it("treats an empty engraving as no engraving", () => {
    // Falsy personalisation must not produce a distinct "slug::" key, or an
    // unengraved item added twice would sit on two lines.
    expect(lineId(line(puzzle, ""))).toBe(lineId(line(puzzle)));
  });
});

describe("delivery constants", () => {
  it("charges AED 20 for UAE delivery, free over AED 150", () => {
    // Pinned because these appear in customer-facing copy in several places
    // (hero band, FAQ, terms, product page, cart). If the constant moves and
    // the copy does not, the shop quotes one price and charges another.
    expect(UAE_DELIVERY).toBe(20);
    expect(FREE_DELIVERY_OVER).toBe(150);
  });
});
