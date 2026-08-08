/**
 * Variant grouping — DERIVED from the catalogue, by name.
 *
 * Groups similar products (same base name, different colour/style) into variant
 * sets by parsing their names. It invents nothing and stores nothing: give it the
 * same catalogue twice and it returns the same groups.
 *
 * ── This is NOT `productVariants` in src/lib/store.ts ──────────────────────
 *
 * The names are close enough to invite a merge. They are different things, and
 * `src/app/api/variants/route.ts` uses both, in a deliberate order:
 *
 *   0. `productVariants.getBySlug()` (store.ts) — the `product_variants` table.
 *      Real supplier SKUs with their own price, image, colour and size.
 *      **Authoritative.** Checked first.
 *   1. `getVariantGroup()` (this file) — used only when the database has nothing
 *      for that slug. A best-effort guess from product names.
 *   2. the MDF finish × size matrix, then a live CJ API lookup.
 *
 * So this module is a FALLBACK for products whose real variants were never
 * imported. Collapsing the two would either lose the authoritative SKU data or
 * make name-parsing authoritative — and it is not; it cannot know a price or a
 * stock level, only what a product happens to be called.
 *
 * ACTION_PLAN.md A-13. The audit (finding A-2) recorded this file as duplicating
 * `src/lib/product-variants.ts`. That file had already been deleted three days
 * before the audit was written (ef23391, 2026-08-02). There is no duplicate —
 * there are two layers, and this comment is the "documented reason for two" the
 * acceptance criterion asks for.
 */

import { products, type Product } from "./products";

export interface Variant {
  slug: string;
  name: string;
  image: string;
  price: number;
  cjPid?: string;
  color?: string;
  size?: string;
}

export interface VariantGroup {
  baseName: string;
  variants: Variant[];
  colors: string[];
  sizes: string[];
}

const COLOR_KEYWORDS = [
  "black", "white", "red", "blue", "green", "pink", "gold", "silver",
  "brown", "grey", "gray", "purple", "beige", "navy", "rose", "orange",
  "yellow", "cream", "bronze", "copper", "champagne", "wine", "teal",
  "mint", "coral", "peach", "lavender", "turquoise", "leopard", "rainbow",
  "multicolor", "transparent", "clear", "dark", "light",
];

const SIZE_KEYWORDS = ["mini", "small", "medium", "large", "xl", "xxl", "oversized"];

function wordRegex(word: string, flags?: string): RegExp {
  return new RegExp("\\b" + word + "\\b", flags);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extractColor(name: string): string {
  const lower = name.toLowerCase();
  for (const c of COLOR_KEYWORDS) {
    if (wordRegex(c).test(lower)) return capitalize(c);
  }
  return "";
}

export function extractSize(name: string): string {
  const lower = name.toLowerCase();
  for (const s of SIZE_KEYWORDS) {
    if (wordRegex(s, "i").test(lower)) return capitalize(s);
  }
  return "";
}

function getBaseName(name: string): string {
  let base = name.toLowerCase();
  for (const color of COLOR_KEYWORDS) {
    base = base.replace(wordRegex(color, "gi"), "");
  }
  for (const size of SIZE_KEYWORDS) {
    base = base.replace(wordRegex(size, "gi"), "");
  }
  base = base
    .replace(/\bstyle\s*\d*\b/gi, "")
    .replace(/\bpattern\s*\d*\b/gi, "")
    .replace(/\bdesign\s*\d*\b/gi, "")
    .replace(/\btype\s*[a-z]\b/gi, "")
    .replace(/\b[a-z]\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base;
}

const variantMap = new Map<string, VariantGroup>();

function buildVariantGroups() {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    // Skip MDF products — each is a unique shape, not a variant of another
    if (product.cjPid?.startsWith("MDF")) continue;
    const base = getBaseName(product.name);
    if (base.length < 5) continue;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(product);
  }

  for (const [base, prods] of groups) {
    if (prods.length < 2) continue;

    const colors = new Set<string>();
    const sizes = new Set<string>();

    const variants: Variant[] = prods.map((p) => {
      const color = extractColor(p.name);
      const size = extractSize(p.name);
      if (color) colors.add(color);
      if (size) sizes.add(size);
      return {
        slug: p.slug,
        name: p.name,
        image: p.imageUrl,
        price: p.price,
        cjPid: p.cjPid,
        color,
        size,
      };
    });

    const group: VariantGroup = {
      baseName: base,
      variants,
      colors: Array.from(colors),
      sizes: Array.from(sizes),
    };

    for (const v of variants) {
      variantMap.set(v.slug, group);
    }
  }
}

buildVariantGroups();

export function getVariantGroup(slug: string): VariantGroup | null {
  return variantMap.get(slug) || null;
}

export function getSimilarProducts(product: Product, limit = 4): Product[] {
  const name = product.name.toLowerCase();
  const nameWords = name.split(/\s+/).filter((w) => w.length > 3);

  return products
    .filter((p) => p.slug !== product.slug && p.category === product.category)
    .map((p) => {
      const pName = p.name.toLowerCase();
      const matchScore = nameWords.filter((w) => pName.includes(w)).length;
      return { product: p, score: matchScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.product);
}
