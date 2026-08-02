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
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon-16.png",
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
