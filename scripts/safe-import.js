/**
 * Safe import: validates data first, then imports if clean.
 *
 * USAGE:
 *   node scripts/safe-import.js [input-file]
 *
 * This ensures no garbage gets into shop.lebon-grace.com.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCRIPTS_DIR = __dirname;

console.log("=== Safe Import Pipeline ===\n");

// Step 1: Find the data file
let inputFile = process.argv[2];
if (!inputFile) {
  const candidates = [
    path.join(SCRIPTS_DIR, "..", "data", "tabbit-cj-variants.json"),
    path.join(SCRIPTS_DIR, "..", "data", "cj-variants-extracted.json"),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) { inputFile = f; break; }
  }
}

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error("❌ No variant data file found.");
  console.error("Run extraction first: node scripts/extract-cj-variants.js");
  process.exit(1);
}

console.log(`Data file: ${path.basename(inputFile)}`);

// Step 2: Count products
const data = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
const products = Array.isArray(data) ? data : Object.values(data);
console.log(`Products: ${products.length}`);
console.log(`With variants: ${products.filter(p => p.variants?.length > 0).length}`);

// Step 3: Validate
console.log("\n--- Validation ---");
try {
  execSync(`node "${path.join(SCRIPTS_DIR, "validate-cj-variants.js")}" "${inputFile}"`, {
    stdio: "inherit",
    cwd: SCRIPTS_DIR,
  });
  console.log("\n✅ Validation passed");
} catch {
  console.log("\n❌ Validation failed — fix issues before importing");
  process.exit(1);
}

// Step 4: Import
console.log("\n--- Importing ---");
try {
  execSync(`node "${path.join(SCRIPTS_DIR, "import-tabbit-variants.js")}"`, {
    stdio: "inherit",
    cwd: SCRIPTS_DIR,
  });
  console.log("\n✅ Import complete");
} catch {
  console.log("\n❌ Import failed");
  process.exit(1);
}

console.log("\n=== Done! Check shop.lebon-grace.com for variant thumbnails ===");
