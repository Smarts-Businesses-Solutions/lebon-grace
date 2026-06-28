"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { products, formatPrice, categories as productCategories } from "@/lib/products";

const bgMap: Record<string, string> = {
  Travel: "bg-dark",
  Workspace: "bg-charcoal",
  Home: "bg-sand",
  Jewelry: "bg-charcoal",
  Drinkware: "bg-dark",
};

const categories = productCategories.map((cat) => ({
  ...cat,
  href: "/shop?category=" + cat.name,
  bgClass: bgMap[cat.name] || "bg-charcoal",
}));

const featuredProducts = products.slice(0, 4);

export default function HomePage() {
  const { addItem } = useCart();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <>
      <section className="relative bg-dark text-offwhite overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-dark via-charcoal to-dark opacity-80" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sand text-xs sm:text-sm tracking-[0.3em] uppercase mb-6">Curated with care</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight">
              Everyday Essentials,<br />
              <span className="text-sand">Beautifully Priced</span>
            </h1>
            <p className="mt-6 text-warm-gray text-base sm:text-lg leading-relaxed max-w-lg">
              Affordable accessories for your workspace, travel, home, and style — all under AED 50. Quality picks, honest prices.
            </p>
            <div className="mt-10">
              <Link href="/shop" className="inline-flex items-center px-8 py-3.5 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">
                Explore the Collection
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sand/40 to-transparent" />
      </section>

      <section className="bg-offwhite border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center">
            <div className="flex items-center gap-2 text-charcoal">
              <svg className="w-4 h-4 text-sand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
              <span className="text-xs sm:text-sm tracking-wide">Pay 50% Now, 50% on Delivery</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2 text-charcoal">
              <svg className="w-4 h-4 text-sand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.139-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
              <span className="text-xs sm:text-sm tracking-wide">Free Shipping Over AED 300</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2 text-charcoal">
              <svg className="w-4 h-4 text-sand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs sm:text-sm tracking-wide">Arrives in 10-14 Days</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">Explore by Category</h2>
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Five categories, thousands of products, honest prices</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
          {categories.map((cat) => (
            <Link key={cat.name} href={cat.href} className="group relative bg-white rounded-sm border border-border overflow-hidden hover:border-sand/40 transition-all duration-300">
              <div className={cat.bgClass + " h-48 flex items-center justify-center"}>
                <div className="text-offwhite/80 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-4xl">{cat.icon}</span>
                </div>
              </div>
              <div className="p-6 lg:p-8">
                <h3 className="font-heading text-xl font-semibold tracking-tight">{cat.name}</h3>
                <p className="mt-2 text-warm-gray text-sm leading-relaxed">{cat.description}</p>
                <span className="mt-4 inline-flex items-center text-sand text-sm font-medium tracking-wide">
                  Shop {cat.name}
                  <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" /></svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">Featured Pieces</h2>
              <p className="mt-3 text-warm-gray text-sm tracking-wide">Our most beloved essentials</p>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center text-sand text-sm font-medium tracking-wide hover:text-sand-dark transition-colors">
              View All
              <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {featuredProducts.map((product) => (
              <div key={product.slug} className="group bg-offwhite rounded-sm border border-border overflow-hidden hover:border-sand/40 transition-all duration-300">
                <Link href={"/shop/" + product.slug}>
                  <div className="aspect-square overflow-hidden bg-surface">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.backgroundColor = product.imagePlaceholder.bg;
                          parent.style.display = 'flex';
                          parent.style.alignItems = 'center';
                          parent.style.justifyContent = 'center';
                          const span = document.createElement('span');
                          span.className = 'font-heading text-4xl font-semibold opacity-80';
                          span.style.color = (product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85") ? "#2D2D2D" : "#FAF8F5";
                          span.textContent = product.imagePlaceholder.initials;
                          parent.appendChild(span);
                        }
                      }}
                    />
                  </div>
                </Link>
                <div className="p-4 lg:p-5">
                  <Link href={"/shop/" + product.slug}>
                    <h3 className="font-heading text-base font-medium tracking-tight hover:text-sand transition-colors">{product.name}</h3>
                  </Link>
                  <p className="text-warm-gray text-xs mt-1 tracking-wide">{product.variant}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-dark font-medium text-sm">{formatPrice(product.price)}</span>
                    <button onClick={() => addItem(product)} className="text-sand text-xs font-medium tracking-wide hover:text-sand-dark transition-colors uppercase">Add to Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="bg-charcoal rounded-sm p-8 sm:p-12 lg:p-16 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-offwhite tracking-tight">Stay in the Loop</h2>
          <p className="mt-4 text-warm-gray text-sm sm:text-base leading-relaxed max-w-lg mx-auto">Be the first to discover new arrivals, exclusive offers, and deals delivered to your inbox.</p>
          {subscribed ? (
            <div className="mt-8 flex items-center justify-center gap-2 text-sand">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm tracking-wide">Thank you for subscribing.</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" required className="w-full px-5 py-3 bg-dark-lighter border border-offwhite/10 text-offwhite text-sm placeholder-warm-gray rounded-sm focus:outline-none focus:border-sand/50 transition-colors" />
              <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">Subscribe</button>
            </form>
          )}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.139-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold">Free Shipping</h3>
              <p className="mt-2 text-warm-gray text-sm leading-relaxed">Complimentary delivery on orders over AED 300 across the UAE.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold">Secure Payment</h3>
              <p className="mt-2 text-warm-gray text-sm leading-relaxed">Pay 50% upfront via card, and 50% cash on delivery. Safe and simple.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold">Delivered to UAE</h3>
              <p className="mt-2 text-warm-gray text-sm leading-relaxed">We deliver to all seven emirates with care and precision.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
