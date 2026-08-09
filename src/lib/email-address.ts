/**
 * Is this an address a confirmation email could actually reach?
 *
 * Exists because `a@b` was accepted at checkout. HTML5 `type="email"` allows it
 * (the spec does not require a TLD), the client checked only that the field was
 * non-empty, and the server did `.trim().slice(0, 200)`.
 *
 * That matters more here than on a site with accounts: the confirmation email
 * is the ONLY place a customer receives their order number. Tracking needs
 * order-id + phone, and the account lookup needs email + phone — so a mistyped
 * address strands a paying customer from an order they cannot reach by any
 * route the site offers.
 *
 * Deliberately NOT RFC 5322. That grammar permits quoted strings, comments and
 * folding whitespace which no mailbox provider accepts in practice; matching it
 * would accept more addresses that bounce. This targets the interoperable
 * RFC 5321 subset plus DNS reality.
 *
 * Also deliberately not Zod's `.email()`: Zod 3's pattern accepts `a@b`, so it
 * would not have caught this. If that changes in a later Zod, this function is
 * the one place to revisit.
 *
 * Rejects, each for a reason seen in real bounce logs: no TLD; a
 * single-character TLD (none exist in the IANA root); consecutive dots; a
 * leading or trailing dot in either half; spaces; more than one `@`; and
 * anything over the RFC 5321 length limits — 64 for the local part, 254 total.
 *
 * Raw unicode is rejected rather than mangled. Punycode it before calling.
 */
const LOCAL_MAX = 64;
const TOTAL_MAX = 254;

const SHAPE =
  /^(?!.*\.\.)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;

export function isDeliverableEmail(input: string): boolean {
  if (typeof input !== "string") return false;

  // Trimmed, not rejected: a trailing space is a paste artefact, not a typo,
  // and refusing the sale over one would be its own harm.
  const email = input.trim();
  if (!email || email.length > TOTAL_MAX) return false;

  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  if (email.slice(0, at).length > LOCAL_MAX) return false;

  return SHAPE.test(email);
}

/** Trimmed, with the domain lower-cased. Only meaningful once validated. */
export function normaliseEmail(input: string): string {
  const email = input.trim();
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  return `${email.slice(0, at)}@${email.slice(at + 1).toLowerCase()}`;
}
