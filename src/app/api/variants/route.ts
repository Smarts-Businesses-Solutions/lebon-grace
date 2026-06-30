import { NextRequest, NextResponse } from "next/server";
import { products } from "@/lib/products";
import { getVariantGroup } from "@/lib/variants";

const CJ_API_BASE = "https://developers.cjdropshipping.com/api/v2";

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

async function fetchCJVariants(pid: string) {
  const apiKey = process.env.CJDS_API_KEY;
  if (!apiKey) return null;

  // Try the key as-is, then try hash-only if it contains @
  const tokens = [apiKey];
  const parts = apiKey.split("@");
  if (parts.length >= 2) {
    tokens.push(parts[parts.length - 1]);
  }

  for (const token of tokens) {
    try {
      const resp = await fetch(`${CJ_API_BASE}/products/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
        body: JSON.stringify({ pid, pageNum: 1, pageSize: 1 }),
      });
      const data = await resp.json();

      if (data.result && data.data?.list?.[0]) {
        const product = data.data.list[0];
        const variants = (product.variants || []).map((v: Record<string, unknown>) => {
          const vk = String(v.variantKey || "");
          return {
            sku: String(v.variantSku || v.sku || ""),
            name: String(v.variantName || v.name || ""),
            image: String(v.variantImage || v.image || ""),
            price: Number(v.variantSellPrice || v.sellPrice || 0),
            color: vk.includes("Color") ? String(v.variantValue) : undefined,
            size: vk.includes("Size") ? String(v.variantValue) : undefined,
          };
        });
        const images = (product.productImageSet || product.images || []) as string[];
        return { source: "cj", variants, images };
      }
    } catch {
      // try next token
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const pid = searchParams.get("pid");

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

    // Similar products fallback
    const product = products.find((p) => p.slug === slug);
    if (product) {
      const similar = products
        .filter((p) => p.category === product.category && p.slug !== slug)
        .map((p) => {
          const words = product.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const score = words.filter((w) => p.name.toLowerCase().includes(w)).length;
          return { product: p, score };
        })
        .filter((x) => x.score >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      if (similar.length > 0) {
        const all = [
          { sku: product.cjPid || product.slug, name: product.name, image: product.imageUrl, price: product.price, color: extractLabel(product.name) },
          ...similar.map((s) => ({ sku: s.product.cjPid || s.product.slug, name: s.product.name, image: s.product.imageUrl, price: s.product.price, color: extractLabel(s.product.name) })),
        ];
        return NextResponse.json({ source: "similar", variants: all, images: all.map((v) => v.image) });
      }
    }
  }

  // 2. CJ API (if pid provided)
  if (pid) {
    const result = await fetchCJVariants(pid);
    if (result) return NextResponse.json(result);
    return NextResponse.json({ source: "cj", variants: [], images: [], error: "CJ API unavailable" });
  }

  return NextResponse.json({ source: "none", variants: [], images: [] });
}
