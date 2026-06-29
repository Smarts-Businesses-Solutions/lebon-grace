/**
 * CJ Variant Scraper — extracts variant data from CJ product pages.
 * Uses Playwright to bypass Cloudflare and extract real variant data.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "cj-products.json");
const OUTPUT_PATH = path.join(DATA_DIR, "cj-variants.json");

async function scrapeVariants() {
  // Load products
  if (!fs.existsSync(PRODUCTS_PATH)) {
    console.error("❌ Run 'node -e \"...\"' first to extract products to data/cj-products.json");
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf-8"));
  console.log(`Found ${products.length} products with CJ PIDs`);

  // Load existing results
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  } catch {}

  const alreadyScraped = Object.keys(existing).length;
  console.log(`Already scraped: ${alreadyScraped}`);

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  let processed = 0;
  let withVariants = 0;
  let errors = 0;

  for (const product of products) {
    if (existing[product.cjPid]) {
      processed++;
      continue;
    }

    // Build CJ product URL
    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const url = `https://cjdropshipping.com/product/${slug}-p-${product.cjPid}.html`;

    try {
      process.stdout.write(`[${processed + 1}/${products.length}] ${product.name.substring(0, 40)}... `);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);

      // Check for Cloudflare challenge
      if (page.url().includes("validation") || page.url().includes("challenge")) {
        console.log("⚠️ Cloudflare challenge");
        await page.waitForTimeout(8000);
        if (page.url().includes("validation")) {
          console.log("  ❌ Blocked");
          errors++;
          continue;
        }
      }

      // Extract data
      const data = await page.evaluate(() => {
        const result = { name: "", images: [], variants: [], price: 0 };

        // Name
        result.name = document.querySelector("h1")?.textContent?.trim() || "";

        // Images
        const imgs = document.querySelectorAll("img[src*='cjdropshipping'], img[src*='oss-cf']");
        const imgSet = new Set();
        imgs.forEach((img) => {
          const src = img.src;
          if (src && (src.includes("cjdropshipping") || src.includes("oss-cf"))) imgSet.add(src);
        });
        result.images = [...imgSet];

        // Variants from DOM
        const variantEls = document.querySelectorAll(
          "[class*='sku-item'], [class*='skuItem'], [class*='variant'], " +
          "[class*='attr-value'], [class*='spec-item'], [class*='option']"
        );
        variantEls.forEach((el) => {
          const img = el.querySelector("img");
          const text = el.textContent?.trim() || "";
          if (text || img?.src) {
            result.variants.push({ name: text, image: img?.src || "" });
          }
        });

        // Variants from page source
        if (result.variants.length === 0) {
          const html = document.documentElement.innerHTML;
          const m = html.match(/"variants?"\s*:\s*(\[[\s\S]*?\])/);
          if (m) {
            try {
              JSON.parse(m[1]).forEach((v) => {
                if (v.variantName || v.variantImage) {
                  result.variants.push({
                    name: v.variantName || "",
                    image: v.variantImage || "",
                    sku: v.variantSku || "",
                    key: v.variantKey || "",
                    value: v.variantValue || "",
                  });
                }
              });
            } catch {}
          }
        }

        // Price
        const priceEl = document.querySelector("[class*='price']");
        if (priceEl) result.price = parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, "") || "0") || 0;

        return result;
      });

      existing[product.cjPid] = {
        slug: product.slug,
        name: data.name || product.name,
        cjPid: product.cjPid,
        images: data.images,
        variants: data.variants,
        price: data.price || parseFloat(product.cjPrice) || 0,
        scrapedAt: new Date().toISOString(),
      };

      if (data.variants.length > 0) {
        withVariants++;
        console.log(`✅ ${data.variants.length} variants, ${data.images.length} images`);
      } else {
        console.log(`ℹ️ ${data.images.length} images, no variants`);
      }

      // Save after each product
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2));

      // Rate limit
      await page.waitForTimeout(1500);

    } catch (err) {
      console.log(`❌ ${err.message?.slice(0, 40)}`);
      errors++;
    }

    processed++;

    // Stop after 50 products to avoid rate limiting
    if (processed >= 50 && !process.argv.includes("--all")) {
      console.log("\n⚠️ Stopped after 50 products (use --all to scrape all)");
      break;
    }
  }

  await browser.close();

  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`With variants: ${withVariants}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

scrapeVariants().catch(console.error);
