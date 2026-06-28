"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { products as enrichedProducts } from "@/lib/product-filters";
import { categories, formatPrice } from "@/lib/products";

interface SearchBarProps {
  variant?: "header" | "overlay";
  onClose?: () => void;
  autoFocus?: boolean;
}

const RECENT_KEY = "lebon-grace-recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

// Popular/trending searches
const TRENDING = ["earring", "keychain", "bag", "pet", "jewelry", "candle"];

export default function SearchBar({ variant = "header", onClose, autoFocus }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setFocused(false);
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
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.color && p.color.toLowerCase().includes(q)) ||
          (p.material && p.material.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query]);

  // Category matches
  const categoryMatches = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3);
  }, [query]);

  // Recent searches
  const recentSearches = getRecentSearches();

  // Show dropdown
  const showDropdown = focused && (query.trim().length >= 2 || recentSearches.length > 0);

  // All navigable items
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
      if (item.type === "category") {
        router.push(`/shop?category=${encodeURIComponent(item.value)}`);
      } else {
        router.push(`/shop/${item.value}`);
      }
    } else if (query.trim()) {
      saveRecentSearch(query.trim());
      router.push(`/shop?search=${encodeURIComponent(query.trim())}`);
    }
    setFocused(false);
    setQuery("");
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setFocused(false);
      onClose?.();
    }
  };

  const navigateTo = (url: string) => {
    router.push(url);
    setFocused(false);
    setQuery("");
    onClose?.();
  };

  // Highlight matching text
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-[#16A34A]">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const isOverlay = variant === "overlay";

  return (
    <div className={`relative ${isOverlay ? "w-full" : ""}`}>
      <form onSubmit={handleSubmit} className={isOverlay ? "w-full" : ""}>
        <div className={`relative ${isOverlay ? "w-full" : ""}`}>
          <svg className={`absolute left-3 top-1/2 -translate-y-1/2 ${isOverlay ? "w-5 h-5" : "w-4 h-4"} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, categories..."
            className={`w-full ${isOverlay ? "pl-12 pr-12 py-3.5 text-base" : "pl-10 pr-4 py-2 text-sm"} bg-gray-50 border border-gray-200 rounded-full focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none transition-all placeholder:text-gray-400`}
            aria-label="Search products"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
          />
          {/* Loading / Clear button */}
          {query && (
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className={`absolute ${isOverlay ? "right-4" : "right-3"} top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={`absolute ${isOverlay ? "left-0 right-0" : "left-0 right-0 sm:left-auto sm:right-auto sm:w-[480px]"} top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-[70vh] overflow-y-auto`}
          role="listbox"
        >
          {/* Category matches */}
          {categoryMatches.length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
              {categoryMatches.map((cat) => {
                const globalIdx = allItems.findIndex((i) => i.type === "category" && i.value === cat.name);
                return (
                  <button
                    key={cat.name}
                    onClick={() => navigateTo(`/shop?category=${encodeURIComponent(cat.name)}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx ? "bg-[#16A34A]/5" : "hover:bg-gray-50"}`}
                  >
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
                  <button
                    key={product.slug}
                    onClick={() => navigateTo(`/shop/${product.slug}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx ? "bg-[#16A34A]/5" : "hover:bg-gray-50"}`}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.display = "none";
                          const p = t.parentElement;
                          if (p) {
                            p.style.backgroundColor = product.imagePlaceholder.bg;
                            p.style.display = "flex";
                            p.style.alignItems = "center";
                            p.style.justifyContent = "center";
                            const s = document.createElement("span");
                            s.className = "text-xs font-bold opacity-60";
                            s.textContent = product.imagePlaceholder.initials;
                            p.appendChild(s);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{highlightMatch(product.name, query)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-[#16A34A]">{formatPrice(product.price)}</span>
                        <span className="text-[11px] text-gray-400">{product.category}</span>
                      </div>
                    </div>
                    {product.color && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full">{product.color}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 && results.length === 0 && categoryMatches.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-gray-400 text-sm">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-gray-300 text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {/* Recent + Trending (when no query) */}
          {query.trim().length < 2 && (
            <div className="px-4 py-4">
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Searches</p>
                    <button onClick={() => { localStorage.removeItem(RECENT_KEY); }} className="text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => { setQuery(term); saveRecentSearch(term); router.push(`/shop?search=${encodeURIComponent(term)}`); setFocused(false); onClose?.(); }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">{term}</span>
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trending</p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING.map((term) => (
                    <button
                      key={term}
                      onClick={() => { setQuery(term); saveRecentSearch(term); router.push(`/shop?search=${encodeURIComponent(term)}`); setFocused(false); onClose?.(); }}
                      className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-full hover:bg-gray-100 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer hint */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {results.length > 0 ? `${results.length} results` : "Type to search"}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">↑↓</kbd> navigate
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">↵</kbd> select
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px]">esc</kbd> close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
