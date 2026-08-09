"use client";

/**
 * Real reviews for one product, or nothing at all.
 *
 * src/app/page.tsx:9-25 records why this shop shows no ratings today: the
 * previous version derived stars from the product's array index while not one
 * review existed. The rule that replaced it — "a card shows no rating at all,
 * which is the truth" — is preserved here literally: with zero reviews this
 * component renders `null`. No "no reviews yet" placeholder, no empty stars,
 * nothing that could be mistaken for a rating.
 *
 * Every row it does render is tied to an order by foreign key (migration 0005)
 * and could only be created by someone holding that order's id and phone with
 * the piece actually delivered (src/app/api/reviews/route.ts).
 *
 * ACTION_PLAN.md A-18.
 */

import { useEffect, useState } from "react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string;
  created_at: string;
}

function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label ?? `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={n <= Math.round(value) ? "text-sand-dark" : "text-rule"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ProductReviews({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/reviews?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setReviews(Array.isArray(d.reviews) ? d.reviews : []); })
      .catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [slug]);

  // Still loading, or genuinely none. Both render nothing — an empty state here
  // would be a rating-shaped hole where there is no rating.
  if (!reviews || reviews.length === 0) return null;

  const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-heading text-xl text-ink">What customers say</h2>
        <Stars value={average} label={`Average ${average.toFixed(1)} out of 5`} />
        <span className="text-sm text-ink-soft">
          {average.toFixed(1)} from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>

      {/* Said plainly rather than as a badge, because it is the whole point. */}
      <p className="mt-1 text-xs text-ink-soft">
        Every review below comes from a delivered order.
      </p>

      <ul className="mt-6 space-y-5">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-rule bg-bone p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <Stars value={r.rating} />
              <span className="text-sm font-medium text-ink">{r.customer_name}</span>
              <span className="text-xs text-ink-soft">
                {new Date(r.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })}
              </span>
            </div>
            {r.comment && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
