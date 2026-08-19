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

  it("collides only at the rate randomness predicts, which the retry absorbs", () => {
    /*
     * This asserted 5000 distinct out of 5000 and was FLAKY, failing roughly
     * once in seventy runs. 31^6 is about 887 million, so by the birthday bound
     * 5000 draws collide about 1.4% of the time. That is the generator being
     * random, not broken, and a test that fails on correct behaviour teaches
     * people to rerun the suite until it passes.
     *
     * Perfect uniqueness was never the property worth asserting anyway. The
     * unique index is the guarantee and createDesignRequest retries on 23505.
     * What matters here is that the output is spread, not that it never repeats:
     * a generator returning one constant would fail this, and so would one with
     * a badly truncated range.
     */
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateReference());
    expect(seen.size).toBeGreaterThan(4990);
  });

  it("uses the full alphabet rather than a lazy subset", () => {
    // Guards against a future edit that swaps randomInt for something biased,
    // or truncates the alphabet by accident.
    const chars = new Set<string>();
    for (let i = 0; i < 5000; i++) for (const c of generateReference().slice(3)) chars.add(c);
    expect(chars.size).toBe(31);
  });
});
