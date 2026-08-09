/**
 * CJ Dropshipping Variant Extractor
 *
 * HOW TO USE:
 * 1. Open Chrome DevTools (F12) on any CJ product page
 * 2. Paste this entire script into the Console tab
 * 3. Press Enter — it will extract variant data and download as JSON
 * 4. Upload the JSON to Lebon Grace via /api/import
 *
 * Works on pages like:
 * https://cjdropshipping.com/product/xxx-p-2606260228141616700.html
 */

(async function extractCJVariants() {
  console.log("🔍 CJ Variant Extractor starting...");

  // Check if we're on a CJ product page
  if (!window.location.href.includes("cjdropshipping.com")) {
    console.error("❌ Please run this on a cjdropshipping.com product page");
    return;
  }

  // Extract product data from the page
  const productData = extractProductFromPage();

  if (!productData) {
    console.error("❌ Could not extract product data. Make sure the page has loaded.");
    return;
  }

  console.log("✅ Product found:", productData.name);
  console.log("   Variants:", productData.variants.length);

  // Download as JSON
  const blob = new Blob([JSON.stringify({ products: [productData] }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cj-variants-${productData.cjPid}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("📥 Downloaded! Upload this file to https://shop.lebon-grace.com/api/import");

  return productData;
})();

function extractProductFromPage() {
  // Try to get product data from window.__INITIAL_STATE__ or similar
  const initialState = window.__INITIAL_STATE__ || window.__NEXT_DATA__ || null;

  // Extract from DOM
  const name = document.querySelector("h1, .product-title, [class*='productName']")?.textContent?.trim() || "";
  const priceText = document.querySelector("[class*='price'], [class*='Price']")?.textContent?.trim() || "";
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

  // Extract PID from URL
  const pidMatch = window.location.href.match(/p-(\d+)/);
  const pid = pidMatch ? pidMatch[1] : "";

  // Extract main image
  const mainImg = document.querySelector("img[src*='cjdropshipping'], img[src*='oss-cf']")?.src || "";

  // Extract variants from the page
  const variants = [];

  // Method 1: Look for variant option buttons/selects
  const variantOptions = document.querySelectorAll(
    "[class*='variant'] [class*='option'], " +
    "[class*='Variant'] [class*='Option'], " +
    "[class*='sku'] [class*='item'], " +
    "[class*='attr'] [class*='value'], " +
    "[class*='swatch'], " +
    "[class*='color'] [class*='chip'], " +
    "[class*='size'] [class*='button']"
  );

  variantOptions.forEach((el) => {
    const img = el.querySelector("img")?.src || "";
    const text = el.textContent?.trim() || el.getAttribute("title") || el.getAttribute("alt") || "";
    if (text || img) {
      variants.push({
        sku: `${pid}-${variants.length}`,
        name: text,
        image: img,
        color: extractColor(text),
        size: extractSize(text),
      });
    }
  });

  // Method 2: Look for variant images in the gallery
  const galleryImages = document.querySelectorAll(
    "[class*='gallery'] img, [class*='Gallery'] img, " +
    "[class*='thumb'] img, [class*='Thumb'] img, " +
    "[class*='slider'] img, [class*='carousel'] img"
  );

  if (galleryImages.length > 1 && variants.length === 0) {
    galleryImages.forEach((img, i) => {
      const src = img.src || img.getAttribute("data-src") || "";
      if (src && !variants.some((v) => v.image === src)) {
        variants.push({
          sku: `${pid}-img-${i}`,
          name: `Variant ${i + 1}`,
          image: src,
        });
      }
    });
  }

  // Method 3: Look for select dropdowns
  const selects = document.querySelectorAll("select[class*='variant'], select[class*='sku'], select[class*='attr']");
  selects.forEach((select) => {
    const options = select.querySelectorAll("option");
    options.forEach((opt) => {
      const value = opt.value || opt.textContent?.trim() || "";
      if (value && value !== "Select" && value !== "Choose") {
        variants.push({
          sku: `${pid}-${value.replace(/\s+/g, "-").toLowerCase()}`,
          name: value,
          image: mainImg,
          color: extractColor(value),
          size: extractSize(value),
        });
      }
    });
  });

  // Method 4: Extract from page source/JSON
  const pageSource = document.documentElement.innerHTML;
  const variantMatches = pageSource.match(/"variants?":\s*\[(.*?)\]/s);
  if (variantMatches) {
    try {
      const parsed = JSON.parse(`[${variantMatches[1]}]`);
      parsed.forEach((v) => {
        if (v.variantName || v.variantImage) {
          variants.push({
            sku: v.variantSku || v.sku || `${pid}-${variants.length}`,
            name: v.variantName || v.name || "",
            image: v.variantImage || v.image || mainImg,
            color: v.variantKey?.includes("Color") ? v.variantValue : undefined,
            size: v.variantKey?.includes("Size") ? v.variantValue : undefined,
          });
        }
      });
    } catch (e) {
      // ignore parse errors
    }
  }

  // Deduplicate variants by image URL
  const uniqueVariants = [];
  const seenImages = new Set();
  for (const v of variants) {
    if (v.image && seenImages.has(v.image)) continue;
    if (v.image) seenImages.add(v.image);
    uniqueVariants.push(v);
  }

  // Extract description
  const desc = document.querySelector("[class*='description'], [class*='Description'], .product-desc")?.textContent?.trim() || "";

  return {
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
    name: name,
    price: price,
    category: "General",
    cjPid: pid,
    imageUrl: mainImg,
    description: desc.slice(0, 500),
    stock: 50,
    variants: uniqueVariants.length > 0 ? uniqueVariants : [{ sku: pid, name: "Default", image: mainImg }],
  };
}

function extractColor(text) {
  const colors = ["black", "white", "red", "blue", "green", "pink", "gold", "silver", "brown", "grey", "gray", "purple", "beige", "navy", "rose", "orange", "yellow", "cream", "bronze", "copper", "champagne", "wine", "teal", "mint", "coral", "peach", "lavender", "turquoise", "leopard"];
  const lower = text.toLowerCase();
  for (const c of colors) {
    if (lower.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return undefined;
}

function extractSize(text) {
  const sizes = ["mini", "small", "medium", "large", "xl", "xxl", "oversized"];
  const lower = text.toLowerCase();
  for (const s of sizes) {
    if (new RegExp("\\b" + s + "\\b", "i").test(lower)) return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return undefined;
}
