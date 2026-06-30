# Tabbit.ai Prompt — Copy This Into Tabbit Chat

## Paste this in Tabbit's Operator Agent:

---

I need you to extract product variant data from CJ Dropshipping for my e-commerce store.

**What to do:**
1. Open `C:\Users\user\Desktop\aprojects\lebon-grace\data\cj-products.json` — this has 540 products with their CJ IDs
2. For the first 20 products, visit their CJ pages and extract variant data (colors, sizes, images)
3. Save results to `C:\Users\user\Desktop\aprojects\lebon-grace\data\tabbit-cj-variants.json`

**For each product CJ page (format: https://cjdropshipping.com/product/{name}-p-{cjPid}.html):**
- Extract ALL product images from the gallery
- Look for variant selectors (color swatches, size buttons, style options)
- For each variant, get: name, image URL, SKU, color, size

**Output format:**
```json
{
  "slug": "product-slug",
  "cjPid": "123456789",
  "name": "Product Name",
  "images": ["img1.jpg", "img2.jpg"],
  "variants": [
    {"name": "Red", "image": "red-variant.jpg", "sku": "SKU-001", "color": "Red", "size": ""}
  ]
}
```

Start with 20 products as a test batch. Save progress after each product.
