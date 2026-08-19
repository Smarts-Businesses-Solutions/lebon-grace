import { describe, it, expect } from "vitest";
import { generateReference } from "./design-requests";

/**
 * The reference is the handle a customer reads out on WhatsApp and the operator
 * types back. Its properties are the whole point of it, so they are asserted
 * rather than assumed.
 *
 * The database access functions are not unit tested here: they are thin
 * PostgREST calls, and a test that mocks the client would only assert that the
 * mock was called. The real coverage for those is the route tests and the
 * migration validated against the live schema.
 */

describe("generateReference", () => {
  it("is prefixed and the right shape", () => {
    expect(generateReference()).toMatch(/^LG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("omits the characters people mishear and mistype", () => {
    /*
     * 0/O and 1/I/L. Every one of those pairs costs the operator a round trip
     * to find the right row, on a channel where the customer is typing on a
     * phone. Checked across many samples because a single reference could miss
     * the banned set by luck.
     */
    const banned = /[01OIL]/;
    for (let i = 0; i < 2000; i++) {
      expect(generateReference().slice(3)).not.toMatch(banned);
    }
  });

  it("does not repeat, which is what the unique index is protecting", () => {
    // 31^6 is about 887 million, so 5000 draws colliding would mean the
    // generator is not random rather than that we were unlucky.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateReference());
    expect(seen.size).toBe(5000);
  });

  it("uses the full alphabet rather than a lazy subset", () => {
    // Guards against a future edit that swaps randomInt for something biased,
    // or truncates the alphabet by accident.
    const chars = new Set<string>();
    for (let i = 0; i < 5000; i++) for (const c of generateReference().slice(3)) chars.add(c);
    expect(chars.size).toBe(31);
  });
});
