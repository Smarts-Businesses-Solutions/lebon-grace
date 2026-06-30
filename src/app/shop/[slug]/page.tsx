import type { Metadata } from "next";
import { getProductBySlug, products } from "@/lib/products";
import ProductDetailClient from "./ProductDetailClient";

// ─── Per-product SEO metadata ───
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found — Lebon Grace",
      robots: { index: false, follow: false },
    };
  }

  const title = `${product.name} — Lebon Grace`;
  const description = product.description || `Buy ${product.name} at ${product.price} AED. Pay 50% now, 50% on delivery. Ships to UAE.`;
  const url = `https://shop.lebon-grace.com/shop/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lebon Grace",
      images: [{ url: product.imageUrl, width: 800, height: 800, alt: product.name }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.imageUrl],
    },
    robots: { index: true, follow: true },
  };
}

// ─── Product JSON-LD structured data ───
function ProductJsonLd({ slug }: { slug: string }) {
  const product = getProductBySlug(slug);
  if (!product) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [product.imageUrl],
    description: product.description || `Buy ${product.name} at Lebon Grace`,
    sku: product.cjPid || slug,
    brand: { "@type": "Brand", name: "Lebon Grace" },
    category: product.category,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "AED",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://shop.lebon-grace.com/shop/${slug}`,
      seller: { "@type": "Organization", name: "Lebon Grace" },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <ProductJsonLd slug={slug} />
      <ProductDetailClient />
    </>
  );
}