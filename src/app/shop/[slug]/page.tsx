import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import ProductDetailClient from "./ProductDetailClient";

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

  if (!getProductBySlug(slug)) {
    notFound();
  }

  return <ProductDetailClient />;
}
