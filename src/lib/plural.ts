/**
 * Count plus a correctly-inflected noun.
 *
 * Exists because the live cart read **"Subtotal (1 items)"** — on the screen a
 * customer sees immediately before paying. The same shape (`{n} things`, with
 * no branch for one) was in three other places, so the string was not the bug;
 * writing the string by hand was.
 *
 * Deliberately not Intl.PluralRules: this shop is English-only today, and
 * Intl.PluralRules returns a CATEGORY ("one"/"other"), not a word, so it would
 * still need this mapping. When Arabic lands it will need real plural rules —
 * Arabic has six categories, including a dual — and that is the moment to
 * replace the body of this function rather than every call site.
 */
export function countOf(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count.toLocaleString("en-US")} ${word}`;
}
