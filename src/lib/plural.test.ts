import { describe, it, expect } from "vitest";
import { countOf } from "./plural";

/**
 * Written before the fix, from a defect seen on the live cart:
 *
 *     Subtotal (1 items)
 *
 * on the screen a customer reads immediately before paying. Trivial to look at,
 * but it is on the money path, and the same shape existed in three other places
 * — every one of them `{n} things` with no branch for n === 1.
 *
 * A helper plus this test is the only version that stops the fourth one
 * appearing: correcting the three strings fixes today and prevents nothing.
 */
describe("countOf", () => {
  it("uses the singular for exactly one — the bug that was on the live cart", () => {
    expect(countOf(1, "item")).toBe("1 item");
  });

  it("uses the plural for zero and for many", () => {
    expect(countOf(0, "item")).toBe("0 items");
    expect(countOf(2, "item")).toBe("2 items");
    expect(countOf(41, "item")).toBe("41 items");
  });

  it("takes an explicit plural where adding s is wrong", () => {
    expect(countOf(1, "entry", "entries")).toBe("1 entry");
    expect(countOf(3, "entry", "entries")).toBe("3 entries");
  });

  it("does not treat -1 as singular", () => {
    // Guarding the sloppy `n === 1 ? a : b` written as `Math.abs(n) === 1`.
    expect(countOf(-1, "item")).toBe("-1 items");
  });

  it("formats thousands the way the rest of the shop does", () => {
    expect(countOf(1000, "item")).toBe("1,000 items");
  });
});
