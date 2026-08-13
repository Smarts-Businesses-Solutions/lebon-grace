import { describe, it, expect, beforeEach } from "vitest";
import { makeUnsubscribeToken, readUnsubscribeToken } from "./unsubscribe-token";

beforeEach(() => { process.env.ADMIN_SESSION_SECRET = "test-secret-for-unsubscribe"; });

describe("unsubscribe tokens", () => {
  it("round-trips an address", () => {
    const t = makeUnsubscribeToken("Buyer@Example.com");
    expect(readUnsubscribeToken(t)).toBe("buyer@example.com");
  });

  it("refuses a token signed for a DIFFERENT address", () => {
    // The attack the signature exists to stop: edit the payload, unsubscribe
    // somebody else. Splice a valid signature onto another address.
    const mine = makeUnsubscribeToken("victim@example.com");
    const sig = mine.slice(mine.lastIndexOf(".") + 1);
    const forged = `${Buffer.from("someone-else@example.com").toString("base64url")}.${sig}`;
    expect(readUnsubscribeToken(forged)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const t = makeUnsubscribeToken("buyer@example.com");
    expect(readUnsubscribeToken(t.slice(0, -1) + "0")).toBeNull();
  });

  it("refuses junk without throwing", () => {
    // A malformed token must 400, never 500 — this runs on a public endpoint.
    for (const bad of ["", "x", "....", "no-dot", "!!!.???"]) {
      expect(() => readUnsubscribeToken(bad)).not.toThrow();
      expect(readUnsubscribeToken(bad)).toBeNull();
    }
  });

  it("produces nothing when no secret is configured", () => {
    delete process.env.ADMIN_SESSION_SECRET;
    expect(makeUnsubscribeToken("a@b.com")).toBe("");
    expect(readUnsubscribeToken("anything.here")).toBeNull();
  });
});
