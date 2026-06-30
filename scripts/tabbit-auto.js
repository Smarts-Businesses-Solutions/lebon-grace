/**
 * Tabbit.ai Automated CJ Variant Extraction
 *
 * Run this in Tabbit's browser console (F12 → Console)
 * It will automatically visit CJ product pages and extract variants
 */

(async function autoExtract() {
  const PRODUCTS_FILE = "C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\data\\cj-products.json";
  const OUTPUT_FILE = "C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\data\\tabbit-cj-variants.json";
  const BATCH_SIZE = 20;
  const DELAY_MS = 3000;

  console.log("🔍 CJ Variant Auto-Extractor starting...");

  // Load products
  let products;
  try {
    const resp = await fetch("file:///" + PRODUCTS_FILE);
    products = await resp.json();
  } catch {
    // If file:// doesn't work, try reading from the page
    console.log("Cannot read file directly. Using embedded product list...");
    products = [];
  }

  if (products.length === 0) {
    console.log("❌ Cannot load products file. Please paste the product list manually.");
    console.log("Run this in Node.js first: node -e \"console.log(JSON.stringify(require('./data/cj-products.json').slice(0,20)))\"");
    return;
  }

  console.log(`Loaded ${products.length} products`);

  // Load existing results
  let existing = {};
  try {
    const resp = await fetch("file:///" + OUTPUT_FILE);
    existing = await resp.json();
  } catch {}

  const batch = products.slice(0, BATCH_SIZE);
  let processed = 0, withVariants = 0, errors = 0;

  for (const product of batch) {
    if (existing[product.cjPid]) { processed++; continue; }

    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const url = `https://cjdropshipping.com/product/${slug}-p-${product.cjPid}.html`;

    console.log(`[${processed + 1}/${batch.length}] ${product.name.substring(0, 40)}...`);

    try {
      // Navigate to CJ product page
      window.location.href = url;
      await new Promise(r => setTimeout(r, 5000));

      // Check if we're on the right page
      if (window.location.href.includes("login")) {
        console.log("  ⚠️ Not logged in. Please log into CJ first.");
        errors++;
        continue;
      }

      // Extract data
      const data = (() => {
        const r = { name: "", images: [], variants: [], price: 0 };
        r.name = document.querySelector("h1")?.textContent?.trim() || "";
        const imgSet = new Set();
        document.querySelectorAll("img").forEach(img => {
          if (img.src && (img.src.includes("cjdropshipping") || img.src.includes("oss-cf"))) imgSet.add(img.src);
        });
        r.images = [...imgSet];
        const seen = new Set();
        ["[class*=sku] [class*=item]","[class*=variant] [class*=item]","[class*=attr] [class*=value]","[class*=color] [class*=chip]","[class*=size] [class*=button]","[data-sku]","[data-variant]"].forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const img = el.querySelector("img");
            const text = el.textContent?.trim() || "";
            if (text && text.length < 50 && !seen.has(text) && !text.includes("Add")) {
              seen.add(text);
              r.variants.push({ name: text, image: img?.src || "", sku: el.getAttribute("data-sku") || "" });
            }
          });
        });
        const priceEl = document.querySelector("[class*=price]");
        if (priceEl) r.price = parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, "") || "0") || 0;
        return r;
      })();

      existing[product.cjPid] = { ...data, cjPid: product.cjPid, slug: product.slug, extractedAt: new Date().toISOString() };

      if (data.variants.length > 0) { withVariants++; console.log(`  ✅ ${data.variants.length} variants`); }
      else { console.log(`  ℹ️ ${data.images.length} images, no variants`); }

      // Save
      localStorage.setItem("cj-variants", JSON.stringify(existing));

    } catch (e) {
      console.log(`  ❌ ${e.message?.substring(0, 50)}`);
      errors++;
    }

    processed++;
    await new Promise(r => setTimeout(r, DELAY_MS));

    // Pause after batch
    if (processed % 10 === 0) {
      console.log(`  ⏸️ Pausing 15s after ${processed} products...`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  // Export
  const blob = new Blob([JSON.stringify(existing, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tabbit-cj-variants.json";
  a.click();

  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed} | Variants: ${withVariants} | Errors: ${errors}`);
  console.log("📥 Downloaded tabbit-cj-variants.json");
  console.log("Run: node scripts/import-tabbit-variants.js");
})();
