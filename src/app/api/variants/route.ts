import { NextRequest, NextResponse } from "next/server";

/**
 * Fetch product variants from CJ Dropshipping API.
 * Requires a valid CJ API key in CJDS_API_KEY env var.
 *
 * CJ API v2: POST /api/v2/products/query with { pid }
 * Returns product details including variant images, colors, sizes, SKUs.
 */

const CJ_API_BASE = "https://developers.cjdropshipping.com/api/v2";

async function getCjAccessToken(): Promise<string | null> {
  const apiKey = process.env.CJDS_API_KEY;
  if (!apiKey) return null;

  // CJ API v2 uses the API key directly as CJ-Access-Token
  // If the key format is "email@apikey", try to get an access token
  const parts = apiKey.split("@");
  if (parts.length === 3) {
    // Format: CJ4810846@api@75f5011d9eda4af2abd482ab29b3f826
    try {
      const resp = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${parts[0]}@${parts[1]}`, password: parts[2] }),
      });
      const data = await resp.json();
      if (data.result && data.data?.accessToken) {
        return data.data.accessToken;
      }
    } catch {
      // fall through
    }
  }

  // Try using the key directly
  return apiKey;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pid = searchParams.get("pid");

  if (!pid) {
    return NextResponse.json({ error: "Product ID (pid) required" }, { status: 400 });
  }

  const accessToken = await getCjAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "CJ API key not configured" }, { status: 500 });
  }

  try {
    // Fetch product details from CJ
    const resp = await fetch(`${CJ_API_BASE}/products/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CJ-Access-Token": accessToken,
      },
      body: JSON.stringify({ pid, pageNum: 1, pageSize: 1 }),
    });

    const data = await resp.json();

    if (!data.result || !data.data?.list?.[0]) {
      return NextResponse.json({ error: "Product not found on CJ", cjError: data.message }, { status: 404 });
    }

    const product = data.data.list[0];

    // Extract variant information
    const variants = (product.variants || []).map((v: Record<string, unknown>) => {
      const vk = String(v.variantKey || "");
      return {
        sku: v.variantSku || v.sku,
        name: v.variantName || v.name,
        image: v.variantImage || v.image,
        price: v.variantSellPrice || v.sellPrice,
        color: vk.includes("Color") ? v.variantValue : undefined,
        size: vk.includes("Size") ? v.variantValue : undefined,
        stock: v.variantStock || v.stock,
      };
    });

    return NextResponse.json({
      pid: product.pid || pid,
      name: product.productNameEn || product.name,
      description: product.description,
      images: product.productImageSet || product.images || [],
      variants,
      price: product.sellPrice,
      weight: product.productWeight,
    });
  } catch (error) {
    console.error("CJ API error:", error);
    return NextResponse.json({ error: "Failed to fetch from CJ API" }, { status: 500 });
  }
}
