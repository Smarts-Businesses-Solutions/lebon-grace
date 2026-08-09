/**
 * Phone comparison for guest-order lookup — the second half of the credential.
 *
 * This shop has no accounts. `/track` accepts order id + phone and `/account`
 * accepts email + phone; a match returns the full record — name, email, phone,
 * delivery address, totals, tracking. The phone is therefore not a convenience
 * field, it is the thing standing between a known email address and somebody's
 * home address.
 *
 * Lifted out of store.ts so it can be tested directly. It was two private
 * functions there, which is why the defect below went unnoticed: nothing could
 * reach them without a database.
 */

/**
 * Digits only, with a leading 0 read as the UAE national prefix.
 *
 * Deliberately not a full E.164 parser. Comparison below is suffix-based, so
 * the substitution only has to be applied consistently to both sides — a
 * foreign number that begins with 0 comes out mangled the same way on each
 * side, and still compares correctly.
 */
export function digitsOf(p: string): string {
  return (p || "").replace(/\D/g, "");
}

export function normalisePhone(p: string): string {
  return digitsOf(p).replace(/^0/, "971");
}

/**
 * The number of trailing digits that must agree.
 *
 * Eight, not nine. A UAE mobile has nine significant digits (5X XXX XXXX) but a
 * UAE landline has eight (X XXX XXXX), and requiring nine would lock a landline
 * customer out of the only route they have to their own order. Eight also keeps
 * expatriate foreign numbers usable, which in Dubai is not an edge case.
 *
 * 10^8 against a limit of ten attempts an hour is ample: the point is that the
 * phone is a real factor, not that it is a password.
 */
export const PHONE_SIGNIFICANT_DIGITS = 8;

/**
 * Is this string usable as half of a credential?
 *
 * Counted on the RAW digits, deliberately, not on the normalised form. The
 * `^0 → 971` substitution ADDS two digits, so measuring after it lets a
 * seven-digit entry beginning with 0 pass a length check it never earned:
 * "0501234" becomes "971501234" and reads as nine. Caught by this module's own
 * test, which is the argument for extracting it from store.ts in the first
 * place.
 */
export function isUsablePhone(p: string): boolean {
  return digitsOf(p).length >= PHONE_SIGNIFICANT_DIGITS;
}

/**
 * Do a stored phone and a supplied phone identify the same person?
 *
 * THE DEFECT THIS REPLACES. The original was:
 *
 *     return ca.endsWith(cb.slice(-8)) || cb.endsWith(ca.slice(-8));
 *
 * `slice(-8)` of a SHORT string is the whole string, so a short input widened
 * the match instead of narrowing it. Verified: `phoneMatches("0501234567", "7")`
 * returned **true**. Exactly one single digit matches any given number, so an
 * attacker needed at most ten attempts — and the rate limit on this lookup is
 * ten per hour, so it did not stand in the way. With a valid order id that
 * yielded the customer's full record; with a known email address, their entire
 * order history.
 *
 * The fix is to compare a FIXED-length window and to refuse to compare at all
 * when either side is too short, so the length of the input can no longer
 * change the strictness of the test.
 */
export function phoneMatches(stored: string, supplied: string): boolean {
  // Length is judged before normalisation; the comparison happens after it.
  if (!isUsablePhone(stored) || !isUsablePhone(supplied)) return false;
  const a = normalisePhone(stored);
  const b = normalisePhone(supplied);
  return a.slice(-PHONE_SIGNIFICANT_DIGITS) === b.slice(-PHONE_SIGNIFICANT_DIGITS);
}
