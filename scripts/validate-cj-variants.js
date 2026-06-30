/**
 * Validate CJ variant data before import.
 * Checks for garbage, duplicates, missing fields, and quality issues.
 *
 * USAGE:
 *   node scripts/validate-cj-variants.js [input-file]
 *
 * Default input: data/tabbit-cj-variants.json
 * Also checks: data/cj-variants-extracted.json
 */

const fs = require("fs");
const path = require("path");

const VALID_INPUTS = [
  path.join(__dirname, "..", "data", "tabbit-cj-variants.json"),
  path.join(__dirname, "..", "data", "cj-variants-extracted.json"),
];

// Quality rules
const RULES = {
  // Minimum fields required
  REQUIRED_FIELDS: ["cjPid", "name", "images"],
  // Minimum images per product
  MIN_IMAGES: 1,
  // Maximum images per product (sanity check)
  MAX_IMAGES: 20,
  // Product name must be at least 5 chars
  MIN_NAME_LENGTH: 5,
  // Variant name must be at least 1 char
  MIN_VARIANT_NAME_LENGTH: 1,
  // Price must be positive
  MIN_PRICE: 0.01,
  // Maximum price (sanity check - CJ products are cheap)
  MAX_PRICE: 100,
  // Image URL must contain CJ domains
  VALID_IMAGE_DOMAINS: ["cjdropshipping", "oss-cf", "cf.cjdropshipping"],
};

function validateProduct(product, index) {
  const errors = [];
  const warnings = [];

  // Required fields
  for (const field of RULES.REQUIRED_FIELDS) {
    if (!product[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Name validation
  if (product.name && product.name.length < RULES.MIN_NAME_LENGTH) {
    warnings.push(`Name too short: "${product.name}"`);
  }
  if (product.name && product.name === product.name.toUpperCase()) {
    warnings.push(`Name is ALL CAPS: "${product.name}"`);
  }

  // Image validation
  if (product.images) {
    if (product.images.length < RULES.MIN_IMAGES) {
      warnings.push(`Only ${product.images.length} image(s)`);
    }
    if (product.images.length > RULES.MAX_IMAGES) {
      warnings.push(`${product.images.length} images (suspiciously many)`);
    }
    // Check image URLs
    product.images.forEach((img, i) => {
      if (!img || typeof img !== "string") {
        errors.push(`Invalid image at index ${i}`);
      } else if (!RULES.VALID_IMAGE_DOMAINS.some((d) => img.includes(d))) {
        warnings.push(`Image ${i} not from CJ domain: ${img.substring(0, 50)}`);
      }
    });
  }

  // Variant validation
  if (product.variants) {
    product.variants.forEach((v, i) => {
      if (!v.name || v.name.length < RULES.MIN_VARIANT_NAME_LENGTH) {
        warnings.push(`Variant ${i}: empty name`);
      }
      if (v.name && v.name.length > 50) {
        warnings.push(`Variant ${i}: name too long: "${v.name.substring(0, 30)}..."`);
      }
      // Check for garbage patterns
      if (v.name && /[\x00-\x1f]/.test(v.name)) {
        errors.push(`Variant ${i}: contains control characters`);
      }
      if (v.name && /^[0-9]+$/.test(v.name)) {
        warnings.push(`Variant ${i}: name is just a number: "${v.name}"`);
      }
    });

    // Check for duplicate variants
    const seenNames = new Set();
    product.variants.forEach((v, i) => {
      if (seenNames.has(v.name)) {
        warnings.push(`Duplicate variant name: "${v.name}"`);
      }
      seenNames.add(v.name);
    });
  }

  // Price validation
  if (product.price !== undefined && product.price !== null) {
    if (product.price < RULES.MIN_PRICE) {
      warnings.push(`Price too low: ${product.price}`);
    }
    if (product.price > RULES.MAX_PRICE) {
      warnings.push(`Price suspiciously high: ${product.price}`);
    }
  }

  return { errors, warnings };
}

function validateAll(products) {
  let totalErrors = 0;
  let totalWarnings = 0;
  let validProducts = 0;
  let productsWithVariants = 0;
  const issues = [];

  products.forEach((product, index) => {
    const { errors, warnings } = validateProduct(product, index);

    if (errors.length > 0) {
      totalErrors += errors.length;
      issues.push({ index, name: product.name || "Unknown", type: "error", messages: errors });
    }

    if (warnings.length > 0) {
      totalWarnings += warnings.length;
      issues.push({ index, name: product.name || "Unknown", type: "warning", messages: warnings });
    }

    if (errors.length === 0) {
      validProducts++;
    }

    if (product.variants && product.variants.length > 0) {
      productsWithVariants++;
    }
  });

  return { totalErrors, totalWarnings, validProducts, productsWithVariants, issues };
}

function main() {
  // Find input file
  let inputFile = process.argv[2];
  if (!inputFile) {
    for (const f of VALID_INPUTS) {
      if (fs.existsSync(f)) {
        inputFile = f;
        break;
      }
    }
  }

  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error("No variant data file found.");
    console.error("Expected: data/tabbit-cj-variants.json or data/cj-variants-extracted.json");
    process.exit(1);
  }

  console.log(`Validating: ${path.basename(inputFile)}`);
  console.log("=".repeat(50));

  const data = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  const products = Array.isArray(data) ? data : Object.values(data);

  console.log(`Total products: ${products.length}`);

  const { totalErrors, totalWarnings, validProducts, productsWithVariants, issues } = validateAll(products);

  console.log(`\nResults:`);
  console.log(`  Valid products: ${validProducts}/${products.length}`);
  console.log(`  Products with variants: ${productsWithVariants}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Warnings: ${totalWarnings}`);

  if (issues.length > 0) {
    console.log(`\nIssues (showing first 20):`);
    issues.slice(0, 20).forEach((issue) => {
      const icon = issue.type === "error" ? "❌" : "⚠️";
      console.log(`  ${icon} [${issue.index}] ${issue.name.substring(0, 30)}`);
      issue.messages.forEach((m) => console.log(`     ${m}`));
    });
  }

  // Determine if safe to import
  const errorRate = totalErrors / products.length;
  const safe = errorRate < 0.1; // Less than 10% errors

  console.log(`\n${"=".repeat(50)}`);
  console.log(safe ? "✅ SAFE TO IMPORT" : "❌ TOO MANY ERRORS — review before importing");
  console.log(`Error rate: ${(errorRate * 100).toFixed(1)}% (threshold: 10%)`);

  return safe;
}

const safe = main();
process.exit(safe ? 0 : 1);
