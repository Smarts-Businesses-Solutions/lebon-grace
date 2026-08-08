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
  it("keys a plain item by its slug", () => {
    expect(lineId(line(puzzle))).toBe("abc-jigsaw-board");
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
