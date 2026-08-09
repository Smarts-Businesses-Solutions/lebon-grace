# Tabbit.ai CJ Variant Extraction — Complete Workflow

## Step 1: Open Tabbit + Log into CJ
1. Open **Tabbit.ai** browser
2. Go to **cjdropshipping.com**
3. Log in with your CJ account
4. Verify you can see product pages (try opening any product)

## Step 2: Give Tabbit This Task

Copy and paste the entire block below into Tabbit's Operator chat:

---

**Task: Extract CJ product variants for my e-commerce store**

I need you to visit CJ Dropshipping product pages and extract variant data (colors, sizes, images).

**Step 1:** Read the product list from this file:
`C:\Users\user\Desktop\aprojects\lebon-grace\data\cj-products.json`

This has 540 products. Process the first 20 as a test batch.

**Step 2:** For each product, visit this URL pattern:
`https://cjdropshipping.com/product/{product-name-slugified}-p-{cjPid}.html`

The slugified name is the product name lowercased with spaces replaced by hyphens. The cjPid is in the JSON file.

**Step 3:** On each CJ product page, extract:
- Product name (from the h1 heading)
- ALL product images (every image URL containing "cjdropshipping" or "oss-cf")
- Variant options (look for buttons/elements with class names containing: sku, variant, attr, spec, option, color, size)
- For each variant: name, image URL, SKU
- Product price

**Step 4:** After extracting from each product, append the data to:
`C:\Users\user\Desktop\aprojects\lebon-grace\data\tabbit-cj-variants.json`

Format for each product entry:
```json
{
  "cjPid": "2606260228141616700",
  "slug": "christmas-accessories-pvc-soft-rubber-sh",
  "name": "Christmas Accessories PVC Soft Rubber Shoe Buckles",
  "images": ["url1.jpg", "url2.jpg"],
  "variants": [
    {"name": "Red", "image": "variant-image.jpg", "sku": "SKU-001"}
  ],
  "price": 25
}
```

**Step 5:** Rate limiting - wait 3 seconds between page loads. After every 10 products, pause for 15 seconds.

**Step 6:** After processing 20 products, stop and report:
- How many processed
- How many had variants
- Any errors

---

## Step 3: Import Results

After Tabbit saves the JSON file, run this command:

```bash
cd C:\Users\user\Desktop\aprojects\lebon-grace
node scripts/import-tabbit-variants.js
```

This imports all extracted variants into Lebon Grace. Product pages will automatically show variant thumbnails.

## Step 4: Verify

Check a product page on shop.lebon-grace.com to see if variants appear.

## Step 5: Scale Up

If the test batch works, ask Tabbit to process all 540 products:
"Continue processing the remaining products from the JSON file. Process 50 at a time with 30-second pauses between batches."
