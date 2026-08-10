import { NextRequest, NextResponse } from "next/server";
import { products } from "@/lib/products";
import { getVariantGroup } from "@/lib/variants";
import { productVariants } from "@/lib/store";

async function fetchLocalVariants(slug: string) {
  const all = await productVariants.getBySlug(slug);
  if (!all || all.length === 0) return null;
  const variants = all.map((v) => ({
    sku: String(v.variant_sku || ""),
    name: String(v.variant_name || ""),
    image: String(v.variant_image || ""),
    price: Number(v.variant_price || 0),
    color: v.variant_color || undefined,
    size: v.variant_size || undefined,
  }));
  const images = [...new Set(variants.map((v) => v.image).filter(Boolean))] as string[];
  return { source: "local-store", variants, images };
}


// Color keywords for extracting variant labels
const COLOR_KEYWORDS = [
  "black", "white", "red", "blue", "green", "pink", "gold", "silver",
  "brown", "grey", "gray", "purple", "beige", "navy", "rose", "orange",
  "yellow", "cream", "bronze", "copper", "champagne", "wine", "teal",
  "mint", "coral", "peach", "lavender", "turquoise", "leopard", "rainbow",
  "multicolor", "transparent", "clear", "dark", "light",
];

function extractLabel(name: string): string {
  const lower = name.toLowerCase();
  for (const c of COLOR_KEYWORDS) {
    if (new RegExp("\\b" + c + "\\b").test(lower)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  const parts = name.split(",");
  if (parts.length > 1) return parts[parts.length - 1].trim().slice(0, 20);
  return name.split(" ").slice(-2).join(" ").slice(0, 20);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  // 0. Postgres variants — the authoritative source.
  // Every product's real variants (SKU, colour, size, price, image) are synced
  // from the CJ API into product_variants. This must be checked BEFORE the
  // legacy fallbacks below: previously it was only consulted for MDF products,
  // so real variant data existed in the database but was never served.
  if (slug) {
    const fromDb = await fetchLocalVariants(slug);
    if (fromDb && fromDb.variants.length > 0) return NextResponse.json(fromDb);
  }

  // 1. Local variant grouping (no API calls)
  if (slug) {
    const group = getVariantGroup(slug);
    if (group && group.variants.length > 1) {
      const variants = group.variants.map((v) => ({
        sku: v.cjPid || v.slug,
        name: v.name,
        image: v.image,
        price: v.price,
        color: v.color || extractLabel(v.name),
        size: v.size,
      }));
      const images = [...new Set(variants.map((v) => v.image).filter(Boolean))];
      return NextResponse.json({ source: "local", variants, images });
    }

    // MDF products: surface explicit variant matrices from local store (Finish x Size)
    const product = products.find((p) => p.slug === slug);
    if (product?.cjPid?.startsWith("MDF")) {
      const sb = await fetchLocalVariants(slug);
      if (sb) return NextResponse.json(sb);
      return NextResponse.json({ source: "mdf-standalone", variants: [], images: [] });
    }
    // The "similar products" fallback is deliberately gone. It matched other
    // products in the same category by shared words and returned them as
    // VARIANTS, so the product page rendered a "Style" selector listing
    // different puzzles as though they were versions of the one being viewed.
    // Picking one swapped the photograph too, which is why the range looked
    // mixed up. Distinct products are not variants of each other; if a product
    // has no rows in product_variants it simply has no variants.
  }

  return NextResponse.json({ source: "none", variants: [], images: [] });
}
