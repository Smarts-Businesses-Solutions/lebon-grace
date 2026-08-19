import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { getAppUrl } from "@/lib/app-url";
import { UAE_DELIVERY, FREE_DELIVERY_OVER } from "@/lib/delivery";
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
    `${product.name}, hand-made MDF puzzle, made to order in the UAE.`;

  return {
    title: `${product.name}, AED ${product.price} | Lebon Grace`,
    description,
    alternates: { canonical: url },
    // An unlisted product is deliberately invisible: already absent from the
    // listings and the sitemap. Without this it would still be indexable, and
    // the internal test item would end up in Google.
    ...(product.unlisted ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${product.name}, AED ${product.price}`,
      description,
      url,
      type: "website",
      images: image ? [{ url: image, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name}, AED ${product.price}`,
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
      /*
       * Delivery cost, machine readable.
       *
       * AED 20 flat, free over AED 150, existed only as prose on the cart and
       * in the FAQ. A shopping surface or an assistant could read the price but
       * not the delivery, which is half of what a buyer compares. Two entries,
       * because the free tier is conditional on order value and
       * eligibleTransactionVolume is how that condition is expressed.
       *
       * The numbers come from lib/delivery, the same module checkout charges
       * from, so the structured data cannot drift from what is billed.
       */
      shippingDetails: [
        {
          "@type": "OfferShippingDetails",
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "AE" },
          shippingRate: { "@type": "MonetaryAmount", value: UAE_DELIVERY, currency: "AED" },
        },
        {
          "@type": "OfferShippingDetails",
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "AE" },
          shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "AED" },
          eligibleTransactionVolume: {
            "@type": "PriceSpecification",
            minPrice: FREE_DELIVERY_OVER,
            priceCurrency: "AED",
          },
        },
      ],
      // 7 days is what /terms and the FAQ both state. Change it in all three or
      // this becomes a promise the shop does not keep.
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "AE",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
    // Emitted only when the catalogue actually holds them. An absent field is
    // honest; a guessed one is a claim the shop cannot stand behind.
    material: product.details?.material,
    audience: product.details?.age
      ? { "@type": "PeopleAudience", suggestedMinAge: 3, suggestedMaxAge: 6 }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        /*
         * The escape is real now. It was not before.
         *
         * This replaced < with a single-backslash u003c escape -- which in TypeScript
         * source IS the character < itself, so the call replaced < with <. An identity
         * operation wearing the costume of an escape, under a comment claiming
         * JSON.stringify handled it. JSON.stringify does not escape <.
         *
         * The doubled backslash emits the six literal characters \u003c into
         * the JSON string. Any parser decodes them back to <, so the meaning is
         * unchanged, but </script> can no longer appear in the markup and close
         * the tag early.
         *
         * The payload is our own catalogue rather than user input, so this was
         * unlikely to be reached. A comment claiming a protection that does not
         * exist is worse than no comment: it stops the next reader checking.
         */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetailClient />
    </>
  );
}
