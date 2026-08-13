import { describe, it, expect } from "vitest";
import { normaliseOrderRef, uuidPrefixRange } from "./order-lookup";

/**
 * The shop tells the customer one number and then refuses to accept it.
 *
 * Order ids are UUIDs — c6568cbb-c503-4b91-924f-39ccd7cf135c — but every
 * customer-facing surface shows `slice(0, 8)` with a hash in front: the
 * confirmation e-mail, the success page, /account and the operator alert all
 * say "#c6568cbb".
 *
 * /track sent that string through unchanged and the lookup did an exact match,
 * so the FIRST REAL ORDER placed on the live shop could not be tracked with the
 * number the shop had just given the customer. Every customer would hit it.
 */
describe("normaliseOrderRef", () => {
  const FULL = "c6568cbb-c503-4b91-924f-39ccd7cf135c";

  it("accepts the short reference the shop actually prints", () => {
    expect(normaliseOrderRef("#c6568cbb")).toBe("c6568cbb");
  });

  it("accepts it without the hash", () => {
    expect(normaliseOrderRef("c6568cbb")).toBe("c6568cbb");
  });

  it("accepts the full uuid unchanged", () => {
    expect(normaliseOrderRef(FULL)).toBe(FULL);
  });

  it("tolerates what people actually paste", () => {
    // Copied out of an e-mail, so leading/trailing space and capitals happen.
    expect(normaliseOrderRef("  #C6568CBB  ")).toBe("c6568cbb");
    expect(normaliseOrderRef("Order #c6568cbb")).toBe("c6568cbb");
  });

  it("returns empty for junk rather than a wildcard", () => {
    // A blank or symbol-only reference must not become a prefix that matches
    // the first order in the table.
    for (const bad of ["", "   ", "#", "###", "order"]) {
      expect(normaliseOrderRef(bad), `should not match: ${bad}`).toBe("");
    }
  });

  it("never returns something shorter than 8 characters", () => {
    // A 2-character prefix would match many orders; the phone check is the
    // credential, but the reference should still identify one order.
    expect(normaliseOrderRef("#c65")).toBe("");
  });
});

describe("uuidPrefixRange", () => {
  /**
   * The first fix shipped and did not work.
   *
   * It matched a short reference with `.ilike("id", "c6568cbb%")`, but `id` is a
   * uuid COLUMN and Postgres has no ilike for uuid:
   *   operator does not exist: uuid ~~* unknown
   * PostgREST returned an error, the code read that as "no rows" and answered
   * 404 — so the bug looked fixed in unit tests and still failed on the live
   * site with the real order.
   *
   * uuid comparison is bytewise, so a hex prefix maps to a contiguous range.
   * That is exact, needs no cast, and uses the primary key index.
   */
  it("brackets every uuid starting with the printed reference", () => {
    const { low, high } = uuidPrefixRange("c6568cbb")!;
    expect(low).toBe("c6568cbb-0000-0000-0000-000000000000");
    expect(high).toBe("c6568cbb-ffff-ffff-ffff-ffffffffffff");
    // the real order must fall inside it
    const real = "c6568cbb-c503-4b91-924f-39ccd7cf135c";
    expect(real >= low && real <= high).toBe(true);
  });

  it("excludes a uuid that merely looks similar", () => {
    const { low, high } = uuidPrefixRange("c6568cbb")!;
    const other = "c6568cbc-0000-0000-0000-000000000000";
    expect(other >= low && other <= high).toBe(false);
  });

  it("handles a longer partial reference", () => {
    const { low } = uuidPrefixRange("c6568cbb-c503")!;
    expect(low).toBe("c6568cbb-c503-0000-0000-000000000000");
  });

  it("returns null for a full uuid — that is an exact lookup, not a range", () => {
    expect(uuidPrefixRange("c6568cbb-c503-4b91-924f-39ccd7cf135c")).toBeNull();
  });

  it("returns null for anything that is not hex", () => {
    expect(uuidPrefixRange("zzzzzzzz")).toBeNull();
  });
});
