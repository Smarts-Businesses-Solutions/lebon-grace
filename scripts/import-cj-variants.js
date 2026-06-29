/**
 * Import CJ variants from scraped data into the Lebon Grace API.
 *
 * USAGE:
 *   1. Run scrape-cj-variants.js first to get data/cj-variants.json
 *   2. Then run: node scripts/import-cj-variants.js
 *
 * This uploads the variant data to the Lebon Grace API which stores it
 * in Supabase product_variants table.
 */

const fs = require("fs");
const path = require("path");

const API_URL = "https://shop.lebon-grace.com/api/import";
const DATA_PATH = path.join(__dirname, "..", "data", "cj-variants.json");

async function importVariants() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error("❌ No data/cj-variants.json found. Run scrape-cj-variants.js first.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const entries = Object.values(data);

  console.log(`Found ${entries.length} products with variant data`);

  // Convert to our import format
  const products = entries
    .filter((e) => e.variants && e.variants.length > 0)
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      price: entry.price || 25,
      category: "General",
      cjPid: entry.cjPid,
      imageUrl: entry.images?.[0] || "",
      description: entry.description || "",
      stock: 50,
      variants: entry.variants.map((v, i) => ({
        sku: v.sku || `${entry.cjPid}-${i}`,
        name: v.name || `Variant ${i + 1}`,
        image: v.image || entry.images?.[0] || "",
        color: v.value || v.name || "",
        size: "",
      })),
    }));

  console.log(`Importing ${products.length} products with variants...`);

  // Send to API
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });

  const result = await resp.json();
  console.log(`\n✅ Import complete!`);
  console.log(`   Products imported: ${result.imported}`);
  console.log(`   Variants added: ${result.variantsAdded}`);
  if (result.errors?.length) {
    console.log(`   Errors: ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log(`     - ${e}`));
  }
}

importVariants().catch(console.error);
