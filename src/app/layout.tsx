import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Analytics from "@/components/Analytics";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="min-h-screen flex flex-col bg-offwhite text-dark antialiased">
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <WhatsAppButton />
          </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
