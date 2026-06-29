import { NextRequest, NextResponse } from "next/server";
import { products } from "@/lib/products";
import { getVariantGroup } from "@/lib/variants";

const CJ_API_BASE = "https://developers.cjdropshipping.com/api/v2";

// Color/size/style keywords for extracting variant labels
const COLOR_KEYWORDS = [
  "black", "white", "red", "blue", "green", "pink", "gold", "silver",
  "brown", "grey", "gray", "purple", "beige", "navy", "rose", "orange",
  "yellow", "cream", "bronze", "copper", "champagne", "wine", "teal",
  "mint", "coral", "peach", "lavender", "turquoise", "leopard", "rainbow",
  "multicolor", "transparent", "clear", "dark", "light",
];

function extractVariantLabel(name: string): string {
  const lower = name.toLowerCase();
  // Try color first
  for (const c of COLOR_KEYWORDS) {
    if (new RegExp("\\b" + c + "\\b").test(lower)) {
      return c.charAt(0).toUpperCase() + c.slice(1);
    }
  }
  // Try to extract the last meaningful part after comma
  const parts = name.split(",");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim().slice(0, 20);
  }
  // Try last 2-3 words
  const words = name.split(" ");
  return words.slice(-2).join(" ").slice(0, 20);
}

/**
 * GET /api/variants?slug=product-slug  — get variants from local product data
 * GET /api/variants?pid=123456          — get variants from CJ API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const pid = searchParams.get("pid");

  // 1. Try local variant grouping (no API calls, no new table needed)
  if (slug) {
    const group = getVariantGroup(slug);
    if (group && group.variants.length > 1) {
      const variants = group.variants.map((v) => ({
        sku: v.cjPid || v.slug,
        name: v.name,
        image: v.image,
        price: v.price,
        color: v.color || extractVariantLabel(v.name),
        size: v.size,
      }));

      // Collect unique images for the gallery
      const images = [...new Set(variants.map((v) => v.image).filter(Boolean))];

      return NextResponse.json({ source: "local", variants, images });
    }

    // No local variants — try to find similar products in same category
    const product = products.find((p) => p.slug === slug);
    if (product) {
      const similar = products
        .filter((p) => p.category === product.category && p.slug !== slug)
        .map((p) => {
          const nameWords = product.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const matchScore = nameWords.filter((w) => p.name.toLowerCase().includes(w)).length;
          return { product: p, score: matchScore };
        })
        .filter((x) => x.score >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      if (similar.length > 0) {
        const variants = similar.map((s) => ({
          sku: s.product.cjPid || s.product.slug,
          name: s.product.name,
          image: s.product.imageUrl,
          price: s.product.price,
          color: extractVariantLabel(s.product.name),
        }));

        return NextResponse.json({
          source: "similar",
          variants: [
            {
              sku: product.cjPid || product.slug,
              name: product.name,
              image: product.imageUrl,
              price: product.price,
              color: extractVariantLabel(product.name),
            },
            ...variants,
          ],
          images: [product.imageUrl, ...variants.map((v) => v.image)],
        });
      }
    }

    return NextResponse.json({ source: "none", variants: [], images: [] });
  }

  // 2. CJ API fallback (rate-limited, use sparingly)
  if (pid) {
    const apiKey = process.env.CJDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ source: "none", variants: [], images: [], error: "No CJ API key" });
    }

    try {
      const resp = await fetch(`${CJ_API_BASE}/products/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CJ-Access-Token": apiKey,
        },
        body: JSON.stringify({ pid, pageNum: 1, pageSize: 1 }),
      });

      const data = await resp.json();

      if (data.result && data.data?.list?.[0]) {
        const product = data.data.list[0];
        const variants = (product.variants || []).map((v: Record<string, unknown>) => {
          const vk = String(v.variantKey || "");
          return {
            sku: v.variantSku || v.sku,
            name: v.variantName || v.name,
            image: v.variantImage || v.image,
            price: v.variantSellPrice || v.sellPrice,
            color: vk.includes("Color") ? String(v.variantValue) : undefined,
            size: vk.includes("Size") ? String(v.variantValue) : undefined,
          };
        });

        const images = (product.productImageSet || product.images || []) as string[];
        return NextResponse.json({ source: "cj", variants, images });
      }

      return NextResponse.json({ source: "cj", variants: [], images: [], error: data.message });
    } catch (err) {
      return NextResponse.json({ source: "cj", variants: [], images: [], error: String(err) });
    }
  }

  return NextResponse.json({ source: "none", variants: [], images: [], error: "Provide ?slug= or ?pid=" });
}
