import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
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
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-offwhite text-dark antialiased">
        <PostHogProvider>
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <WhatsAppButton />
          </CartProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
