/**
 * Fix: MDF products were inserted inside the categories array
 * instead of at the end of the products array.
 *
 * This script:
 * 1. Extracts MDF products from the categories array (lines 2745-2794)
 * 2. Inserts them at the end of the products array (before line 2715's "]")
 * 3. Adds "MDF Cutouts", "DIY Kits", "Kids Toys" to the categories array
 * 4. Updates category counts
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
const lines = fs.readFileSync(filePath, "utf-8").split("\n");

// Find key line indices (0-based)
let productsArrayEnd = -1;     // the "]" that closes the products array
let categoriesStart = -1;      // "export const categories = ["
let kidsBabyCategoryLine = -1; // line with "Kids & Baby" category

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("slug: \"cool-style-geometric-lock")) {
    // The last original product entry, the "]" is on line 2715 (1-based) = index 2714
    // Let's find the actual closing bracket
  }
  if (lines[i].trim() === "]" && i > 2700 && i < 2720) {
    productsArrayEnd = i;
  }
  if (lines[i].includes("export const categories")) {
    categoriesStart = i;
  }
  if (lines[i].includes('"Kids & Baby"')) {
    kidsBabyCategoryLine = i;
  }
}

console.log("productsArrayEnd (line):", productsArrayEnd + 1);
console.log("categoriesStart (line):", categoriesStart + 1);
console.log("kidsBabyCategoryLine (line):", kidsBabyCategoryLine + 1);

// Collect the MDF products that are currently inside the categories array
// They're between "Kids & Baby" line and the closing "]" of what looks like the file
const mdfProducts = [];
const mdfStartLine = kidsBabyCategoryLine + 1; // first MDF product line

// Find the closing "]" of the categories section (line 2795 in 1-based = index 2794)
let categoriesClosingBracket = -1;
for (let i = mdfStartLine; i < lines.length; i++) {
  if (lines[i].trim() === "]" && i > mdfStartLine) {
    categoriesClosingBracket = i;
    break;
  }
}

console.log("mdfStartLine:", mdfStartLine + 1);
console.log("categoriesClosingBracket:", categoriesClosingBracket + 1);

// Extract MDF product lines (from mdfStartLine to categoriesClosingBracket-1)
for (let i = mdfStartLine; i < categoriesClosingBracket; i++) {
  mdfProducts.push(lines[i]);
}
console.log("Extracted MDF product lines:", mdfProducts.length);

// Now rebuild the file:
// 1. Lines 0 to productsArrayEnd-1 (products array without closing "]")
// 2. MDF products (indented properly)
// 3. "]" closing the products array
// 4. Empty lines + helper functions + categories array

// Find where the helper functions and categories start
const afterProductsArray = lines.slice(productsArrayEnd + 1);

// Rebuild:
const newLines = [];

// Part 1: Everything up to and including the products array closing
// but we need to remove the "]" at productsArrayEnd
// Actually, we want: everything before productsArrayEnd, then MDF products, then "]"
for (let i = 0; i < productsArrayEnd; i++) {
  newLines.push(lines[i]);
}

// Part 2: Add MDF products (already have correct indentation with 2 spaces)
for (const line of mdfProducts) {
  newLines.push(line);
}

// Part 3: Close the products array
newLines.push("]");

// Part 4: Now add the categories section with new categories
// First, count products per category
const allProducts = [...lines.slice(10, productsArrayEnd), ...mdfProducts];
const catCounts = {};
for (const line of allProducts) {
  const catMatch = line.match(/category:\s*"([^"]+)"/);
  if (catMatch) {
    const cat = catMatch[1];
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
}

console.log("\nProduct counts by category:");
const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sortedCats) {
  console.log(`  ${cat}: ${count}`);
}

// Build new categories array with proper counts
const categoryIcons = {
  "MDF Cutouts": "🪵",
  "DIY Kits": "🎨",
  "Kids Toys": "🧸",
};

newLines.push("");
newLines.push("");

// Add new categories first (high priority for MDF), then existing ones
const newCatOrder = [
  "MDF Cutouts",
  "DIY Kits",
  "Kids Toys",
  ...sortedCats.filter(([c]) => !["MDF Cutouts", "DIY Kits", "Kids Toys"].includes(c)).map(([c]) => c),
];

newLines.push("export const categories = [");
for (const cat of newCatOrder) {
  const count = catCounts[cat] || 0;
  const icon = categoryIcons[cat] || "📦";
  newLines.push(`  { name: "${cat}", description: "${count} products", icon: "${icon}" },`);
}
newLines.push("]");

// Write the file
fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");
console.log("\n✅ File fixed! Wrote", newLines.length, "lines");

// Verify
const verify = fs.readFileSync(filePath, "utf-8");
const verifyLines = verify.split("\n");
let inProducts = false;
let inCategories = false;
let productCount = 0;
let catCount = 0;
for (const line of verifyLines) {
  if (line.includes("export const products")) inProducts = true;
  if (line.includes("export const categories")) {
    inProducts = false;
    inCategories = true;
  }
  if (inProducts && line.includes("slug:")) productCount++;
  if (inCategories && line.includes("name:")) catCount++;
}
console.log(`\nVerification: ${productCount} products, ${catCount} categories`);
