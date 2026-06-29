/**
 * Variant grouping system.
 * Groups similar products (same base name, different color/style) into variant sets.
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
  return new RegExp("\b" + word + "\b", flags);
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
