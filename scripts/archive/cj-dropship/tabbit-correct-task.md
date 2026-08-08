# Tabbit.ai — CORRECT EXTRACTION TASK

## STOP what you're doing. You're extracting from the wrong shop.

## Here are the EXACT instructions:

### 1. Go to CJ Dropshipping (the RIGHT shop)
- Navigate to: https://cjdropshipping.com
- Log in with my CJ account

### 2. Read my product list
Open this file: `C:\Users\user\Desktop\aprojects\lebon-grace\data\cj-products.json`

This file contains MY 540 products that I sell on shop.lebon-grace.com. Each product has a `cjPid` field — this is the CJ Product ID.

### 3. Visit CJ product pages using THIS URL pattern
For each product in the JSON file, visit:
`https://cjdropshipping.com/product/{product-name-slugified}-p-{cjPid}.html`

Example: If cjPid is "2606260228141616700" and name is "Christmas Accessories PVC Soft Rubber Shoe Buckles", the URL is:
`https://cjdropshipping.com/product/christmas-accessories-pvc-soft-rubber-shoe-buckles-p-2606260228141616700.html`

### 4. Extract from EACH CJ product page
- Product name (h1 heading)
- ALL product images (every img tag with cjdropshipping or oss-cf in URL)
- Variant options (color/size/style buttons or selectors)
- Variant image URLs
- Product price

### 5. Save to THIS file
`C:\Users\user\Desktop\aprojects\lebon-grace\data\tabbit-cj-variants.json`

### 6. DO NOT
- Do NOT extract from any other shop
- Do NOT extract random products
- Do NOT skip the cjPid from the JSON file
- Do NOT make up variant data

### 7. Rate limits
- Wait 3 seconds between CJ page loads
- Pause 15 seconds every 10 products
- Start with 20 products as a test
