"use client";

import Link from "next/link";
import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { formatPrice, categories } from "@/lib/products";
import {
  products,
  COLORS,
  SIZES,
  MATERIALS,
  PRICE_TIERS,
  applyFilters,
  getFilterCounts,
  DEFAULT_FILTERS,
  type FilterState,
  type EnrichedProduct,
} from "@/lib/product-filters";
import { Suspense } from "react";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A–Z" },
  { value: "name-za", label: "Name: Z–A" },
];

/* ─── Star Rating ─── */
function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.floor(rating) ? "text-yellow-400" : i - 0.5 <= rating ? "text-yellow-300" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-gray-400 text-[11px] ml-0.5">({count})</span>
    </div>
  );
}

/* ─── Category Showcase ─── */
function CategoryShowcase() {
  const topCategories = categories.slice(0, 8);
  const categoryImages: Record<string, string> = {
    Jewelry: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=200&h=200&fit=crop",
    "Home Decor": "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=200&h=200&fit=crop",
    "Fashion & Accessories": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=200&h=200&fit=crop",
    "Pet Supplies": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop",
    "Kitchen & Dining": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
    "Beauty & Grooming": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop",
    "Home Storage": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=200&h=200&fit=crop",
    "Bags & Travel": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop",
  };
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {topCategories.map((cat) => (
            <Link key={cat.name} href={"/shop?category=" + encodeURIComponent(cat.name)} className="group flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-transparent group-hover:border-[#16A34A] transition-colors duration-200">
                {categoryImages[cat.name] ? (
                  <img src={categoryImages[cat.name]} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xl">{cat.icon}</div>
                )}
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-[#16A34A] transition-colors leading-tight">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Filter Section Component ─── */
function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 py-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-left">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ product, index, onAdd }: { product: EnrichedProduct; index: number; onAdd: () => void }) {
  const rating = 3.5 + (index % 3) * 0.5;
  const reviewCount = (index * 7 + 12) % 50 + 5;

  return (
    <div className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Color badge */}
      {product.color && (
        <div className="absolute top-2 left-2 z-10">
          <span className="px-2 py-0.5 bg-white/90 text-gray-600 text-[10px] font-medium rounded-full border border-gray-200 backdrop-blur-sm">{product.color}</span>
        </div>
      )}

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
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                parent.style.backgroundColor = product.imagePlaceholder.bg;
                parent.style.display = "flex";
                parent.style.alignItems = "center";
                parent.style.justifyContent = "center";
                const span = document.createElement("span");
                span.className = "font-bold text-2xl opacity-60";
                span.style.color = product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85" ? "#2D2D2D" : "#FAF8F5";
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
          <span className="text-gray-900 font-bold text-base">{formatPrice(product.price)}</span>
          <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-[#15803D] active:scale-95 transition-all">
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

/* ─── Main Shop Content ─── */
function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";
  const { addItem } = useCart();

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    category: initialCategory,
  });
  const [visibleCount, setVisibleCount] = useState(24);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Update a single filter field
  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setVisibleCount(24);
    },
    []
  );

  // Toggle a value in an array filter (colors, sizes, materials)
  const toggleArrayFilter = useCallback(
    (key: "colors" | "sizes" | "materials", value: string) => {
      setFilters((prev) => {
        const arr = prev[key];
        const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
        return { ...prev, [key]: next };
      });
      setVisibleCount(24);
    },
    []
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, category: "All" });
    setVisibleCount(24);
  }, []);

  // Count active filters
  const activeFilterCount =
    (filters.category !== "All" ? 1 : 0) +
    filters.colors.length +
    filters.sizes.length +
    filters.materials.length +
    (filters.priceMax !== Infinity || filters.priceMin !== 0 ? 1 : 0) +
    (filters.search ? 1 : 0);

  // Filtered products
  const filteredProducts = useMemo(() => applyFilters(products, filters), [filters]);

  // Filter counts for sidebar
  const filterCounts = useMemo(() => getFilterCounts(products, filters.category), [filters.category]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (filters.category !== "All") activeChips.push({ label: filters.category, onRemove: () => updateFilter("category", "All") });
  filters.colors.forEach((c) => activeChips.push({ label: c, onRemove: () => toggleArrayFilter("colors", c) }));
  filters.sizes.forEach((s) => activeChips.push({ label: s, onRemove: () => toggleArrayFilter("sizes", s) }));
  filters.materials.forEach((m) => activeChips.push({ label: m, onRemove: () => toggleArrayFilter("materials", m) }));
  if (filters.priceMin > 0 || filters.priceMax < Infinity) {
    const tier = PRICE_TIERS.find((t) => t.min === filters.priceMin && t.max === filters.priceMax);
    activeChips.push({ label: tier?.label || `AED ${filters.priceMin}–${filters.priceMax}`, onRemove: () => { updateFilter("priceMin", 0); updateFilter("priceMax", Infinity); } });
  }

  /* ─── Filter Sidebar Content (shared between desktop and mobile) ─── */
  const filterSidebarContent = (
    <div className="space-y-0">
      {/* Category */}
      <FilterSection title="Category">
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          <button onClick={() => updateFilter("category", "All")} className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${filters.category === "All" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            All ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            return (
              <button key={cat.name} onClick={() => updateFilter("category", cat.name)} className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${filters.category === cat.name ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Price */}
      <FilterSection title="Price">
        <div className="space-y-1">
          {PRICE_TIERS.map((tier) => {
            const isActive = filters.priceMin === tier.min && filters.priceMax === tier.max;
            return (
              <button
                key={tier.label}
                onClick={() => {
                  if (isActive) {
                    updateFilter("priceMin", 0);
                    updateFilter("priceMax", Infinity);
                  } else {
                    updateFilter("priceMin", tier.min);
                    updateFilter("priceMax", tier.max);
                  }
                }}
                className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive ? "bg-[#16A34A] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {tier.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Color */}
      {COLORS.length > 0 && (
        <FilterSection title="Color" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((color) => {
              const count = filterCounts.colorCounts[color] || 0;
              if (count === 0) return null;
              const isActive = filters.colors.includes(color);
              return (
                <button
                  key={color}
                  onClick={() => toggleArrayFilter("colors", color)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${isActive ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >
                  {color} ({count})
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Size */}
      {SIZES.length > 0 && (
        <FilterSection title="Size" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((size) => {
              const count = filterCounts.sizeCounts[size] || 0;
              if (count === 0) return null;
              const isActive = filters.sizes.includes(size);
              return (
                <button
                  key={size}
                  onClick={() => toggleArrayFilter("sizes", size)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${isActive ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >
                  {size} ({count})
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Material */}
      {MATERIALS.length > 0 && (
        <FilterSection title="Material" defaultOpen={false}>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {MATERIALS.map((mat) => {
              const count = filterCounts.materialCounts[mat] || 0;
              if (count === 0) return null;
              const isActive = filters.materials.includes(mat);
              return (
                <label key={mat} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleArrayFilter("materials", mat)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span className="text-xs text-gray-600">{mat}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{count}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}
    </div>
  );

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
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">🚚 Free Shipping</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">💳 Pay 50% Now</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">📦 10-14 Days</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <CategoryShowcase />

      {/* Main Shop Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        <div className="flex gap-8">
          {/* ─── Desktop Sidebar ─── */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</h2>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-[#16A34A] hover:underline font-medium">
                    Clear all
                  </button>
                )}
              </div>
              {filterSidebarContent}
            </div>
          </aside>

          {/* ─── Main Content ─── */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Mobile filter button */}
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && <span className="w-5 h-5 bg-[#16A34A] text-white rounded-full flex items-center justify-center text-[10px]">{activeFilterCount}</span>}
                </button>

                {/* Active filter chips */}
                {activeChips.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeChips.map((chip, i) => (
                      <button key={i} onClick={chip.onRemove} className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white rounded-full text-[11px] font-medium hover:bg-gray-700 transition-colors">
                        {chip.label}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ))}
                    <button onClick={clearFilters} className="text-[11px] text-gray-400 hover:text-gray-600 ml-1">Clear all</button>
                  </div>
                )}
              </div>

              {/* Sort + Count */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-gray-400 text-xs">
                  {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length} products
                </span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter("sortBy", e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none cursor-pointer"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
              {visibleProducts.map((product, index) => (
                <ProductCard key={product.slug + index} product={product} index={index} onAdd={() => addItem(product)} />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-400 text-lg">No products match your filters</p>
                <button onClick={clearFilters} className="mt-4 text-[#16A34A] text-sm font-medium hover:underline">
                  Clear all filters
                </button>
              </div>
            )}

            {/* Load More */}
            {visibleCount < filteredProducts.length && (
              <div className="text-center mt-12 mb-8">
                <button onClick={() => setVisibleCount((prev) => prev + 24)} className="px-10 py-3.5 bg-gray-900 text-white text-sm font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors">
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
                  <p className="text-sm font-medium text-gray-800">Free Pickup</p>
                  <p className="text-xs text-gray-400 mt-0.5">Or AED 25 delivery</p>
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
                  <p className="text-sm font-medium text-gray-800">All Sales Final</p>
                  <p className="text-xs text-gray-400 mt-0.5">Review before buying</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Mobile Filter Slide-over ─── */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">{filterSidebarContent}</div>
              <div className="sticky bottom-0 p-4 bg-white border-t border-gray-100 flex gap-3">
                <button onClick={clearFilters} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Clear all
                </button>
                <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                  Show {filteredProducts.length} results
                </button>
              </div>
            </div>
          </div>
        )}
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
