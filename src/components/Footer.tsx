import Link from "next/link";

const quickLinks = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?category=Alphabet+%26+Literacy", label: "Alphabet & Literacy" },
  { href: "/shop?category=Numbers+%26+Counting", label: "Numbers & Counting" },
  { href: "/shop?category=Shapes+%26+Montessori", label: "Shapes & Montessori" },
  { href: "/shop?category=Animals+%26+Nature", label: "Animals & Nature" },
  { href: "/shop?category=Vehicles+%26+Making", label: "Vehicles & Making" },
  { href: "/shop?category=3D+%26+Architecture", label: "3D & Architecture" },
  // Clearance lives here rather than in the main navigation: it is stock being
  // emptied, not part of the made-to-order range.
  { href: "/shop?category=Clearance", label: "Clearance" },
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
            <p className="mt-4 text-warm-gray text-sm leading-relaxed max-w-xs">
              Wooden puzzles for children, cut and finished by hand in our
              workshop. Made to order, with a name engraved free.
            </p>
            {/* The Instagram icon that used to sit here linked to "#", so it looked
                like a social presence and went nowhere. Add it back with a real
                handle when there is one. */}
            <div className="mt-6 flex gap-4">
              {/* Email */}
              <a
                href="/contact"
                className="text-warm-gray hover:text-sand transition-colors"
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
            <div className="mt-4 flex items-center gap-3 text-warm-gray text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span className="select-none">+971 58 ••• ••30</span>
              <span className="text-warm-gray/40">|</span>
              <span>WhatsApp available</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-heading text-sm tracking-wider uppercase text-warm-gray mb-4">
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
            <h3 className="font-heading text-sm tracking-wider uppercase text-warm-gray mb-4">
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
          <p className="text-warm-gray text-xs tracking-wide">
            &copy; 2026 Lebon Grace. All rights reserved.
          </p>
          <p className="text-warm-gray/60 text-xs text-center sm:text-right">
            Sharjah Media City, Al Messaned, Al Bataeh, Sharjah, UAE
          </p>
        </div>
      </div>
    </footer>
  );
}
