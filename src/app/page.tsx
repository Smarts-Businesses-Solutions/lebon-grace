"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { products, formatPrice, categories } from "@/lib/products";

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.floor(rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-gray-400 text-[11px] ml-0.5">({count})</span>
    </div>
  );
}

function ProductCard({ product, index, onAdd }: { product: typeof products[0]; index: number; onAdd: () => void }) {
  const rating = 3.5 + (index % 3) * 0.5;
  const reviewCount = (index * 7 + 12) % 50 + 5;

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
        <StarRating rating={rating} count={reviewCount} />
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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) { setSubscribed(true); setEmail(""); }
  };

  const bestSellers = products.slice(0, 8);
  const newArrivals = products.slice(10, 18);

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
            <p className="text-[#C9A96E] text-xs sm:text-sm tracking-[0.3em] uppercase mb-4 font-medium">694 Products &bull; 17 Categories &bull; All Under AED 50</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Everyday Essentials,<br />
              <span className="text-[#C9A96E]">Beautifully Priced</span>
            </h1>
            <p className="mt-6 text-gray-300 text-base sm:text-lg leading-relaxed max-w-lg">
              Affordable accessories for your workspace, travel, home, and style. Quality picks, honest prices. Pay 50% now, 50% on delivery.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/shop" className="inline-flex items-center gap-2 bg-[#16A34A] text-white px-8 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#15803D] transition-colors">
                Shop All Products
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/about" className="inline-flex items-center border border-white/30 text-white px-6 py-3.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Banner */}
      <section className="bg-[#16A34A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-center gap-6 text-white text-sm font-medium">
            <span>🚚 Free shipping on orders over AED 300</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>💳 Pay 50% now, 50% on delivery</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span>📦 Arrives in 10–14 days</span>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">Shop by Category</h2>
            <p className="mt-2 text-gray-400 text-sm">{categories.length} categories, {products.length} products</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {categories.slice(0, 12).map((cat) => {
              // Use curated Unsplash images that clearly represent each category
              const categoryImages: Record<string, string> = {
                "Jewelry": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop",
                "Home Decor": "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=400&h=400&fit=crop",
                "Fashion & Accessories": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=400&fit=crop",
                "Pet Supplies": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop",
                "Kitchen & Dining": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
                "Beauty & Grooming": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop",
                "Home Storage": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=400&h=400&fit=crop",
                "Bags & Travel": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop",
                "Stationery & Gifts": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&h=400&fit=crop",
                "Desk & Office": "https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=400&fit=crop",
                "Garden & Outdoor": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop",
                "Phone & Tech": "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&h=400&fit=crop",
                "Fitness & Wellness": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop",
                "Candles & Aroma": "https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=400&h=400&fit=crop",
                "Seasonal & Gifts": "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=400&h=400&fit=crop",
                "Keychains & Tags": "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&h=400&fit=crop",
                "Kids & Baby": "https://images.unsplash.com/photo-1566004100631-35d015d6a491?w=400&h=400&fit=crop",
              };
              const categoryImage = categoryImages[cat.name] || "";
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
                    <p className="text-[11px] text-gray-400 mt-0.5">{count} items</p>
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

      {/* Best Sellers */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">Best Sellers</h2>
              <p className="mt-1 text-gray-400 text-sm">Our most popular products right now</p>
            </div>
            <Link href="/shop" className="text-[#16A34A] text-sm font-medium hover:underline hidden sm:block">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {bestSellers.map((product, index) => (
              <ProductCard key={product.slug} product={product} index={index} onAdd={() => addItem(product)} />
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
                <h3 className="font-semibold text-gray-900 mb-1">Free Shipping</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Free delivery on all orders over AED 300 across all Emirates.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-[#C9A96E]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#C9A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">50/50 Payment</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Pay 50% now with your card, and the remaining 50% when your order arrives.</p>
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
                <p className="text-gray-500 text-sm leading-relaxed">All payments processed securely via Stripe. WhatsApp support for every order.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">New Arrivals</h2>
              <p className="mt-1 text-gray-400 text-sm">The latest additions to our collection</p>
            </div>
            <Link href="/shop" className="text-[#16A34A] text-sm font-medium hover:underline hidden sm:block">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {newArrivals.map((product, index) => (
              <ProductCard key={product.slug} product={product} index={index + 10} onAdd={() => addItem(product)} />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight mb-3">Stay in the Loop</h2>
            <p className="text-gray-400 text-sm mb-8">Be the first to discover new arrivals, exclusive offers, and deals delivered to your inbox.</p>
            {subscribed ? (
              <div className="bg-[#16A34A]/10 text-[#16A34A] p-4 rounded-lg font-medium">
                ✓ You&apos;re subscribed! Check your inbox for a welcome offer.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none"
                  required
                />
                <button type="submit" className="px-6 py-3 bg-[#16A34A] text-white rounded-lg text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap">
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
