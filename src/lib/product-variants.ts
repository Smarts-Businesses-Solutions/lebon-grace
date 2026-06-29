/**
 * Product variants from Supabase.
 * These are populated via the /api/import endpoint (WooCommerce CSV import).
 */

import { createClient } from "@supabase/supabase-js";

export interface ProductVariant {
  product_slug: string;
  variant_sku: string;
  variant_name: string;
  variant_image: string;
  variant_color?: string;
  variant_size?: string;
  variant_price?: number;
}

/**
 * Fetch variants for a product from Supabase.
 * Called client-side from the product detail page.
 */
export async function fetchVariants(slug: string): Promise<ProductVariant[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_slug", slug)
      .order("variant_name");

    if (error || !data) return [];
    return data as ProductVariant[];
  } catch {
    return [];
  }
}
