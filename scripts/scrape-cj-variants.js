/**
 * CJ Variant Scraper — extracts variant data from CJ product pages.
 *
 * USAGE:
 *   node scripts/scrape-cj-variants.js
 *
 * This script:
 * 1. Gets all CJ product IDs from our catalog
 * 2. Visits each CJ product page with a headless browser
 * 3. Extracts variant images, colors, sizes from the page
 * 4. Saves results to data/cj-variants.json
 *
 * Run this from YOUR machine (where you have CJ access), not from a server.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Load products from our catalog
const productsPath = path.join(__dirname, "..", "src", "lib", "products.ts");
const productsSource = fs.readFileSync(productsPath, "utf-8");

// Extract product data using regex (since we can't import TS directly)
const productMatches = [...productsSource.matchAll(
  /\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)",[\s\S]*?cjPid:\s*"([^"]*)",\s*cjPrice:\s*"([^"]*)"[^}]*imageUrl:\s*"([^"]*)"/g
)];

const products = productMatches.map((m) => ({
  slug: m[1],
  name: m[2],
  cjPid: m[3],
  cjPrice: m[4],
  imageUrl: m[5],
})).filter((p) => p.cjPid);

console.log(`Found ${products.length} products with CJ PIDs`);

async function scrapeVariants() {
  const browser = await chromium.launch({
    headless: false, // Use headed mode so Cloudflare sees a real browser
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Load existing results
  const outputPath = path.join(__dirname, "..", "data", "cj-variants.json");
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  } catch {}

  let processed = 0;
  let withVariants = 0;
  let errors = 0;

  for (const product of products) {
    // Skip if already scraped
    if (existing[product.cjPid]) {
      processed++;
      continue;
    }

    const url = `https://cjdropshipping.com/product/${product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-p-${product.cjPid}.html`;

    try {
      console.log(`[${processed + 1}/${products.length}] ${product.name.substring(0, 40)}...`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      // Check if we hit Cloudflare challenge
      const pageUrl = page.url();
      if (pageUrl.includes("validation") || pageUrl.includes("challenge")) {
        console.log("  ⚠️ Cloudflare challenge — waiting...");
        await page.waitForTimeout(10000);

        // Check again
        if (page.url().includes("validation")) {
          console.log("  ❌ Still blocked — skipping");
          errors++;
          continue;
        }
      }

      // Extract variant data from the page
      const variantData = await page.evaluate(() => {
        const data = {
          name: "",
          images: [],
          variants: [],
          description: "",
          price: 0,
        };

        // Product name
        const h1 = document.querySelector("h1");
        data.name = h1?.textContent?.trim() || "";

        // All product images
        const imgs = document.querySelectorAll(
          "img[src*='cjdropshipping'], img[src*='oss-cf'], " +
          "[class*='gallery'] img, [class*='Gallery'] img, " +
          "[class*='thumb'] img, [class*='Thumb'] img"
        );
        const imageSet = new Set();
        imgs.forEach((img) => {
          const src = img.src || img.getAttribute("data-src") || "";
          if (src && src.includes("cjdropshipping")) imageSet.add(src);
        });
        data.images = [...imageSet];

        // Look for variant selectors
        // CJ uses different class patterns for variants
        const variantElements = document.querySelectorAll(
          "[class*='sku-item'], [class*='skuItem'], " +
          "[class*='variant-item'], [class*='variantItem'], " +
          "[class*='attr-value'], [class*='attrValue'], " +
          "[class*='spec-item'], [class*='specItem'], " +
          "[class*='option-item'], [class*='optionItem']"
        );

        variantElements.forEach((el) => {
          const img = el.querySelector("img");
          const text = el.textContent?.trim() || el.getAttribute("title") || "";
          const isActive = el.classList.contains("active") || el.classList.contains("selected") ||
                          el.getAttribute("aria-selected") === "true";

          data.variants.push({
            name: text,
            image: img?.src || img?.getAttribute("data-src") || "",
            active: isActive,
          });
        });

        // If no variants found from selectors, try extracting from page source
        if (data.variants.length === 0) {
          const html = document.documentElement.innerHTML;

          // Look for JSON variant data in script tags
          const scriptMatches = html.match(/"variants?"\s*:\s*(\[[\s\S]*?\])/);
          if (scriptMatches) {
            try {
              const parsed = JSON.parse(scriptMatches[1]);
              parsed.forEach((v) => {
                if (v.variantName || v.variantImage || v.name || v.image) {
                  data.variants.push({
                    name: v.variantName || v.name || "",
                    image: v.variantImage || v.image || "",
                    sku: v.variantSku || v.sku || "",
                    key: v.variantKey || "",
                    value: v.variantValue || "",
                  });
                }
              });
            } catch {}
          }
        }

        // Price
        const priceEl = document.querySelector("[class*='price'], [class*='Price']");
        if (priceEl) {
          const priceText = priceEl.textContent || "";
          data.price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;
        }

        // Description
        const descEl = document.querySelector("[class*='description'], [class*='Description']");
        data.description = descEl?.textContent?.trim()?.slice(0, 500) || "";

        return data;
      });

      existing[product.cjPid] = {
        slug: product.slug,
        name: variantData.name || product.name,
        cjPid: product.cjPid,
        images: variantData.images,
        variants: variantData.variants,
        description: variantData.description,
        price: variantData.price || parseFloat(product.cjPrice) || 0,
        scrapedAt: new Date().toISOString(),
      };

      if (variantData.variants.length > 0) {
        withVariants++;
        console.log(`  ✅ ${variantData.variants.length} variants, ${variantData.images.length} images`);
      } else {
        console.log(`  ℹ️ No variants found`);
      }

      // Save after each product (in case of crash)
      fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));

      // Rate limit: wait 2 seconds between requests
      await page.waitForTimeout(2000);

    } catch (err) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 50)}`);
      errors++;
    }

    processed++;
  }

  await browser.close();

  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`With variants: ${withVariants}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${outputPath}`);
}

scrapeVariants().catch(console.error);
