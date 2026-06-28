"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { products, formatPrice, categories } from "@/lib/products";
import { Suspense } from "react";

const filterTabs = ["All", ...categories.map((c) => c.name)] as const;
const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A\u2013Z" },
];

function StarRating({ index }: { index: number }) {
  const rating = (index % 3 === 0) ? 5 : (index % 2 === 0 ? 4.5 : 4);
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.floor(rating) ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-warm-gray text-[10px] ml-1">({(index * 7 + 12) % 50 + 5})</span>
    </div>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";
  const [activeFilter, setActiveFilter] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<string>("featured");
  const [visibleCount, setVisibleCount] = useState(24);
  const { addItem } = useCart();

  const filteredProducts = useMemo(() => {
    const filtered = activeFilter === "All"
      ? products
      : products.filter((p) => p.category === activeFilter);

    switch (sortBy) {
      case "price-low": return [...filtered].sort((a, b) => a.price - b.price);
      case "price-high": return [...filtered].sort((a, b) => b.price - a.price);
      case "name-az": return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      default: return filtered;
    }
  }, [activeFilter, sortBy]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-dark">Shop</h1>
          <p className="mt-3 text-warm-gray text-sm">Browse our collection of everyday essentials</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Filter Tabs + Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveFilter(tab); setVisibleCount(24); }}
                className={`px-4 py-1.5 text-sm font-medium tracking-wide rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === tab
                    ? "bg-[#16A34A] text-white"
                    : "bg-white text-charcoal hover:bg-gray-100 border border-border"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-warm-gray text-xs whitespace-nowrap">
              {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length} products
            </span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setVisibleCount(24); }}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white text-dark focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
          {visibleProducts.map((product, index) => (
            <div key={product.slug} className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <Link href={"/shop/" + product.slug}>
                <div className="aspect-square overflow-hidden bg-surface">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                        span.className = 'font-bold text-3xl opacity-80';
                        span.style.color = (product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85") ? "#2D2D2D" : "#FAF8F5";
                        span.textContent = product.imagePlaceholder.initials;
                        parent.appendChild(span);
                      }
                    }}
                  />
                </div>
              </Link>
              <div className="p-2.5">
                <Link href={"/shop/" + product.slug}>
                  <h3 className="text-sm font-medium text-dark leading-snug line-clamp-2 hover:text-[#16A34A] transition-colors">{product.name}</h3>
                </Link>
                <StarRating index={index} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-dark font-bold text-base">{formatPrice(product.price)}</span>
                  <button
                    onClick={() => addItem(product)}
                    className="px-3 py-1.5 bg-[#16A34A] text-white text-xs font-semibold tracking-wide uppercase rounded-lg hover:bg-[#15803D] active:scale-95 transition-all"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-warm-gray text-sm">No products found in this category.</p>
          </div>
        )}

        {/* Load More */}
        {visibleCount < filteredProducts.length && (
          <div className="text-center mt-10">
            <button
              onClick={() => setVisibleCount((prev) => prev + 24)}
              className="px-8 py-3 bg-dark text-white text-sm font-semibold tracking-wide rounded-lg hover:bg-charcoal transition-colors"
            >
              Load More ({Math.min(24, filteredProducts.length - visibleCount)} remaining)
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-warm-gray">Loading...</div>}>
      <ShopContent />
    </Suspense>
  );
}
