import { describe, it, expect } from "vitest";
import { phoneMatches, isUsablePhone, normalisePhone, PHONE_SIGNIFICANT_DIGITS } from "./phone";

/**
 * Written from a defect found walking production as a returning customer.
 *
 * The phone is half the credential for both `/track` (order id + phone) and
 * `/account` (email + phone), and a match returns the full record including the
 * delivery address. The old comparison was:
 *
 *     ca.endsWith(cb.slice(-8)) || cb.endsWith(ca.slice(-8))
 *
 * `slice(-8)` of a short string is the whole string, so supplying "7" matched
 * any number ending in 7. Exactly one digit matches, so ten attempts sufficed —
 * against a rate limit of ten an hour.
 *
 * The adversarial rows below are the ones that failed before the fix. The
 * format rows are the ones that must KEEP passing: this shop's customers are in
 * the UAE and type their numbers every way there is, and with no accounts and no
 * password reset, being locked out of `/account` means being locked out of the
 * only route to their own order.
 */
describe("phoneMatches", () => {
  const STORED = "0501234567";

  describe("the same number, written the way real customers write it", () => {
    const equivalent = [
      ["0501234567", "exactly as stored"],
      ["+971501234567", "international with +"],
      ["971501234567", "international without +"],
      ["00971501234567", "international with 00 trunk"],
      ["050 123 4567", "spaces"],
      ["050-123-4567", "hyphens"],
      ["(050) 123 4567", "brackets"],
      ["501234567", "national, leading zero dropped"],
    ] as const;
    for (const [supplied, why] of equivalent) {
      it(`matches ${supplied} (${why})`, () => {
        expect(phoneMatches(STORED, supplied)).toBe(true);
      });
    }
  });

  describe("short input must NOT widen the match — this is the defect", () => {
    // Every one of these returned true before the fix.
    const tooShort = ["7", "67", "567", "4567", "34567", "234567", "1234567"];
    for (const supplied of tooShort) {
      it(`rejects ${JSON.stringify(supplied)} (${normalisePhone(supplied).length} digits)`, () => {
        expect(phoneMatches(STORED, supplied)).toBe(false);
      });
    }

    it("cannot be unlocked by any single digit", () => {
      // The heart of it: previously exactly one of these returned true, so ten
      // attempts against a ten-per-hour limit defeated the factor entirely.
      const unlocking = "0123456789".split("").filter((d) => phoneMatches(STORED, d));
      expect(unlocking, "no single digit may match a stored number").toEqual([]);
    });

    it("cannot be unlocked by any two-digit string", () => {
      const unlocking: string[] = [];
      for (let i = 0; i < 100; i++) {
        const s = String(i).padStart(2, "0");
        if (phoneMatches(STORED, s)) unlocking.push(s);
      }
      expect(unlocking).toEqual([]);
    });

    it("cannot be unlocked by any seven-digit suffix of the real number", () => {
      // One below the window. Proves the boundary is the window and not luck.
      expect(phoneMatches(STORED, "1234567")).toBe(false);
    });
  });

  describe("different numbers stay different", () => {
    it("rejects an off-by-one final digit", () => {
      expect(phoneMatches(STORED, "0501234568")).toBe(false);
    });
    it("rejects a different operator prefix", () => {
      expect(phoneMatches("0501234567", "0561234567")).toBe(false);
    });
    it("rejects an unrelated number", () => {
      expect(phoneMatches(STORED, "0559876543")).toBe(false);
    });
  });

  describe("junk input", () => {
    for (const junk of ["", "   ", "abc", "+", "----", "()"]) {
      it(`rejects ${JSON.stringify(junk)}`, () => {
        expect(phoneMatches(STORED, junk)).toBe(false);
        expect(phoneMatches(junk, STORED)).toBe(false);
      });
    }
    it("survives a stored value that is itself too short", () => {
      // Legacy rows exist that were never validated server-side. They must fail
      // closed rather than match everything.
      expect(phoneMatches("123", "123")).toBe(false);
      expect(phoneMatches("123", STORED)).toBe(false);
    });
  });

  describe("the window is symmetric", () => {
    it("does not depend on argument order", () => {
      expect(phoneMatches("+971501234567", "0501234567")).toBe(true);
      expect(phoneMatches("0501234567", "+971501234567")).toBe(true);
    });
  });

  describe("UAE landlines and foreign numbers stay usable", () => {
    // Why the window is 8 and not 9: a UAE landline has eight significant
    // digits, and requiring nine would lock those customers out of the only
    // route to their own order. Dubai is full of expatriate foreign numbers too.
    it("matches a Dubai landline across formats", () => {
      expect(phoneMatches("042345678", "+97142345678")).toBe(true);
    });
    it("matches a foreign mobile across formats", () => {
      expect(phoneMatches("+447700900123", "447700900123")).toBe(true);
    });
  });
});

describe("isUsablePhone", () => {
  it("accepts anything long enough to be compared", () => {
    for (const p of ["0501234567", "+971501234567", "042345678", "12345678"]) {
      expect(isUsablePhone(p), `${p} should be usable`).toBe(true);
    }
  });

  it("rejects anything shorter than the comparison window", () => {
    for (const p of ["", "   ", "7", "1234567", "abc", "+"]) {
      expect(isUsablePhone(p), `${p} should not be usable`).toBe(false);
    }
  });

  it("is exactly the boundary the comparison uses", () => {
    // Pins the two together: if the window changes, this fails rather than
    // silently letting a value through that cannot be compared.
    const exact = "1".repeat(PHONE_SIGNIFICANT_DIGITS);
    expect(isUsablePhone(exact)).toBe(true);
    expect(isUsablePhone("1".repeat(PHONE_SIGNIFICANT_DIGITS - 1))).toBe(false);
  });

  it("counts DIGITS, not characters — the checkout's client-side rule did not", () => {
    // `form.phone.length < 10` counted characters, so "----------" passed and
    // "+971 50 123 4567" was fine only by accident. A stored phone that cannot
    // be compared means a customer who can never reach their own order.
    expect(isUsablePhone("----------")).toBe(false);
    expect(isUsablePhone("(05) 0-1 2-3 4")).toBe(false);
  });
});
