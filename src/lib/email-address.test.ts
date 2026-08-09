import { describe, it, expect } from "vitest";
import { isDeliverableEmail } from "./email-address";

/**
 * Written before the fix, from a defect found driving the live checkout.
 *
 * `a@b` reached the checkout API. HTML5 `type="email"` accepts it — the spec
 * does not require a TLD — the client's `validate()` only checked non-empty,
 * and the server did `String(email).trim().slice(0, 200)`.
 *
 * Why that is worse here than on a site with accounts: the confirmation email
 * is the ONLY place a customer receives their order number. Tracking needs
 * order-id + phone; the account lookup needs email + phone. Type the address
 * wrongly and you have paid for an order you cannot reach by any route the
 * site offers.
 *
 * The cases below are the ones that actually decide a validator. `a@b` and
 * `a@b.c` are the interesting pair: both are accepted by HTML5 and by Zod 3's
 * `.email()`, which is why swapping to Zod would NOT have fixed this.
 */
describe("isDeliverableEmail", () => {
  const valid = [
    "user@example.com",
    "first.last@example.com",
    "user+tag@example.com",          // plus-addressing: common on receipts
    "user@sub.example.co.uk",        // multi-label domain
    "x@example.com",                 // single-character local part is legal
    "user-name@example-site.com",
    "user@xn--nxasmq5b.com",         // IDN already punycoded
  ];
  for (const e of valid) {
    it(`accepts ${e}`, () => expect(isDeliverableEmail(e)).toBe(true));
  }

  const invalid: Array<[string, string]> = [
    ["", "empty"],
    ["   ", "whitespace only"],
    ["userexample.com", "no @"],
    ["@example.com", "no local part"],
    ["user@", "no domain"],
    ["a@b", "THE BUG — no TLD, accepted by HTML5 and by Zod 3 .email()"],
    ["a@b.c", "single-character TLD; none exist in the IANA root"],
    ["john..doe@example.com", "consecutive dots in the local part"],
    ["john@domain..com", "consecutive dots in the domain"],
    [".john@example.com", "leading dot"],
    ["john.@example.com", "trailing dot in the local part"],
    ["john@.example.com", "leading dot in the domain"],
    ["john@example.com.", "trailing dot — legal in DNS, rejected by mail forms"],
    ["john doe@example.com", "unquoted space"],
    ["john@doe@example.com", "two @ signs"],
    ["用户@example.com", "raw unicode local part — punycode it first"],
  ];
  for (const [e, why] of invalid) {
    it(`rejects ${JSON.stringify(e)} (${why})`, () =>
      expect(isDeliverableEmail(e)).toBe(false));
  }

  it("rejects addresses over the RFC 5321 length limits", () => {
    expect(isDeliverableEmail("a".repeat(65) + "@example.com")).toBe(false); // local > 64
    expect(isDeliverableEmail("a".repeat(250) + "@example.com")).toBe(false); // total > 254
  });

  it("accepts a local part at exactly the 64-character limit", () => {
    // Boundary in the other direction, so the limit is not simply "reject long".
    expect(isDeliverableEmail("a".repeat(64) + "@example.com")).toBe(true);
  });

  it("tolerates surrounding whitespace rather than rejecting the customer", () => {
    expect(isDeliverableEmail("  user@example.com  ")).toBe(true);
  });

  it("is not fooled by a non-string", () => {
    expect(isDeliverableEmail(undefined as unknown as string)).toBe(false);
    expect(isDeliverableEmail(null as unknown as string)).toBe(false);
  });
});
