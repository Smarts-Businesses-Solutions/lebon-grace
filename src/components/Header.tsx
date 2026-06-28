"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import SearchBar from "@/components/SearchBar";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=Home+Decor", label: "Home" },
  { href: "/shop?category=Fashion+%26+Accessories", label: "Fashion" },
  { href: "/shop?category=Jewelry", label: "Jewelry" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOverlay, setSearchOverlay] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-offwhite/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-3">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <img src="/logo.svg" alt="Lebon Grace" className="h-8 lg:h-10 w-auto" />
            </Link>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-6">
              <SearchBar />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href.startsWith("/shop") &&
                    pathname.startsWith("/shop") &&
                    link.href !== "/shop");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm tracking-wide transition-colors ${
                      isActive
                        ? "text-sand font-medium"
                        : "text-charcoal-light hover:text-sand"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: Search + Cart + Mobile menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Mobile search button */}
              <button
                onClick={() => setSearchOverlay(true)}
                className="md:hidden p-2 text-charcoal hover:text-sand transition-colors"
                aria-label="Search"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>

              {/* Cart */}
              <Link
                href="/cart"
                className="relative p-2 text-charcoal hover:text-sand transition-colors"
                aria-label="Shopping cart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-sand text-white text-[10px] font-bold h-4.5 w-4.5 flex items-center justify-center rounded-full">
                    {totalItems}
                  </span>
                )}
              </Link>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-charcoal hover:text-sand transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-offwhite">
            <nav className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm tracking-wide text-charcoal hover:text-sand hover:bg-sand/5 rounded-lg transition-colors">
                  {link.label}
                </Link>
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
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm tracking-wide text-charcoal/70 hover:text-sand hover:bg-sand/5 rounded-lg transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Search Overlay */}
      {searchOverlay && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <SearchBar variant="overlay" onClose={() => setSearchOverlay(false)} autoFocus />
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* SearchBar dropdown will show here */}
          </div>
        </div>
      )}
    </>
  );
}
