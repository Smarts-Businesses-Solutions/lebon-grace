/**
 * Import Tabbit-extracted CJ variants into Lebon Grace.
 *
 * USAGE:
 *   node scripts/import-tabbit-variants.js
 *
 * Prerequisites:
 *   - data/tabbit-cj-variants.json must exist (from Tabbit extraction)
 */

const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "..", "data", "tabbit-cj-variants.json");
const API_URL = "https://shop.lebon-grace.com/api/import";

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error("No data/tabbit-cj-variants.json found.");
    console.error("Run the Tabbit extraction first (see scripts/tabbit-workflow.md)");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  const entries = Array.isArray(data) ? data : Object.values(data);

  console.log(`Found ${entries.length} extracted products`);

  // Convert to import format
  const products = entries
    .filter((e) => e.images && e.images.length > 0)
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      price: entry.price || 25,
      category: "General",
      cjPid: entry.cjPid,
      imageUrl: entry.images[0] || "",
      description: "",
      stock: 50,
      variants: (entry.variants || []).map((v, i) => ({
        sku: v.sku || `${entry.cjPid}-${i}`,
        name: v.name || `Variant ${i + 1}`,
        image: v.image || entry.images[0] || "",
        color: v.color || "",
        size: v.size || "",
      })),
    }));

  console.log(`Importing ${products.length} products...`);

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });

  const result = await resp.json();

  if (result.success) {
    console.log(`\n✅ Import complete!`);
    console.log(`   Products: ${result.imported}`);
    console.log(`   Variants: ${result.variantsAdded}`);
    if (result.errors?.length) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((e) => console.log(`     - ${e}`));
    }
  } else {
    console.error("Import failed:", result.error);
  }
}

main().catch(console.error);
