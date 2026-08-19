"use client";

/**
 * Leave a review for a delivered order.
 *
 * Linked from the delivered email as /review?order=<id> (src/lib/email.ts). The
 * order id alone is not a credential — the phone is asked for here and checked
 * server-side by /api/reviews, the same gate /track uses. There are no accounts
 * on this shop, so this pair is the only thing that identifies a customer.
 *
 * ACTION_PLAN.md A-18.
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface ReviewableItem { slug: string; name: string; reviewed: boolean }

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none transition-transform hover:scale-110 ${
            n <= value ? "text-sand-dark" : "text-rule"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm() {
  const params = useSearchParams();
  // Read once from the query string. There was an effect here re-setting this
  // from the same `params` on every change, which is a state-sync loop the
  // initializer already covers — the link arrives from an email and the param
  // does not change under the user.
  const [orderId, setOrderId] = useState(params.get("order") || "");
  const [phone, setPhone] = useState("");
  const [items, setItems] = useState<ReviewableItem[] | null>(null);
  const [notDelivered, setNotDelivered] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setItems(null); setNotDelivered(false);
    try {
      const res = await fetch(
        `/api/reviews?order=${encodeURIComponent(orderId.trim())}&phone=${encodeURIComponent(phone.trim())}`
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "We could not find that order."); return; }
      if (!data.delivered) { setNotDelivered(true); return; }
      setItems(data.items);
      setDone(Object.fromEntries((data.items as ReviewableItem[]).map((i) => [i.slug, i.reviewed])));
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const submit = async (slug: string) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim(), phone: phone.trim(), slug,
          rating: ratings[slug], comment: comments[slug] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "We could not save that review."); return; }
      setDone((d) => ({ ...d, [slug]: true }));
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-paper px-4 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="font-heading text-3xl text-ink">How did we do?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Every review here comes from a delivered order. We do not write our own, and we do not
          show a rating until a real customer leaves one.
        </p>

        {!items && !notDelivered && (
          <form onSubmit={lookup} className="mt-8 rounded-2xl border border-rule bg-bone p-6">
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-soft">Order number</label>
            <input
              value={orderId} onChange={(e) => setOrderId(e.target.value)} required
              placeholder="the 8 characters on your receipt"
              className="mt-1 w-full rounded-xl border border-rule px-4 py-3 text-sm outline-none focus:border-sand-dark"
            />
            <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-ink-soft">Phone number</label>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel"
              placeholder="the number you ordered with"
              className="mt-1 w-full rounded-xl border border-rule px-4 py-3 text-sm outline-none focus:border-sand-dark"
            />
            <button
              type="submit" disabled={busy}
              className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-bone transition-colors hover:bg-sand-dark hover:text-ink disabled:opacity-60"
            >
              {busy ? "Checking…" : "Find my order"}
            </button>
          </form>
        )}

        {notDelivered && (
          <p className="mt-8 rounded-2xl border border-rule bg-bone p-6 text-sm text-ink-soft">
            That order has not been delivered yet. Once it arrives we would love to hear what you think. The
            link in your delivery email will bring you back here.
          </p>
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}

        {items && items.length === 0 && (
          <p className="mt-8 text-sm text-ink-soft">We could not find any pieces on that order to review.</p>
        )}

        {items && items.map((item) => (
          <div key={item.slug} className="mt-6 rounded-2xl border border-rule bg-bone p-6">
            <h2 className="text-sm font-semibold text-ink">{item.name}</h2>
            {done[item.slug] ? (
              <p className="mt-3 text-sm text-ink-soft">Thank you. Your review for this piece is saved.</p>
            ) : (
              <>
                <div className="mt-3">
                  <Stars value={ratings[item.slug] || 0} onChange={(n) => setRatings((r) => ({ ...r, [item.slug]: n }))} />
                </div>
                <textarea
                  value={comments[item.slug] || ""}
                  onChange={(e) => setComments((c) => ({ ...c, [item.slug]: e.target.value }))}
                  rows={3} maxLength={1000} placeholder="Anything you'd like to add? (optional)"
                  className="mt-3 w-full rounded-xl border border-rule px-4 py-3 text-sm outline-none focus:border-sand-dark"
                />
                <button
                  onClick={() => submit(item.slug)}
                  disabled={busy || !ratings[item.slug]}
                  className="mt-3 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-sand-dark hover:text-ink disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Leave review"}
                </button>
              </>
            )}
          </div>
        ))}

        <p className="mt-10 text-center text-xs text-ink-soft">
          <Link href="/" className="underline underline-offset-2 hover:text-ink">← Back to the shop</Link>
        </p>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <ReviewForm />
    </Suspense>
  );
}
