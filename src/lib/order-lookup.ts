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
