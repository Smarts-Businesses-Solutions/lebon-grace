"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import ProductImage from "@/components/ProductImage";
import { products, formatPrice, categories } from "@/lib/products";

/**
 * There is deliberately no StarRating here.
 *
 * The version this replaces rendered stars and a review count on every card,
 * both derived from the product's index in the array:
 *
 *   const rating = 3.5 + (index % 3) * 0.5;
 *   const reviewCount = (index * 7 + 12) % 50 + 5;
 *
 * Not one review existed. The shop had never taken an order. Invented ratings
 * are the same fault as the invented "Save AED 6" discount that used to sit on
 * the product pages, and they carry real exposure under UAE Federal Law No. 15
 * of 2020 on Consumer Protection.
 *
 * When there are genuine reviews, they can go back in reading from a reviews
 * table. Until then a card shows no rating at all, which is the truth.
 */
function ProductCard({ product, onAdd }: { product: typeof products[0]; onAdd: () => void }) {
  // The hand-rolled onError handler that used to live here reached into the DOM
  // to hide the img, restyle its parent and append a span of initials.
  // ProductImage renders nothing on failure, so the container's own background
  // shows through and the placeholder is plain CSS below.
  const ph = product.imagePlaceholder;
  const isLight = ph.bg === "#C9A96E" || ph.bg === "#D4BA85";

  // Card, not tile. The previous version was a white rounded box with a border,
  // a bold price and a filled "Add" button — the shape every marketplace uses.
  // Here the photograph sits directly on the paper with no frame, the title is
  // set in the display serif, and the add control only appears on hover so a
  // grid of sixteen reads as a catalogue rather than a checkout queue.
  return (
    <div className="group">
      <Link href={"/shop/" + product.slug} className="block">
        {/* relative is required: ProductImage fills its nearest positioned
            ancestor. The initials sit underneath and show only if the image
            fails, replacing the old imperative onError handler. */}
        <div
          className="relative aspect-square overflow-hidden flex items-center justify-center lift"
          style={{ backgroundColor: ph.bg }}
        >
          <span
            className="font-heading text-3xl opacity-50"
            style={{ color: isLight ? "#23201C" : "#F7F3EC" }}
          >
            {ph.initials}
          </span>
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          />

          {/* Add control, revealed on hover. On touch, where there is no hover,
              the whole card is still a link to the product page, so nothing is
              unreachable. */}
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-3 right-3 bg-bone/95 backdrop-blur-sm text-ink text-xs tracking-wide px-4 py-2.5
                       opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
                       focus-visible:opacity-100 focus-visible:translate-y-0
                       transition-all duration-300 hover:bg-ink hover:text-paper"
          >
            Add to cart
          </button>
        </div>
      </Link>

      <div className="pt-4">
        <Link href={"/shop/" + product.slug}>
          <h3 className="font-heading text-[15px] leading-snug line-clamp-2 group-hover:text-sand-dark transition-colors">
            {product.name}
          </h3>
        </Link>
        {/* Price set quietly. Every piece is AED 15, so shouting it on each of
            sixteen cards just adds noise; the hero states it once. */}
        <p className="mt-1.5 text-sm text-ink-muted tabular-nums">{formatPrice(product.price)}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { addItem } = useCart();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");

  /**
   * The old version of this set `subscribed` and stopped. It told the visitor
   * to check their inbox for a welcome offer that did not exist, and every
   * address typed into the box was discarded. It now posts to /api/newsletter,
   * which stores the address, and it reports a failure as a failure.
   */
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: honeypot }),
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "" }));
        setError(error || "Something went wrong. Please try again.");
        return;
      }
      setSubscribed(true);
      setEmail("");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Clearance is old phone-case stock being emptied, not part of the range, so
  // it is kept out of both homepage grids the same way it is kept out of the
  // category row. Without this filter it sorts first and led the homepage.
  const puzzles = useMemo(
    () => products.filter((p) => p.category !== "Clearance"),
    []
  );

  // These are two slices of the catalogue, nothing more. They were previously
  // labelled "Best Sellers" and "New Arrivals" on a shop that had never sold
  // anything and where every product was listed on the same day. The headings
  // below now say what these actually are.
  const featured = puzzles.slice(0, 8);
  const alsoMade = puzzles.slice(8, 16);

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────────
          Replaces a dark gradient with two blurred colour blobs and no product
          in it. The photography is the strongest asset this shop has and the
          first screen showed none of it.

          Asymmetric on purpose: type occupies five columns, the photograph
          seven and bleeds past the container to the right edge, so the page
          reads as a spread rather than a centred landing page. The overlap of
          the price medallion onto the image is the one grid-breaking element,
          and it carries the offer that actually wins against Amazon. */}
      <section className="relative overflow-hidden bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center pt-14 pb-16 lg:pt-24 lg:pb-28">

            <div className="lg:col-span-5 relative z-10">
              <p className="eyebrow rise" style={{ animationDelay: "80ms" }}>
                Cut to order · Dubai workshop
              </p>

              {/* Fraunces at display size with its optical axis pushed further:
                  large type can carry more warmth than body text without
                  becoming decorative. */}
              <h1
                className="mt-5 text-[2.75rem] sm:text-6xl lg:text-[4.2rem] font-semibold rise"
                style={{ animationDelay: "160ms", fontVariationSettings: '"SOFT" 45, "WONK" 1, "opsz" 120' }}
              >
                Wooden puzzles,
                <span className="block italic text-sand-dark">made one at a time.</span>
              </h1>

              <p className="mt-7 text-ink-soft text-lg leading-relaxed max-w-md rise" style={{ animationDelay: "240ms" }}>
                Alphabet boards, number trays and Montessori shapes. Drawn as a cutting
                file, cut from MDF on our own laser, sanded by hand. Yours does not exist
                until you order it.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-9 rise" style={{ animationDelay: "320ms" }}>
                <Link
                  href="/shop"
                  className="group inline-flex items-center gap-2.5 bg-ink text-paper px-8 py-4 text-sm tracking-wide hover:bg-sand-dark transition-colors"
                >
                  Browse the range
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                {/* The rule belongs to the words, not to the link box: with the
                    underline on the <Link> its px-6/py-4 padding pushed it a
                    finger's width past the text on both sides and well below the
                    baseline, which read as a stray line once it wrapped on
                    mobile. Moving it to an inner span keeps it hugging the text
                    at every width. */}
                <Link
                  href="/about"
                  className="group inline-flex items-center px-6 py-4 text-sm tracking-wide text-ink"
                >
                  <span className="border-b border-ink/25 pb-0.5 transition-colors group-hover:border-ink">
                    How they are made
                  </span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 relative">
              {/* Bleeds past the container on large screens so the image runs to
                  the edge of the viewport. */}
              <div className="relative aspect-[5/4] lg:aspect-[4/3] overflow-hidden lg:-mr-[8vw] rise" style={{ animationDelay: "120ms" }}>
                <ProductImage
                  src="/images/lasercut/abc-jigsaw-board-0.png"
                  alt="An alphabet jigsaw board, cut and sanded by hand"
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                  priority
                />
              </div>

              {/* The offer, set as an object rather than a badge. AED 15 with
                  free engraving is the strongest thing this shop can say and it
                  was previously buried in a line of small caps.

                  Scoped to "hand-cut puzzle" rather than the flat "Every puzzle"
                  it used to read. Once the MDF range landed, seven visible
                  products with "puzzle" in the name sold between AED 5 and 12,
                  so the unqualified claim was simply untrue. The qualified one
                  still is true — all 41 hand-cut pieces are AED 15 — and naming
                  the cheaper entry point costs nothing and gains a browser who
                  came for a one-dirham blank. */}
              <div className="absolute -bottom-7 left-4 sm:left-8 bg-bone px-7 py-5 lift rise" style={{ animationDelay: "420ms" }}>
                <p className="eyebrow">Every hand-cut puzzle</p>
                <p className="font-heading text-3xl mt-1">AED 15</p>
                <p className="text-xs text-ink-muted mt-1">Name engraved free · ready in 2–3 days</p>
                <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-rule">Craft blanks &amp; kits from AED 1</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Banner */}
      <section className="bg-[#23201C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-center gap-6 text-white text-sm font-medium">
            {/* These three must match the cart. They previously said AED 300 and
                10-14 days, both left over from the dropship catalogue, while the
                cart charged on a AED 150 threshold. */}
            <span>Free UAE delivery over AED 150</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>Free collection, or AED 20 UAE delivery</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>Ready in 2 to 3 days</span>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">Shop by Category</h2>
            <p className="mt-2 text-gray-400 text-sm">Cut and finished by hand, one at a time</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.filter((c) => !c.hidden && c.name !== "Clearance").slice(0, 12).map((cat) => {
              // The tile image is the first product in the category.
              //
              // This used to be a hardcoded map of Unsplash URLs keyed on the
              // dropship categories (Jewelry, Pet Supplies, Phone & Tech and so
              // on). After the pivot not one key matched a real category, so
              // every tile fell through to the emoji fallback and the strip
              // showed six identical brown boxes. Reading the catalogue instead
              // of a parallel list means it cannot fall out of step again, and
              // it shows a puzzle you actually make rather than a stock photo
              // hotlinked from someone else's CDN.
              const first = products.find((p) => p.category === cat.name);
              const categoryImage = first?.imageUrl || "";
              const count = products.filter(p => p.category === cat.name).length;
              return (
                <Link key={cat.name} href={"/shop?category=" + encodeURIComponent(cat.name)} className="group flex flex-col items-center gap-3 text-center">
                  {/* An arch, not a circle. These photos are landscape objects on
                      cloth: a circle crops harder than any other shape and lopped
                      the ends off every puzzle. The arch keeps the full width and
                      reads as a display niche rather than an avatar. */}
                  <div className="relative w-full aspect-4/5 overflow-hidden rounded-t-full rounded-b-md bg-paper-deep ring-1 ring-rule transition-all duration-300 group-hover:ring-sand group-hover:-translate-y-1">
                    {categoryImage ? (
                      <ProductImage src={categoryImage} alt={cat.name} sizes="(max-width: 640px) 30vw, (max-width: 1024px) 30vw, 160px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">{cat.icon}</div>
                    )}
                  </div>
                  <div>
                    <p className="font-heading text-sm text-ink transition-colors group-hover:text-sand-dark">{cat.name}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5 tabular-nums">{count} {count === 1 ? "piece" : "pieces"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/shop" className="inline-flex items-center gap-1 text-[#A8874D] text-sm font-medium hover:underline">
              View all categories
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* A slice of the range. Not ranked by sales, and no longer claiming to be. */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">Popular Shapes</h2>
              <p className="mt-1 text-gray-400 text-sm">Alphabet boards, animals and Montessori trays</p>
            </div>
            <Link href="/shop" className="text-[#A8874D] text-sm font-medium hover:underline hidden sm:block">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} onAdd={() => addItem(product)} />
            ))}
          </div>
        </div>
      </section>

      {/* How the workshop works. Three plain statements, set as ruled editorial
          columns rather than boxed cards with icon chips — the icons were
          generic stroke glyphs that said nothing the sentence underneath did
          not already say, and the grey rounded boxes were the last piece of
          stock-template furniture on the page. */}
      <section className="bg-bone">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-12">
            {[
              { n: "01", title: "Collection or delivery", body: "Collect from the workshop free, or AED 20 anywhere in the UAE. Delivery is free over AED 150." },
              { n: "02", title: "Made to order", body: "Nothing sits in a warehouse. Your puzzle is cut, sanded and finished once you order it, then it is yours." },
              { n: "03", title: "Secure & trusted", body: "Payment through Stripe, and a real person on WhatsApp for every order. If a piece arrives faulty we replace it free within 7 days." },
            ].map((item) => (
              <div key={item.n} className="border-t border-ink pt-5">
                <span className="eyebrow text-ink-muted tabular-nums">{item.n}</span>
                <h3 className="font-heading text-xl text-ink mt-3">{item.title}</h3>
                <p className="text-ink-soft/80 text-sm leading-relaxed mt-2 max-w-xs">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The rest of the range. Every design was listed the same day, so there is
          nothing here that is meaningfully newer than anything else. */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">More From The Workshop</h2>
              <p className="mt-1 text-gray-400 text-sm">Numbers, vehicles and build-it-yourself kits</p>
            </div>
            <Link href="/shop" className="text-[#A8874D] text-sm font-medium hover:underline hidden sm:block">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {alsoMade.map((product) => (
              <ProductCard key={product.slug} product={product} onAdd={() => addItem(product)} />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter.
          Set as an asymmetric editorial block rather than a centred card: the
          type sits left, the form right, and the field is a ruled line instead
          of a bordered box so it reads as part of the page rather than a widget
          dropped onto it. */}
      <section className="bg-paper-deep border-t border-rule">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
            <div className="lg:col-span-5">
              <span className="eyebrow text-ink-muted">From the workshop</span>
              <h2 className="font-heading text-3xl lg:text-4xl text-ink mt-3 leading-[1.1]">
                New designs, <em className="text-sand-dark not-italic font-normal">now and then</em>
              </h2>
              <p className="text-ink-soft/80 text-sm mt-4 max-w-sm leading-relaxed">
                Workshop news and new shapes as they come off the laser. No offers you have not asked for.
              </p>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
            {subscribed ? (
              <p className="font-heading text-lg text-sage border-t border-sage pt-5">
                You are on the list. We will email you when there is something new.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-3 items-end">
                {/* Honeypot. Hidden from people, filled by bots. */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] w-px h-px opacity-0"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 min-w-0 bg-transparent border-0 border-b border-ink/30 px-0 py-3 text-base text-ink placeholder:text-ink-muted/60 focus:border-ink focus:ring-0 outline-none transition-colors"
                  required
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="shrink-0 px-7 py-3 bg-ink text-paper text-sm tracking-wide hover:bg-sand-dark transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  {sending ? "Saving…" : "Subscribe"}
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
