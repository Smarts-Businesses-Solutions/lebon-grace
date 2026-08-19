import Link from "next/link";
import ContactInfo from "./ContactInfo";

const quickLinks = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?category=Alphabet+%26+Literacy", label: "Alphabet & Literacy" },
  { href: "/shop?category=Numbers+%26+Counting", label: "Numbers & Counting" },
  { href: "/shop?category=Shapes+%26+Montessori", label: "Shapes & Montessori" },
  { href: "/shop?category=Animals+%26+Nature", label: "Animals & Nature" },
  { href: "/shop?category=Vehicles+%26+Making", label: "Vehicles & Making" },
  { href: "/shop?category=3D+%26+Architecture", label: "3D & Architecture" },
  // Spelled out here rather than shortened to "Custom" as in the header: a
  // footer is where people look when they did not find what they wanted, and
  // "a photo or a logo" is the thing they were looking for.
  { href: "/custom", label: "Photo & Logo Engraving" },
  // Clearance lives here rather than in the main navigation: it is stock being
  // emptied, not part of the made-to-order range.
  // Removed 2026-08-09 with the listing itself (A-16). The category is hidden
  // pending a recount, so this link led every visitor to an empty grid — the
  // clearance stock is materially misdescribed and must not be advertised while
  // that is unresolved. Restore this line when the listing is republished.
  // { href: "/shop?category=Clearance", label: "Clearance" },
];

const policyLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/track", label: "Track Order" },
  { href: "/account", label: "My Account" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

export default function Footer() {
  return (
    <footer className="bg-dark text-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="py-12 lg:py-16 grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
          {/* Brand column */}
          <div>
            <span className="font-heading text-xl tracking-[0.2em] text-offwhite font-semibold">
              LEBON GRACE
            </span>
            <p className="mt-4 text-offwhite/70 text-sm leading-relaxed max-w-xs">
              Wooden puzzles for children, cut and finished by hand in our
              workshop. Made to order, with a name engraved free.
            </p>
            {/* The Instagram icon that used to sit here linked to "#", so it looked
                like a social presence and went nowhere. Add it back with a real
                handle when there is one. */}
            <div className="mt-6 flex gap-4">
              {/* Email */}
              {/*
                * min-w-11/min-h-11 gives a 44px tap target around a 20px icon.
                *
                * Without it the anchor shrink-wraps to the SVG's 20x20, under
                * WCAG 2.2 SC 2.5.8's 24x24 minimum. The header's icon buttons
                * already use this exact pattern; the footer's did not, which is
                * the kind of inconsistency nobody catches by reading.
                */}
              <a
                href="/contact"
                className="min-w-11 min-h-11 inline-flex items-center justify-center text-offwhite/70 hover:text-sand transition-colors"
                aria-label="Contact us"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </a>
            </div>
            {/*
              * This was a hand-written teaser, "+971 58 ••• ••30", and it was
              * WRONG: the shop's number changed to +971 52 839 9804 and the
              * mask kept advertising the old one's first and last digits. Four
              * real digits is not enough for a visitor to dial and is plenty
              * for a scraper to correlate, so the teaser was costing accuracy
              * to buy nothing.
              *
              * ContactInfo fetches the number on click from
              * /api/contact/reveal, where it lives in one place. There is now
              * no copy of it in this file to go stale.
              */}
            <div className="mt-4 text-offwhite/70">
              <ContactInfo />
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-heading text-sm tracking-wider uppercase text-offwhite/70 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-offwhite/80 hover:text-sand transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-heading text-sm tracking-wider uppercase text-offwhite/70 mb-4">
              Information
            </h3>
            <ul className="space-y-3">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-offwhite/80 hover:text-sand transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-offwhite/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-offwhite/70 text-xs tracking-wide">
            &copy; 2026 Lebon Grace. All rights reserved.
          </p>
          <p className="text-offwhite/70/60 text-xs text-center sm:text-right">
            Sharjah Media City, Al Messaned, Al Bataeh, Sharjah, UAE
          </p>
        </div>
      </div>
    </footer>
  );
}
