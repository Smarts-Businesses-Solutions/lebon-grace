# Tabbit Operator Task — CJ Variant Extraction

## Copy this entire text into Tabbit's Operator chat:

---

I need you to extract product variant data from CJ Dropshipping. Here's the workflow:

### Step 1: Read the product list
Open this file and read the product IDs:
`C:\Users\user\Desktop\aprojects\lebon-grace\data\cj-products.json`

It contains 540 products, each with a `cjPid` field.

### Step 2: Visit each product page
For each product, navigate to:
`https://cjdropshipping.com/product/{product-name-slugified}-p-{cjPid}.html`

### Step 3: Extract variant data from each page
On each CJ product page, extract:
- Product name (from h1)
- ALL product images (every img tag with cjdropshipping or oss-cf in the URL)
- Variant options (look for buttons/elements with class names containing: sku, variant, attr, spec, option, color, size)
- For each variant: name, image URL, SKU
- Product price

### Step 4: Save results
After extracting from each product, save to:
`C:\Users\user\Desktop\aprojects\lebon-grace\data\tabbit-cj-variants.json`

Format:
```json
{
  "cjPid": { "slug": "...", "name": "...", "images": [...], "variants": [...], "price": 0 }
}
```

### Step 5: Rate limiting
- Wait 3 seconds between product pages
- After every 50 products, pause for 30 seconds
- If you hit a Cloudflare challenge, wait 10 seconds then retry

### Step 6: Start with 20 products as a test
Process the first 20 products first. Save results. I'll verify before processing all 540.

### Step 7: Report progress
After each batch of 20, report:
- How many processed
- How many had variants
- Any errors
