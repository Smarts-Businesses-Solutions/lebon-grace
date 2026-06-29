import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * WooCommerce-style product import endpoint.
 *
 * Accepts product data in WooCommerce CSV format and stores variants in Supabase.
 *
 * WooCommerce CSV columns we handle:
 * - ID, Type, SKU, Name, Published, Attribute 1 name, Attribute 1 value(s),
 *   Attribute 2 name, Attribute 2 value(s), Images, Regular price, Stock, Categories,
 *   Parent, Description
 *
 * Also accepts our custom JSON format:
 * {
 *   "products": [
 *     {
 *       "slug": "product-slug",
 *       "name": "Product Name",
 *       "price": 25,
 *       "category": "Jewelry",
 *       "cjPid": "2606260228141616700",
 *       "imageUrl": "https://...",
 *       "description": "...",
 *       "stock": 50,
 *       "variants": [
 *         { "sku": "...", "name": "Red", "image": "https://...", "color": "Red", "price": 25 },
 *         { "sku": "...", "name": "Blue", "image": "https://...", "color": "Blue", "price": 25 }
 *       ]
 *     }
 *   ]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle JSON format
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (body.products && Array.isArray(body.products)) {
        return await importJsonProducts(body.products);
      }

      return NextResponse.json({ error: "Invalid JSON format. Expected { products: [...] }" }, { status: 400 });
    }

    // Handle CSV format (WooCommerce export)
    if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      let csvText = "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file");
        if (file && typeof file === "object" && "text" in file) {
          csvText = await (file as File).text();
        }
      } else {
        csvText = await request.text();
      }

      if (!csvText) {
        return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });
      }

      const products = parseWooCommerceCSV(csvText);
      return await importJsonProducts(products);
    }

    return NextResponse.json(
      { error: "Unsupported content type. Use application/json or text/csv" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

interface Variant {
  sku: string;
  name: string;
  image: string;
  color?: string;
  size?: string;
  price?: number;
}

interface ImportProduct {
  slug: string;
  name: string;
  price: number;
  category: string;
  cjPid?: string;
  imageUrl?: string;
  description?: string;
  stock?: number;
  variants?: Variant[];
}

/**
 * Parse WooCommerce CSV export into our product format.
 *
 * WooCommerce exports have parent products and variations as separate rows.
 * Parent rows have Type="simple" or "variable", variations have Type="variation"
 * and a Parent column linking to the parent SKU.
 */
function parseWooCommerceCSV(csv: string): ImportProduct[] {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => { colIndex[h.trim().toLowerCase()] = i; });

  // Find key column indices
  const getCol = (row: string[], name: string): string => {
    const idx = colIndex[name.toLowerCase()];
    return idx !== undefined ? (row[idx] || "").trim() : "";
  };

  // First pass: collect parent products
  const parentMap = new Map<string, ImportProduct>();
  const variationRows: { parent: string; row: string[] }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 3) continue;

    const type = getCol(row, "type").toLowerCase();
    const sku = getCol(row, "sku");
    const name = getCol(row, "name");
    const parentSku = getCol(row, "parent") || getCol(row, "parent sku");

    if (type === "variation" || parentSku) {
      variationRows.push({ parent: parentSku, row });
    } else if (name) {
      // Parent product
      const slug = slugify(name);
      const images = getCol(row, "images");
      const firstImage = images.split(",")[0]?.trim() || "";

      parentMap.set(sku || slug, {
        slug,
        name,
        price: parseFloat(getCol(row, "regular price")) || 0,
        category: getCol(row, "categories") || "General",
        cjPid: getCol(row, "cj pid") || sku,
        imageUrl: firstImage,
        description: getCol(row, "description"),
        stock: parseInt(getCol(row, "stock")) || 50,
        variants: [],
      });
    }
  }

  // Second pass: attach variations to parents
  for (const { parent, row } of variationRows) {
    const parentProduct = parentMap.get(parent);
    if (!parentProduct) continue;

    const images = getCol(row, "images");
    const firstImage = images.split(",")[0]?.trim() || "";

    // Extract attributes (Color, Size, Style, etc.)
    let color = "";
    let size = "";
    let variantName = "";

    for (let a = 1; a <= 5; a++) {
      const attrName = getCol(row, `attribute ${a} name`).toLowerCase();
      const attrValue = getCol(row, `attribute ${a} value(s)`);
      if (attrName.includes("color") || attrName.includes("colour")) color = attrValue;
      else if (attrName.includes("size")) size = attrValue;
      else if (attrName.includes("style") || attrName.includes("pattern")) variantName = attrValue;
    }

    parentProduct.variants!.push({
      sku: getCol(row, "sku"),
      name: variantName || color || size || `Variant ${parentProduct.variants!.length + 1}`,
      image: firstImage || parentProduct.imageUrl || "",
      color: color || undefined,
      size: size || undefined,
      price: parseFloat(getCol(row, "regular price")) || undefined,
    });
  }

  // Add default variant for products with no variations
  for (const product of parentMap.values()) {
    if (product.variants!.length === 0) {
      product.variants!.push({
        sku: product.cjPid || product.slug,
        name: "Default",
        image: product.imageUrl || "",
      });
    }
  }

  return Array.from(parentMap.values());
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function importJsonProducts(products: ImportProduct[]) {
  let imported = 0;
  let variantsAdded = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      // Upsert product in Supabase
      const { error: productError } = await supabase
        .from("products")
        .upsert(
          {
            slug: product.slug,
            name: product.name,
            price: product.price,
            category: product.category,
            stock: product.stock || 50,
            image_url: product.imageUrl || "",
            description: product.description || "",
            cj_pid: product.cjPid || "",
          },
          { onConflict: "slug" }
        );

      if (productError) {
        errors.push(`${product.slug}: ${productError.message}`);
        continue;
      }

      imported++;

      // Store variants in a product_variants table (create if needed)
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const { error: variantError } = await supabase
            .from("product_variants")
            .upsert(
              {
                product_slug: product.slug,
                variant_sku: variant.sku,
                variant_name: variant.name,
                variant_image: variant.image,
                variant_color: variant.color || null,
                variant_size: variant.size || null,
                variant_price: variant.price || product.price,
              },
              { onConflict: "product_slug,variant_sku" }
            );

          if (variantError) {
            errors.push(`  ${product.slug}/${variant.sku}: ${variantError.message}`);
          } else {
            variantsAdded++;
          }
        }
      }
    } catch (err) {
      errors.push(`${product.slug}: ${err}`);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    variantsAdded,
    errors: errors.length > 0 ? errors : undefined,
  });
}
