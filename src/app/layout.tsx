import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import StorefrontChrome from "@/components/StorefrontChrome";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Analytics from "@/components/Analytics";
import "./globals.css";
import { getAppUrl } from "@/lib/app-url";

/**
 * Fraunces for display, Karla for text.
 *
 * Inter did both jobs before. It is a fine interface face and it made the shop
 * look like software: the same typeface as every dashboard and SaaS landing
 * page. Nothing about it said "cut by hand in a workshop".
 *
 * Fraunces is a variable serif with optical SOFT and WONK axes, so it can be
 * warm without tipping into novelty, which suits a children's product that is
 * still a considered object. Karla is a grotesque with enough character to sit
 * beside it and enough restraint to disappear at 14px.
 *
 * Both are SIL Open Font License, so they are licensed for commercial use
 * including the physical goods this shop sells.
 */
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const text = Karla({
  variable: "--font-text",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lebon Grace — Wooden Puzzles, Made to Order in the UAE",
  description:
    "Wooden alphabet, number and Montessori puzzles for children, cut and finished by hand in our UAE workshop. Made to order, free name engraving, free collection.",
  // src/app/favicon.ico used to sit alongside these. It was the stock Vercel
  // triangle from create-next-app, never replaced. Next's file convention gave
  // it rel="icon" sizes="256x256" type="image/x-icon", so browsers preferred it
  // over the LG mark below and the tab showed Vercel's logo. Removing that file
  // also removed a malformed URL: deploymentId appends ?dpl=, and the file
  // convention already carries its own query, producing
  //   /favicon.ico?favicon.2vob68tjqpejf.ico?dpl=20260802173222
  //
  // Order matters. A browser takes the last icon it understands, so the .ico
  // is listed first as the fallback and the SVG last: the SVG is one shape that
  // stays sharp at any size and in dark mode.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 256x256", type: "image/x-icon" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  /*
   * iOS ignores the web app manifest for installation. Adding to the home
   * screen from Safari reads these instead, so without them the shop installs
   * as a browser bookmark with a screenshot for an icon rather than as an app.
   *
   * statusBarStyle "default" rather than "black-translucent": translucent makes
   * the page render UNDER the status bar, so the header's top row sits beneath
   * the clock. Fixing that means a safe-area inset on the header, which is a
   * layout change this is not.
   */
  appleWebApp: {
    capable: true,
    title: "Lebon Grace",
    statusBarStyle: "default",
  },
  keywords: [
    "wooden puzzles",
    "Montessori toys",
    "alphabet puzzle",
    "number puzzle",
    "educational toys",
    "personalised wooden toys",
    "handmade toys UAE",
    "UAE",
    "Sharjah",
    "Dubai",
  ],
  openGraph: {
    title: "Lebon Grace — Wooden Puzzles, Made to Order in the UAE",
    description:
      "Wooden alphabet, number and Montessori puzzles for children, cut and finished by hand in our UAE workshop. Free name engraving.",
    type: "website",
    locale: "en_AE",
  },
};

/**
 * Separate from `metadata` because Next requires it there.
 *
 * themeColor and viewport used to live on the metadata object and were moved in
 * Next 14; leaving them there does not fail the build, it prints a warning and
 * DROPS them, so the tag never reaches the page. That is the failure mode worth
 * naming: the code looks right and the browser gets nothing.
 *
 * Two colours rather than one. The theme colour paints the browser and the
 * standalone window's chrome, so in dark mode the ink reads as part of the
 * system UI, while in light mode a dark bar under a bone page looks like a
 * rendering fault. Matching each scheme to the page behind it is the only way
 * the seam disappears.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#23201c" },
  ],
};

/*
 * Site-wide identity, emitted once on every page.
 *
 * Product pages already carry Product and Offer markup, but nothing tied the
 * shop together: no Organization to hang the brand, logo, email and social
 * profiles on, and no WebSite to declare the search endpoint. Search engines
 * and assistants had per-product facts and no publisher behind them.
 *
 * The @id values are stable URIs, so product markup and anything added later
 * can reference these nodes rather than restating them.
 *
 * NO TELEPHONE, ON PURPOSE. lib/contact.ts keeps the number out of the served
 * HTML and hands it over only through a rate-limited endpoint; it is not in
 * this repo at all. Publishing it here would defeat that on every page, and it
 * is exactly the sort of "more complete structured data" edit that looks like
 * an improvement.
 */
function siteJsonLd(base: string) {
  const org = {
    "@type": "Organization",
    "@id": base + "/#organization",
    name: "Lebon Grace",
    url: base,
    logo: base + "/logo.png",
    email: "care@lebon-grace.com",
    // The accounts the shop actually posts from, verified live 2026-08-14.
    sameAs: ["https://x.com/Evarist69967733", "https://www.tiktok.com/@evabon1"],
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
  };

  const site = {
    "@type": "WebSite",
    "@id": base + "/#website",
    name: "Lebon Grace",
    url: base,
    inLanguage: "en",
    publisher: { "@id": base + "/#organization" },
    // Matches SearchBar.tsx, which pushes /shop?search=<query>. If that route
    // moves, move this with it or the declaration becomes a dead promise.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: base + "/shop?search={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return { "@context": "https://schema.org", "@graph": [org, site] };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="min-h-screen flex flex-col bg-offwhite text-dark antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Same escaping as the product page. A single-backslash literal
            // here would be the character < itself and escape nothing.
            __html: JSON.stringify(siteJsonLd(getAppUrl())).replace(/</g, "\\u003c"),
          }}
        />
          <CartProvider>
            <StorefrontChrome><Header /></StorefrontChrome>
            <main className="flex-1">{children}</main>
            <StorefrontChrome><Footer /></StorefrontChrome>
            <WhatsAppButton />
          </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
