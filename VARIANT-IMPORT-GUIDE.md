# How to Import CJ Product Variants

## Step 1: Create the `product_variants` table in Supabase

Go to Supabase SQL Editor and run:

```sql
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_slug text NOT NULL,
  variant_sku text NOT NULL,
  variant_name text NOT NULL DEFAULT '',
  variant_image text DEFAULT '',
  variant_color text,
  variant_size text,
  variant_price numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_slug, variant_sku)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_slug ON product_variants(product_slug);

-- RLS: allow service role to read/write
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage product_variants" ON product_variants
  FOR ALL USING (true) WITH CHECK (true);
```

## Step 2: Export products from CJ

### Option A: CJ WooCommerce Plugin
1. Install the CJ Dropshipping plugin on a temporary WordPress/WooCommerce site
2. Connect your CJ account
3. Import all products (this pulls variants + images)
4. Export from WooCommerce → Products → Export (CSV)

### Option B: Manual CSV
1. Go to CJ Dropshipping → My Products
2. Select products → Export
3. Save as CSV

### Option C: CJ Chrome Extension
1. Install the CJ Dropshipping Chrome extension
2. Browse products and add to your import list
3. Export the list as CSV

## Step 3: Import via API

### Using CSV (WooCommerce format):
```bash
curl -X POST "https://shop.lebon-grace.com/api/import" \
  -H "Content-Type: text/csv" \
  --data-binary @products.csv
```

### Using JSON:
```bash
curl -X POST "https://shop.lebon-grace.com/api/import" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "slug": "christmas-accessories-pvc-soft-rubber-shoe-buckles",
        "name": "Christmas Accessories PVC Soft Rubber Shoe Buckles",
        "price": 25,
        "category": "Seasonal & Gifts",
        "cjPid": "2606260228141616700",
        "imageUrl": "https://cf.cjdropshipping.com/...",
        "variants": [
          {
            "sku": "2606260228141616700-RED",
            "name": "Red",
            "image": "https://cf.cjdropshipping.com/...red.jpg",
            "color": "Red"
          },
          {
            "sku": "2606260228141616700-BLUE",
            "name": "Blue",
            "image": "https://cf.cjdropshipping.com/...blue.jpg",
            "color": "Blue"
          }
        ]
      }
    ]
  }'
```

## Step 4: Verify

After import, visit any product page on Lebon Grace. If variants exist in the `product_variants` table, they will appear as clickable thumbnails below the product title.

## WooCommerce CSV Format Reference

The import endpoint expects these columns (matching WooCommerce export):

| Column | Description |
|--------|-------------|
| Type | "simple" or "variable" (parent) or "variation" (child) |
| SKU | Unique product/variant ID |
| Name | Product name |
| Parent | Parent SKU (for variations) |
| Images | Comma-separated image URLs |
| Regular price | Price in AED |
| Categories | Category name |
| Attribute 1 name | e.g., "Color" |
| Attribute 1 value(s) | e.g., "Red" |
| Attribute 2 name | e.g., "Size" |
| Attribute 2 value(s) | e.g., "Large" |
| Description | Product description |
| Stock | Quantity available |
