/**
 * Catalog entry point.
 *
 * The catalog's SINGLE SOURCE OF TRUTH is the `products` table in the
 * self-hosted Postgres. `products.generated.ts` is emitted from it by
 *   node scripts/catalog/04-generate-catalog.mjs
 * and re-exported here so every existing `@/lib/products` import keeps working
 * (the storefront pages are client components and import this synchronously).
 *
 * To change the catalog: edit Postgres, re-run the generator, rebuild.
 * Do NOT hand-edit products.generated.ts.
 *
 * The previous hand-maintained array is kept at products.legacy-static.ts.bak
 * (and in git history) for reference.
 */
export type { Product, Category } from "./products.generated";
export {
  products,
  categories,
  getProductBySlug,
  getProductsByCategory,
  formatPrice,
  calculateSubtotal,
} from "./products.generated";
