/**
 * CJ Variant Extractor for Tabbit.ai
 *
 * HOW TO USE IN TABBIT:
 * 1. Open Tabbit browser
 * 2. Log into cjdropshipping.com
 * 3. Open DevTools (F12) → Console
 * 4. Paste this entire script
 * 5. It will extract variants from the current product page
 * 6. Run extractAll() to process all products
 */

// Extract variants from current CJ product page
function extractCurrentPage() {
  const result = { name: "", images: [], variants: [], price: 0 };

  // Product name
  const h1 = document.querySelector("h1");
  result.name = h1?.textContent?.trim() || "";

  // All product images
  const imgSet = new Set();
  document.querySelectorAll("img").forEach((img) => {
    const src = img.src || img.getAttribute("data-src") || "";
    if (src && (src.includes("cjdropshipping") || src.includes("oss-cf"))) {
      imgSet.add(src);
    }
  });
  result.images = [...imgSet];

  // Variant selectors - try multiple patterns
  const variantPatterns = [
    "[class*='sku'] [class*='item']",
    "[class*='variant'] [class*='item']",
    "[class*='attr'] [class*='value']",
    "[class*='spec'] [class*='item']",
    "[class*='option'] [class*='item']",
    "[class*='color'] [class*='chip']",
    "[class*='size'] [class*='button']",
    "[data-sku]",
    "[data-variant]",
  ];

  const seen = new Set();
  variantPatterns.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const img = el.querySelector("img");
      const text = el.textContent?.trim() || "";
      const sku = el.getAttribute("data-sku") || el.getAttribute("data-variant") || "";
      if (text && text.length < 50 && !seen.has(text) && !text.includes("Add to") && !text.includes("Buy")) {
        seen.add(text);
        result.variants.push({ name: text, image: img?.src || "", sku });
      }
    });
  });

  // Also check select dropdowns
  document.querySelectorAll("select").forEach((sel) => {
    sel.querySelectorAll("option").forEach((opt) => {
      const val = opt.value || opt.textContent?.trim() || "";
      if (val && val !== "Select" && val !== "Choose" && val.length > 1 && val.length < 30 && !seen.has(val)) {
        seen.add(val);
        result.variants.push({ name: val, image: "", sku: "" });
      }
    });
  });

  // Price
  const priceEl = document.querySelector("[class*='price'], [class*='Price']");
  if (priceEl) result.price = parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, "") || "0") || 0;

  return result;
}

// Store results
const allResults = JSON.parse(localStorage.getItem("cj-variants") || "{}");

// Add current page
const current = extractCurrentPage();
const url = window.location.href;
const pidMatch = url.match(/p-(\d+)/);
if (pidMatch) {
  allResults[pidMatch[1]] = {
    ...current,
    cjPid: pidMatch[1],
    url,
    extractedAt: new Date().toISOString(),
  };
  localStorage.setItem("cj-variants", JSON.stringify(allResults));
  console.log(`✅ Extracted: ${current.name}`);
  console.log(`   Images: ${current.images.length}`);
  console.log(`   Variants: ${current.variants.length}`);
  console.log(`   Total stored: ${Object.keys(allResults).length}`);
} else {
  console.log("❌ No CJ PID found in URL");
}

// Export function - call this when done extracting
function exportResults() {
  const data = localStorage.getItem("cj-variants");
  if (data) {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cj-variants-tabbit.json";
    a.click();
    URL.revokeObjectURL(url);
    console.log("📥 Downloaded cj-variants-tabbit.json");
  }
}

// Show status
console.log("\n=== CJ Variant Extractor ===");
console.log(`Stored: ${Object.keys(allResults).length} products`);
console.log("To export: exportResults()");
console.log("To import: run node scripts/import-tabbit-variants.js");
