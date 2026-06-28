"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { products, formatPrice, categories } from "@/lib/products";
import { Suspense } from "react";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A\u2013Z" },
];

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.floor(rating) ? "text-yellow-400" : i - 0.5 <= rating ? "text-yellow-300" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-gray-400 text-[11px] ml-0.5">({count})</span>
    </div>
  );
}

function CategoryShowcase() {
  const topCategories = categories.slice(0, 8);
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {topCategories.map((cat) => {
            const sampleProduct = products.find((p) => p.category === cat.name && p.imageUrl);
            return (
              <Link key={cat.name} href={"/shop?category=" + encodeURIComponent(cat.name)} className="group flex flex-col items-center gap-2 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-transparent group-hover:border-[#16A34A] transition-colors duration-200">
                  {sampleProduct?.imageUrl ? (
                    <img src={sampleProduct.imageUrl} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xl">{cat.icon}</div>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-[#16A34A] transition-colors leading-tight">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, index, onAdd }: { product: typeof products[0]; index: number; onAdd: () => void }) {
  const rating = 3.5 + (index % 3) * 0.5;
  const reviewCount = (index * 7 + 12) % 50 + 5;
  const isNew = index % 5 === 0;
  const isBestseller = index % 7 === 0;

  return (
    <div className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isNew && <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider rounded">New</span>}
        {isBestseller && <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider rounded">Best</span>}
      </div>

      {/* Image */}
      <Link href={"/shop/" + product.slug} className="block">
        <div className="aspect-square overflow-hidden bg-gray-50">
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
                span.className = 'font-bold text-2xl opacity-60';
                span.style.color = (product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85") ? "#2D2D2D" : "#FAF8F5";
                span.textContent = product.imagePlaceholder.initials;
                parent.appendChild(span);
              }
            }}
          />
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <Link href={"/shop/" + product.slug}>
          <h3 className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2 hover:text-[#16A34A] transition-colors mb-1">{product.name}</h3>
        </Link>
        <StarRating rating={rating} count={reviewCount} />
        <div className="flex items-center justify-between mt-2.5">
          <div>
            <span className="text-gray-900 font-bold text-base">{formatPrice(product.price)}</span>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-[#15803D] active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </div>
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
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Shop All Products</h1>
              <p className="mt-2 text-gray-300 text-sm lg:text-base max-w-lg">
                Browse {products.length} everyday essentials across {categories.length} categories. All under AED 50.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3">
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">
                🚚 Free Shipping
              </span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">
                💳 Pay 50% Now
              </span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">
                📦 10-14 Days
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <CategoryShowcase />

      {/* Main Shop Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          {/* Category Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setActiveFilter("All"); setVisibleCount(24); }}
              className={`px-4 py-1.5 text-xs font-semibold tracking-wide rounded-full transition-colors ${
                activeFilter === "All"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => {
              const count = products.filter(p => p.category === cat.name).length;
              return (
                <button
                  key={cat.name}
                  onClick={() => { setActiveFilter(cat.name); setVisibleCount(24); }}
                  className={`px-4 py-1.5 text-xs font-semibold tracking-wide rounded-full transition-colors ${
                    activeFilter === cat.name
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Sort + Count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-gray-400 text-xs">
              {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length}
            </span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setVisibleCount(24); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none cursor-pointer"
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
            <ProductCard
              key={product.slug + index}
              product={product}
              index={index}
              onAdd={() => addItem(product)}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No products found in &ldquo;{activeFilter}&rdquo;</p>
            <button onClick={() => setActiveFilter("All")} className="mt-4 text-[#16A34A] text-sm font-medium hover:underline">
              View all products
            </button>
          </div>
        )}

        {/* Load More */}
        {visibleCount < filteredProducts.length && (
          <div className="text-center mt-12 mb-8">
            <button
              onClick={() => setVisibleCount((prev) => prev + 24)}
              className="px-10 py-3.5 bg-gray-900 text-white text-sm font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors"
            >
              Load More Products
            </button>
            <p className="mt-2 text-gray-400 text-xs">
              Showing {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length} products
            </p>
          </div>
        )}

        {/* Trust Bar */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl mb-2">🚚</div>
              <p className="text-sm font-medium text-gray-800">Free Shipping</p>
              <p className="text-xs text-gray-400 mt-0.5">On orders over AED 300</p>
            </div>
            <div>
              <div className="text-2xl mb-2">💳</div>
              <p className="text-sm font-medium text-gray-800">Pay 50% Now</p>
              <p className="text-xs text-gray-400 mt-0.5">50% on delivery</p>
            </div>
            <div>
              <div className="text-2xl mb-2">🔒</div>
              <p className="text-sm font-medium text-gray-800">Secure Payment</p>
              <p className="text-xs text-gray-400 mt-0.5">Via Stripe</p>
            </div>
            <div>
              <div className="text-2xl mb-2">📦</div>
              <p className="text-sm font-medium text-gray-800">Easy Returns</p>
              <p className="text-xs text-gray-400 mt-0.5">Contact us within 48h</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Loading...</div>}>
      <ShopContent />
    </Suspense>
  );
}
