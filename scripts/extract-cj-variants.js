/**
 * CJ Variant Extractor
 *
 * USAGE:
 *   node scripts/extract-cj-variants.js [limit]
 *
 * Flow:
 *   1. Opens CJ in a browser window
 *   2. You log in manually
 *   3. Script extracts variants from all products
 *   4. Saves to data/cj-variants-extracted.json
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const PRODUCTS_FILE = path.join(__dirname, "..", "data", "cj-products.json");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "cj-variants-extracted.json");
const RATE_LIMIT_MS = 3000;

async function extractVariantData(page, pid, slug) {
  const url = `https://cjdropshipping.com/product/${slug}-p-${pid}.html`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    if (page.url().includes("validation")) {
      await page.waitForTimeout(10000);
      if (page.url().includes("validation")) return { error: "Cloudflare" };
    }
    if (page.url().includes("login")) return { error: "Not logged in" };

    return await page.evaluate(() => {
      const r = { name: "", images: [], variants: [], price: 0 };
      r.name = document.querySelector("h1")?.textContent?.trim() || "";
      const imgSet = new Set();
      document.querySelectorAll("img").forEach((img) => {
        const src = img.src || "";
        if (src && (src.includes("cjdropshipping") || src.includes("oss-cf"))) imgSet.add(src);
      });
      r.images = [...imgSet];
      const seen = new Set();
      ["[class*=sku] [class*=item]","[class*=variant] [class*=item]","[class*=attr] [class*=value]","[class*=spec] [class*=item]","[class*=option] [class*=item]","[class*=color] [class*=chip]","[class*=size] [class*=button]","[data-sku]","[data-variant]"].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const img = el.querySelector("img");
          const text = el.textContent?.trim() || "";
          if (text && text.length < 50 && !seen.has(text) && !text.includes("Add to") && !text.includes("Buy")) {
            seen.add(text);
            r.variants.push({ name: text, image: img?.src || "", sku: el.getAttribute("data-sku") || "" });
          }
        });
      });
      document.querySelectorAll("select").forEach((sel) => {
        sel.querySelectorAll("option").forEach((opt) => {
          const val = opt.value || opt.textContent?.trim() || "";
          if (val && val !== "Select" && val !== "Choose" && val.length > 1 && val.length < 30 && !seen.has(val)) {
            seen.add(val);
            r.variants.push({ name: val, image: "", sku: "" });
          }
        });
      });
      const priceEl = document.querySelector("[class*=price],[class*=Price]");
      if (priceEl) r.price = parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, "") || "0") || 0;
      return r;
    });
  } catch (err) {
    return { error: err.message?.substring(0, 100) };
  }
}

async function main() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error("No data/cj-products.json found");
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  const maxProducts = parseInt(process.argv[2]) || products.length;
  console.log(`Products to process: ${Math.min(maxProducts, products.length)}`);

  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8")); } catch {}
  console.log(`Already extracted: ${Object.keys(existing).length}`);

  const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Navigate to CJ - user logs in manually
  console.log("\n=== LOG IN TO CJ ===");
  console.log("A browser window will open. Please log into CJ Dropshipping.");
  console.log("After logging in, press Enter in this terminal to continue.\n");
  await page.goto("https://cjdropshipping.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Wait for user to log in
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  // Verify login
  const currentUrl = page.url();
  if (currentUrl.includes("login")) {
    console.log("Still on login page. Please log in first.");
    await browser.close();
    return;
  }
  console.log("Logged in successfully!\n");

  // Process products
  let processed = 0, withVariants = 0, errors = 0;
  const batch = products.slice(0, maxProducts);

  for (const product of batch) {
    if (existing[product.cjPid]) { processed++; continue; }

    process.stdout.write(`[${processed + 1}/${batch.length}] ${product.name.substring(0, 40)}... `);
    const data = await extractVariantData(page, product.cjPid, product.slug);

    if (data.error) {
      console.log(`❌ ${data.error}`);
      errors++;
    } else {
      existing[product.cjPid] = {
        slug: product.slug, name: data.name || product.name, cjPid: product.cjPid,
        images: data.images, variants: data.variants, price: data.price || parseFloat(product.cjPrice) || 0,
        extractedAt: new Date().toISOString(),
      };
      if (data.variants.length > 0) { withVariants++; console.log(`✅ ${data.variants.length} variants`); }
      else { console.log(`ℹ️ ${data.images.length} images, no variants`); }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));
    await page.waitForTimeout(RATE_LIMIT_MS);
    processed++;

    if (processed % 50 === 0 && processed < batch.length) {
      console.log(`\n--- Pausing 30s after ${processed} products ---\n`);
      await page.waitForTimeout(30000);
    }
  }

  await browser.close();
  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed} | With variants: ${withVariants} | Errors: ${errors}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
