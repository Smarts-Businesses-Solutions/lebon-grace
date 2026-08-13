/**
 * Turning what the customer was GIVEN into something the database can find.
 *
 * Order ids are UUIDs. Every customer-facing surface shows the first eight
 * characters with a hash in front — the confirmation e-mail, the success page,
 * /account, the operator alert — so the customer holds "#c6568cbb" while the
 * row is "c6568cbb-c503-4b91-924f-39ccd7cf135c".
 *
 * /track passed the string through unchanged and the lookup matched exactly, so
 * the first real order placed on the live shop could not be tracked with the
 * number the shop had just printed for it.
 *
 * Returns "" for anything too short or too vague to identify one order, rather
 * than a fragment that would prefix-match whatever happens to be first.
 */
const MIN_REF = 8;

export function normaliseOrderRef(input: string | null | undefined): string {
  if (!input) return "";

  // Find the longest id-SHAPED run rather than stripping disallowed characters.
  // Stripping looks simpler and is wrong: "Order #c6568cbb" contains d and e,
  // which are hex, so it yielded "dec6568cbb" and matched nothing. Requiring at
  // least MIN_REF hex characters means stray letters cannot contribute.
  const matches = String(input).toLowerCase().match(/[0-9a-f]{8}[0-9a-f-]*/g);
  if (!matches?.length) return "";

  const ref = matches
    .map((m) => m.replace(/-+$/, ""))
    .sort((a, b) => b.length - a.length)[0];

  return ref.length >= MIN_REF ? ref : "";
}

/** True when `ref` identifies `id` — either in full, or by its printed prefix. */
export function orderRefMatches(id: string, ref: string): boolean {
  if (!id || !ref) return false;
  const a = String(id).toLowerCase();
  return a === ref || a.startsWith(ref);
}

/**
 * The uuid range a partial reference covers, or null if it is not a prefix.
 *
 * The first attempt at short-reference lookup used `ilike("id", "ref%")`. That
 * is wrong against a uuid COLUMN — Postgres has no ilike for uuid and answers
 * `operator does not exist: uuid ~~* unknown`. PostgREST surfaces that as an
 * error, which the caller read as "no rows", so the fix passed its unit tests
 * and still 404'd on the live site.
 *
 * uuid comparison is bytewise, so a hex prefix is a contiguous range. Padding
 * with zeros gives the lowest member and with fs the highest. No cast, and the
 * primary key index still applies.
 */
export function uuidPrefixRange(ref: string): { low: string; high: string } | null {
  const hex = String(ref || "").toLowerCase().replace(/-/g, "");
  // 32 is a complete uuid: that is an exact lookup, not a range.
  if (!hex || hex.length >= 32 || !/^[0-9a-f]+$/.test(hex)) return null;

  const shape = (pad: string) => {
    const full = hex + pad.repeat(32 - hex.length);
    return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`;
  };
  return { low: shape("0"), high: shape("f") };
}
