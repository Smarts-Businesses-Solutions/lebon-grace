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
  title: "Lebon Grace — Everyday Essentials, Beautifully Priced",
  description:
    "Affordable workspace, travel, home, jewelry, and drinkware accessories. Quality picks, honest prices. Pay 50% now, 50% on delivery.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon-16.png",
    apple: "/apple-touch-icon.png",
  },
  keywords: [
    "affordable accessories",
    "workspace accessories",
    "travel accessories",
    "home decor",
    "jewelry storage",
    "drinkware accessories",
    "UAE",
    "Dubai",
    "D2C",
  ],
  openGraph: {
    title: "Lebon Grace — Everyday Essentials, Beautifully Priced",
    description:
      "Affordable workspace, travel, home, jewelry, and drinkware accessories. Quality picks, honest prices.",
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
