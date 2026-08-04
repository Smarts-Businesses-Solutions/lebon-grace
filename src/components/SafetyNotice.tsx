/**
 * Age guidance and small-parts warning for a product page.
 *
 * Two separate problems this solves.
 *
 * The first is that `details.age` was already carried by 41 products and used
 * to drive the shop's age filter, but was never rendered anywhere a customer
 * could see it. A parent could filter by age and then land on a page that said
 * nothing about age at all.
 *
 * The second is the warning itself. Toys sold in the UAE fall under the GCC
 * scheme, and a toy not suitable for children under three has to say so along
 * with the reason — choking hazard — as words or a pictogram. Every item in
 * this catalogue is cut from sheet MDF into pieces that lift out, so "contains
 * small parts" is a statement of fact about the product rather than a guess.
 *
 * What this component deliberately does NOT do is invent an age rating for a
 * product that has none. 54 of the 95 visible products carry no assessed age,
 * and a fabricated number on a children's product is worse than an honest
 * absence: it reads as though someone checked. Those products get the warning
 * without a suitability claim.
 *
 * This is labelling, not conformity. It does not substitute for EN 71 testing
 * or Gulf Conformity marking — see docs/COMPLIANCE-UAE-TOY-SAFETY.md.
 */

export default function SafetyNotice({ age }: { age?: string }) {
  // "1-3" -> "1 to 3 years", "4+" -> "4 years and over"
  const readableAge = age
    ? age.endsWith("+")
      ? `${age.slice(0, -1)} years and over`
      : `${age.replace("-", " to ")} years`
    : null;

  // The warning has to agree with the age directly above it.
  //
  // Eleven products are labelled "1-3" and every one of them is a peg board or
  // peg puzzle — the classic toddler form. Printing a flat "not suitable for
  // children under 3" under "Suitable for 1 to 3 years" would contradict itself
  // on the same card, and a self-contradicting safety notice teaches customers
  // to ignore safety notices.
  //
  // So: a product sold FOR under-threes gets a supervision warning, because the
  // pegs and pieces are still small parts and that is the honest thing to say.
  // Everything else — 3+, or no assessed age — gets the standard
  // not-suitable-under-3 form the guidance asks for.
  const minAge = age ? parseInt(age, 10) : NaN;
  const soldForUnderThrees = !Number.isNaN(minAge) && minAge < 3;

  return (
    <div className="bg-transparent border-t border-ink pt-4 mb-7">
      <h3 className="eyebrow text-ink-muted mb-4 block">Safety &amp; age</h3>

      {readableAge ? (
        <div className="flex justify-between mb-3">
          <dt className="text-xs text-ink-muted">Suitable for</dt>
          <dd className="text-xs font-medium text-ink">{readableAge}</dd>
        </div>
      ) : (
        <p className="text-xs text-ink-muted mb-3">
          We have not assessed an age range for this piece yet.
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-lg bg-[#FBF6EC] p-3">
        <svg
          className="w-4 h-4 text-[#A8874D] mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-xs font-semibold text-ink">
            Choking hazard — contains small parts
          </p>
          {soldForUnderThrees ? (
            <p className="text-[11px] text-ink-soft/80 leading-relaxed mt-0.5">
              The pieces and pegs lift out and are small enough to swallow. This
              piece is made for little hands, so please use it with an adult
              nearby and put it away after play.
            </p>
          ) : (
            <p className="text-[11px] text-ink-soft/80 leading-relaxed mt-0.5">
              The pieces lift out and are small enough to swallow. Not suitable
              for children under 3 years. Please keep younger children
              supervised.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
