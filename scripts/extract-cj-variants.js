/**
 * CJ Variant Extractor — Run this on YOUR machine (where CJ works)
 *
 * USAGE:
 *   cd lebon-grace
 *   node scripts/extract-cj-variants.js
 *
 * Requirements:
 *   - Node.js 18+
 *   - Playwright installed (npm install playwright)
 *   - CJ Dropshipping logged in on your default browser
 *
 * This script:
 * 1. Reads product list from data/cj-products.json
 * 2. Opens each CJ product page in a headless browser
 * 3. Extracts variant images, colors, sizes, SKUs
 * 4. Saves results to data/cj-variants-extracted.json
 * 5. Rate-limited: 3 seconds between requests
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const PRODUCTS_FILE = path.join(__dirname, "..", "data", "cj-products.json");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "cj-variants-extracted.json");
const RATE_LIMIT_MS = 3000; // 3 seconds between requests

async function extractVariantData(page, pid, slug) {
  const url = `https://cjdropshipping.com/product/${slug}-p-${pid}.html`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    // Check for Cloudflare challenge
    if (page.url().includes("validation")) {
      console.log("  ⚠️ Cloudflare challenge — waiting 10s...");
      await page.waitForTimeout(10000);
      if (page.url().includes("validation")) {
        return { error: "Cloudflare blocked" };
      }
    }

    // Extract data from page
    const data = await page.evaluate(() => {
      const result = { name: "", images: [], variants: [], price: 0 };

      // Product name
      const h1 = document.querySelector("h1");
      result.name = h1?.textContent?.trim() || "";

      // All product images
      const imgs = document.querySelectorAll("img");
      const imgSet = new Set();
      imgs.forEach((img) => {
        const src = img.src || img.getAttribute("data-src") || "";
        if (src && (src.includes("cjdropshipping") || src.includes("oss-cf"))) {
          imgSet.add(src);
        }
      });
      result.images = [...imgSet];

      // Variant selectors
      // Method 1: DOM elements with variant-related classes
      const variantEls = document.querySelectorAll(
        "[class*='sku'], [class*='variant'], [class*='attr'], " +
        "[class*='spec'], [class*='option'], [class*='color'], [class*='size']"
      );
      variantEls.forEach((el) => {
        const img = el.querySelector("img");
        const text = el.textContent?.trim() || "";
        if (text && text.length < 50 && !text.includes("Add to") && !text.includes("Buy")) {
          result.variants.push({
            name: text,
            image: img?.src || "",
          });
        }
      });

      // Method 2: Select dropdowns
      document.querySelectorAll("select").forEach((sel) => {
        const options = sel.querySelectorAll("option");
        options.forEach((opt) => {
          const val = opt.value || opt.textContent?.trim() || "";
          if (val && val !== "Select" && val !== "Choose" && val.length > 1 && val.length < 30) {
            result.variants.push({ name: val, image: "" });
          }
        });
      });

      // Method 3: Checkboxes / radio buttons
      document.querySelectorAll("input[type='checkbox'], input[type='radio']").forEach((inp) => {
        const label = document.querySelector(`label[for='${inp.id}']`);
        const text = label?.textContent?.trim() || inp.value || "";
        if (text && text.length > 1 && text.length < 30) {
          result.variants.push({ name: text, image: "" });
        }
      });

      // Price
      const priceEl = document.querySelector("[class*='price'], [class*='Price']");
      if (priceEl) {
        result.price = parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, "") || "0") || 0;
      }

      return result;
    });

    // Deduplicate variants by name
    const seen = new Set();
    data.variants = data.variants.filter((v) => {
      if (seen.has(v.name)) return false;
      seen.add(v.name);
      return true;
    });

    return data;
  } catch (err) {
    return { error: err.message?.substring(0, 100) };
  }
}

async function main() {
  // Load products
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error("❌ No data/cj-products.json found");
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  console.log(`Found ${products.length} products to process`);

  // Load existing results
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
  } catch {}
  const alreadyExtracted = Object.keys(existing).length;
  console.log(`Already extracted: ${alreadyExtracted}`);

  // Launch browser
  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: false, // Use headed mode so CJ sees a real browser
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // First, navigate to CJ to establish session
  console.log("\nNavigating to CJ...");
  try {
    await page.goto("https://cjdropshipping.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    console.log("CJ loaded: " + page.url().substring(0, 60));
  } catch (e) {
    console.log("Warning: " + e.message.substring(0, 80));
  }

  // Process products
  let processed = 0;
  let withVariants = 0;
  let errors = 0;
  const maxProducts = parseInt(process.argv[2]) || products.length; // Optional: limit count

  for (const product of products.slice(0, maxProducts)) {
    if (existing[product.cjPid]) {
      processed++;
      continue;
    }

    process.stdout.write(`[${processed + 1}/${maxProducts}] ${product.name.substring(0, 40)}... `);

    const data = await extractVariantData(page, product.cjPid, product.slug);

    if (data.error) {
      console.log(`❌ ${data.error}`);
      errors++;
    } else {
      existing[product.cjPid] = {
        slug: product.slug,
        name: data.name || product.name,
        cjPid: product.cjPid,
        images: data.images,
        variants: data.variants,
        price: data.price || parseFloat(product.cjPrice) || 0,
        extractedAt: new Date().toISOString(),
      };

      if (data.variants.length > 0) {
        withVariants++;
        console.log(`✅ ${data.variants.length} variants, ${data.images.length} images`);
      } else {
        console.log(`ℹ️ ${data.images.length} images, no variants`);
      }
    }

    // Save after each product
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));

    // Rate limit
    await page.waitForTimeout(RATE_LIMIT_MS);
    processed++;

    // Pause after 50 products to avoid rate limiting
    if (processed % 50 === 0 && processed < maxProducts) {
      console.log(`\n--- Pausing 30s after ${processed} products ---\n`);
      await page.waitForTimeout(30000);
    }
  }

  await browser.close();

  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`With variants: ${withVariants}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
