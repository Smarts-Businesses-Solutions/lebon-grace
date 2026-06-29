"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { products as enrichedProducts } from "@/lib/product-filters";
import { categories, formatPrice } from "@/lib/products";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=Home+Decor", label: "Home" },
  { href: "/shop?category=Fashion+%26+Accessories", label: "Fashion" },
  { href: "/shop?category=Jewelry", label: "Jewelry" },
  { href: "/about", label: "About" },
];

const RECENT_KEY = "lebon-grace-recent-searches";
const MAX_RECENT = 5;
const TRENDING = ["earring", "keychain", "bag", "pet", "jewelry", "candle"];

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

export default function Header() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOverlay, setSearchOverlay] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedCat, setSelectedCat] = useState("All");
  const [catOpen, setCatOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Instant search results
  const results = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return enrichedProducts
      .filter((p) => {
        const matchesQuery = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.color && p.color.toLowerCase().includes(q));
        const matchesCat = selectedCat === "All" || p.category === selectedCat;
        return matchesQuery && matchesCat;
      })
      .slice(0, 8);
  }, [query, selectedCat]);

  const categoryMatches = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3);
  }, [query]);

  const recentSearches = getRecentSearches();
  const showDropdown = focused && (query.trim().length >= 2 || recentSearches.length > 0);

  const allItems = query.trim().length >= 2
    ? [
        ...categoryMatches.map((c) => ({ type: "category" as const, value: c.name })),
        ...results.map((p) => ({ type: "product" as const, value: p.slug, label: p.name })),
      ]
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < allItems.length) {
      const item = allItems[selectedIndex];
      if (item.type === "category") router.push(`/shop?category=${encodeURIComponent(item.value)}`);
      else router.push(`/shop/${item.value}`);
    } else if (query.trim()) {
      saveRecentSearch(query.trim());
      const catParam = selectedCat !== "All" ? `&category=${encodeURIComponent(selectedCat)}` : "";
      router.push(`/shop?search=${encodeURIComponent(query.trim())}${catParam}`);
    }
    setFocused(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((prev) => Math.max(prev - 1, -1)); }
    else if (e.key === "Escape") { setFocused(false); }
  };

  const navigateTo = (url: string) => {
    router.push(url);
    setFocused(false);
    setQuery("");
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (<>{text.slice(0, idx)}<span className="font-semibold text-[#16A34A]">{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-offwhite/95 backdrop-blur-sm border-b border-border">
        {/* Top bar: Logo + Search + Cart */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 lg:h-[70px] gap-3 lg:gap-4">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <img src="/logo.svg" alt="Lebon Grace" className="h-8 lg:h-10 w-auto" />
            </Link>

            {/* ── Amazon/AliExpress Style Search Bar (desktop) ── */}
            <div className="hidden md:flex flex-1 items-center">
              <div className="flex w-full max-w-4xl">
                {/* Category dropdown */}
                <div ref={catRef} className="relative flex-shrink-0">
                  <button
                    onClick={() => setCatOpen(!catOpen)}
                    className="flex items-center gap-1.5 h-[46px] px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    {selectedCat === "All" ? "All" : selectedCat.length > 12 ? selectedCat.slice(0, 12) + "…" : selectedCat}
                    <svg className={`w-3 h-3 transition-transform ${catOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {catOpen && (
                    <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-80 overflow-y-auto">
                      <button onClick={() => { setSelectedCat("All"); setCatOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${selectedCat === "All" ? "bg-[#16A34A]/5 text-[#16A34A] font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                        All Categories
                      </button>
                      {categories.map((cat) => (
                        <button key={cat.name} onClick={() => { setSelectedCat(cat.name); setCatOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${selectedCat === cat.name ? "bg-[#16A34A]/5 text-[#16A34A] font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search input */}
                <div className="relative flex-1">
                  <form onSubmit={handleSubmit}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); }}
                      onFocus={() => setFocused(true)}
                      onKeyDown={handleKeyDown}
                      placeholder="Search for products, brands, categories..."
                      className="w-full h-[46px] px-4 text-base bg-white border-y border-gray-300 outline-none focus:border-[#C9A96E] transition-colors placeholder:text-gray-400"
                      aria-label="Search products"
                    />
                  </form>
                  {query && (
                    <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Search button */}
                <button
                  onClick={handleSubmit}
                  className="flex items-center justify-center h-[46px] px-5 bg-[#16A34A] text-white rounded-r-xl hover:bg-[#15803D] transition-colors flex-shrink-0"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>
              </div>

              {/* Instant results dropdown */}
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
                  role="listbox"
                >
                  {/* Category matches */}
                  {categoryMatches.length > 0 && (
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
                      {categoryMatches.map((cat) => {
                        const globalIdx = allItems.findIndex((i) => i.type === "category" && i.value === cat.name);
                        return (
                          <button key={cat.name} onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.name)}`)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx ? "bg-[#16A34A]/5" : "hover:bg-gray-50"}`}>
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">{cat.icon}</div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{highlightMatch(cat.name, query)}</p>
                              <p className="text-[11px] text-gray-400">{cat.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Product results */}
                  {results.length > 0 && (
                    <div className={`px-4 ${categoryMatches.length > 0 ? "pt-2" : "pt-4"} pb-2`}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Products</p>
                      {results.map((product, i) => {
                        const globalIdx = categoryMatches.length + i;
                        return (
                          <button key={product.slug} onClick={() => navigateTo(`/shop/${product.slug}`)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx ? "bg-[#16A34A]/5" : "hover:bg-gray-50"}`}>
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = "none"; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{highlightMatch(product.name, query)}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-bold text-[#16A34A]">{formatPrice(product.price)}</span>
                                <span className="text-[11px] text-gray-400">{product.category}</span>
                              </div>
                            </div>
                            {product.color && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full">{product.color}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* No results */}
                  {query.trim().length >= 2 && results.length === 0 && categoryMatches.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-gray-400 text-sm">No results for &ldquo;{query}&rdquo;</p>
                    </div>
                  )}

                  {/* Recent + Trending (no query) */}
                  {query.trim().length < 2 && (
                    <div className="px-4 py-4">
                      {recentSearches.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Searches</p>
                            <button onClick={() => localStorage.removeItem(RECENT_KEY)} className="text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
                          </div>
                          {recentSearches.map((term) => (
                            <button key={term} onClick={() => { setQuery(term); saveRecentSearch(term); router.push(`/shop?search=${encodeURIComponent(term)}`); setFocused(false); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-50 text-left">
                              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-sm text-gray-600">{term}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trending</p>
                        <div className="flex flex-wrap gap-2">
                          {TRENDING.map((term) => (
                            <button key={term} onClick={() => { setQuery(term); saveRecentSearch(term); router.push(`/shop?search=${encodeURIComponent(term)}`); setFocused(false); }} className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-full hover:bg-gray-100 transition-colors">
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{results.length > 0 ? `${results.length} results` : "Type to search"}</span>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">↑↓</kbd> navigate
                      <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">↵</kbd> select
                      <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">esc</kbd> close
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Cart + Mobile */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Mobile search button */}
              <button onClick={() => setSearchOverlay(true)} className="md:hidden p-2 text-charcoal hover:text-sand transition-colors" aria-label="Search">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              </button>

              {/* Cart */}
              <Link href="/cart" className="relative p-2 text-charcoal hover:text-sand transition-colors" aria-label="Shopping cart">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 bg-sand text-white text-[10px] font-bold h-4.5 w-4.5 flex items-center justify-center rounded-full">{totalItems}</span>}
              </Link>

              {/* Mobile menu toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-charcoal hover:text-sand transition-colors" aria-label="Toggle menu">
                {mobileOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Secondary nav bar (desktop) */}
        <div className="hidden lg:block border-t border-gray-100 bg-white/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-8 h-10">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href.startsWith("/shop") && pathname.startsWith("/shop") && link.href !== "/shop");
                return (
                  <Link key={link.href} href={link.href} className={`text-sm tracking-wide transition-colors ${isActive ? "text-sand font-medium" : "text-charcoal-light hover:text-sand"}`}>
                    {link.label}
                  </Link>
                );
              })}
              <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
                <Link href="/track" className="hover:text-sand">Track Order</Link>
                <Link href="/account" className="hover:text-sand">My Account</Link>
              </div>
            </nav>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-offwhite">
            <nav className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm tracking-wide text-charcoal hover:text-sand hover:bg-sand/5 rounded-lg transition-colors">{link.label}</Link>
              ))}
              <hr className="my-2 border-border" />
              <p className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wider">Categories</p>
              {[
                { href: "/shop?category=Pet+Supplies", label: "Pets" },
                { href: "/shop?category=Kitchen+%26+Dining", label: "Kitchen" },
                { href: "/shop?category=Beauty+%26+Grooming", label: "Beauty" },
                { href: "/shop?category=Bags+%26+Travel", label: "Travel" },
                { href: "/shop?category=Desk+%26+Office", label: "Office" },
                { href: "/shop?category=Garden+%26+Outdoor", label: "Garden" },
                { href: "/shop?category=Fitness+%26+Wellness", label: "Fitness" },
                { href: "/track", label: "Track Order" },
                { href: "/account", label: "My Account" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm tracking-wide text-charcoal/70 hover:text-sand hover:bg-sand/5 rounded-lg transition-colors">{link.label}</Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Search Overlay */}
      {searchOverlay && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setSearchOverlay(false)} className="p-2 text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              </button>
              <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) { saveRecentSearch(query.trim()); router.push(`/shop?search=${encodeURIComponent(query.trim())}`); setSearchOverlay(false); setQuery(""); } }} className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for products..."
                  className="w-full pl-12 pr-10 py-3.5 text-lg bg-gray-50 border border-gray-200 rounded-2xl focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </form>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {query.trim().length >= 2 ? (
              <>
                {categoryMatches.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
                    {categoryMatches.map((cat) => (
                      <button key={cat.name} onClick={() => { router.push(`/shop?category=${encodeURIComponent(cat.name)}`); setSearchOverlay(false); setQuery(""); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">{cat.icon}</div>
                        <span className="text-sm font-medium text-gray-800">{highlightMatch(cat.name, query)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Products</p>
                    {results.map((product) => (
                      <button key={product.slug} onClick={() => { router.push(`/shop/${product.slug}`); setSearchOverlay(false); setQuery(""); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"><img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{highlightMatch(product.name, query)}</p>
                          <span className="text-sm font-bold text-[#16A34A]">{formatPrice(product.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {results.length === 0 && categoryMatches.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No results for &ldquo;{query}&rdquo;</p>
                )}
              </>
            ) : (
              <>
                {recentSearches.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recent</p>
                    {recentSearches.map((term) => (
                      <button key={term} onClick={() => { router.push(`/shop?search=${encodeURIComponent(term)}`); setSearchOverlay(false); setQuery(""); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-50 text-left">
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-sm text-gray-600">{term}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trending</p>
                  <div className="flex flex-wrap gap-2">
                    {TRENDING.map((term) => (
                      <button key={term} onClick={() => { router.push(`/shop?search=${encodeURIComponent(term)}`); setSearchOverlay(false); setQuery(""); }} className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-full hover:bg-gray-100">{term}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
