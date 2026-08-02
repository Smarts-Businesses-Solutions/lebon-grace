"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
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
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = "none";
    const parent = target.parentElement;
    if (parent) {
      parent.style.backgroundColor = product.imagePlaceholder.bg;
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.justifyContent = "center";
      const span = document.createElement("span");
      span.className = "font-bold text-2xl opacity-60";
      const isLight = product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85";
      span.style.color = isLight ? "#2D2D2D" : "#FAF8F5";
      span.textContent = product.imagePlaceholder.initials;
      parent.appendChild(span);
    }
  };

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <Link href={"/shop/" + product.slug} className="block">
        <div className="aspect-square overflow-hidden bg-gray-50">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={handleImageError}
          />
        </div>
      </Link>
      <div className="p-3">
        <Link href={"/shop/" + product.slug}>
          <h3 className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2 hover:text-[#16A34A] transition-colors mb-1">{product.name}</h3>
        </Link>
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-900 font-bold text-base">{formatPrice(product.price)}</span>
          <button onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-xs font-semibold rounded-lg hover:bg-[#15803D] active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add
          </button>
        </div>
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
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C9A96E] rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#16A34A] rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-[#C9A96E] text-xs sm:text-sm tracking-[0.3em] uppercase mb-4 font-medium">Cut To Order &bull; Free Name Engraving &bull; Ready In 2 To 3 Days</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Wooden puzzles,<br />
              <span className="text-[#C9A96E]">made one at a time</span>
            </h1>
            <p className="mt-6 text-gray-300 text-base sm:text-lg leading-relaxed max-w-lg">
              Alphabet boards, number puzzles and Montessori shapes, cut and sanded by hand after you order. Ready in two to three days. Add a child’s name at no extra cost.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/shop" className="inline-flex items-center gap-2 bg-[#16A34A] text-white px-8 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#15803D] transition-colors">
                Shop All Puzzles
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/about" className="inline-flex items-center border border-white/30 text-white px-6 py-3.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
                How We Make Them
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Banner */}
      <section className="bg-[#16A34A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-center gap-6 text-white text-sm font-medium">
            {/* These three must match the cart. They previously said AED 300 and
                10-14 days, both left over from the dropship catalogue, while the
                cart charged on a AED 150 threshold. */}
            <span>🚚 Free UAE delivery over AED 150</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>💳 Free collection, or AED 20 UAE delivery</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>📦 Ready in 2 to 3 days</span>
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
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-100 group-hover:border-[#16A34A] group-hover:shadow-md transition-all duration-200">
                    {categoryImage ? (
                      <img src={categoryImage} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-2xl">{cat.icon}</div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-[#16A34A] transition-colors">{cat.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{count} {count === 1 ? "item" : "items"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/shop" className="inline-flex items-center gap-1 text-[#16A34A] text-sm font-medium hover:underline">
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
            <Link href="/shop" className="text-[#16A34A] text-sm font-medium hover:underline hidden sm:block">
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

      {/* Value Proposition Banner */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-[#16A34A]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375c-.621 0-1.125-.504-1.125-1.125V14.25m17.25 4.5v-3.375c0-.621-.504-1.125-1.125-1.125H17.25m0 0V6.375c0-.621-.504-1.125-1.125-1.125H7.875c-.621 0-1.125.504-1.125 1.125v5.25" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Collection or Delivery</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Collect from the workshop free, or AED 20 anywhere in the UAE. Delivery is free over AED 150.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-[#C9A96E]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#C9A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Made to Order</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Nothing sits in a warehouse. Your puzzle is cut, sanded and finished once you order it, then it is yours.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Secure & Trusted</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Payment through Stripe, and a real person on WhatsApp for every order. If a piece arrives faulty we replace it free within 7 days.</p>
              </div>
            </div>
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
            <Link href="/shop" className="text-[#16A34A] text-sm font-medium hover:underline hidden sm:block">
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

      {/* Newsletter */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight mb-3">Stay in the Loop</h2>
            <p className="text-gray-400 text-sm mb-8">New designs and workshop news, now and then. No offers you have not asked for.</p>
            {subscribed ? (
              <div className="bg-[#16A34A]/10 text-[#16A34A] p-4 rounded-lg font-medium">
                ✓ You are on the list. We will email you when there is something new.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
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
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-3 bg-[#16A34A] text-white rounded-lg text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  {sending ? "Saving…" : "Subscribe"}
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </section>
    </>
  );
}
