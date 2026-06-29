import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CJ_API_BASE = "https://developers.cjdropshipping.com/api/v2";

/**
 * GET /api/variants?slug=product-slug  — lookup from Supabase product_variants table
 * GET /api/variants?pid=123456          — lookup from CJ API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const pid = searchParams.get("pid");

  // 1. Try Supabase product_variants table (populated via WooCommerce CSV import)
  if (slug) {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_slug", slug)
        .order("variant_name");

      if (!error && data && data.length > 0) {
        const variants = data.map((v) => ({
          sku: v.variant_sku,
          name: v.variant_name,
          image: v.variant_image,
          price: v.variant_price,
          color: v.variant_color,
          size: v.variant_size,
        }));

        const images = [...new Set(variants.map((v) => v.image).filter(Boolean))];

        return NextResponse.json({ source: "supabase", variants, images });
      }
    } catch {
      // fall through to CJ API
    }
  }

  // 2. Try CJ API (requires valid key, may be rate-limited)
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
            color: vk.includes("Color") ? v.variantValue : undefined,
            size: vk.includes("Size") ? v.variantValue : undefined,
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
