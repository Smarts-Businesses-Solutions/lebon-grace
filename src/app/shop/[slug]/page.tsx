import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { getAppUrl } from "@/lib/app-url";
import ProductDetailClient from "./ProductDetailClient";

/**
 * Per-product title, description, canonical and share card.
 *
 * Every product page used to serve the ROOT LAYOUT's metadata, so all 41 shared
 * one title and one description. That cost two things that matter: a link
 * shared on WhatsApp rendered a generic shop card rather than the puzzle, and
 * Google saw 41 duplicate titles, which suppresses the lot of them.
 *
 * Unknown slugs return bare metadata rather than throwing — the page 404s a
 * moment later, and a metadata crash would turn a clean 404 into a 500.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const base = getAppUrl();
  const url = `${base}/shop/${product.slug}`;
  const image = product.imageUrl?.startsWith("http")
    ? product.imageUrl
    : `${base}${product.imageUrl || ""}`;

  // Descriptions are written for a person deciding whether to click, so the
  // product's own copy comes first and the shop's promise second.
  const description = (product.description || "").trim().slice(0, 180) ||
    `${product.name} — hand-made wooden puzzle, made to order in the UAE.`;

  return {
    title: `${product.name} — AED ${product.price} | Lebon Grace`,
    description,
    alternates: { canonical: url },
    // An unlisted product is deliberately invisible: already absent from the
    // listings and the sitemap. Without this it would still be indexable, and
    // the internal test item would end up in Google.
    ...(product.unlisted ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${product.name} — AED ${product.price}`,
      description,
      url,
      type: "website",
      images: image ? [{ url: image, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — AED ${product.price}`,
      description,
      images: image ? [image] : [],
    },
  };
}

/**
 * Server wrapper whose only job is the HTTP status.
 *
 * The product page is a client component — it needs state for the engraving
 * input, the quantity control and the variant fetch — and a client component
 * cannot set a response status, because by the time it renders the 200 has
 * already been sent. So for an unknown slug it rendered "Product Not Found"
 * inside a **200 OK**: a soft 404.
 *
 * That is not cosmetic. Crawlers indexed unlimited fake product URLs as real
 * pages, analytics counted fake product views, and — worst for us —
 * `verify:deploy` and every synthetic monitor asserts `status < 400`, so a
 * broken product link was undetectable by the exact tooling built to detect
 * broken deploys.
 *
 * The fix keeps the client component byte-for-byte and puts a server component
 * in front of it. It takes no props: the client reads the slug from
 * `useParams()` exactly as before, so there is no serialisation boundary to get
 * wrong (no Date, Map or class instance can be smuggled across it).
 *
 * `getProductBySlug` already filters hidden products, so a withdrawn listing
 * 404s here too rather than rendering an empty shell.
 *
 * Deliberately NOT done: 410 Gone for withdrawn-but-previously-live products.
 * It is the more correct status and would deindex them faster, but it needs a
 * tombstone list to tell "withdrawn" from "never existed", and there is no such
 * list yet. 404 is honest in both cases; `tests/e2e/seo/status-codes.spec.ts`
 * accepts either, so adding 410 later will not fight the test.
 */
export default async function ProductPage({
  params,
}: {
  // Next 15+ hands `params` in as a Promise. Destructuring it in the signature
  // silently yields undefined and would make every slug look valid again.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = getProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const base = getAppUrl();
  const image = product.imageUrl?.startsWith("http")
    ? product.imageUrl
    : `${base}${product.imageUrl || ""}`;

  // schema.org/Product, so Google can show price and availability directly in
  // results and an AI agent reading the page can answer "what does it cost"
  // without parsing the layout.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: image ? [image] : undefined,
    sku: product.slug,
    brand: { "@type": "Brand", name: "Lebon Grace" },
    offers: {
      "@type": "Offer",
      url: `${base}/shop/${product.slug}`,
      priceCurrency: "AED",
      price: String(product.price),
      availability: "https://schema.org/InStock",
      // Made to order, so this is a promise about lead time, not stock.
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Next requires this for JSON-LD. The payload is our own catalogue
        // data, not user input, and JSON.stringify escapes the closing tag
        // sequence that would otherwise let a description break out.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }}
      />
      <ProductDetailClient />
    </>
  );
}
