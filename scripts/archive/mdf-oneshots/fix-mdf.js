const fs = require("fs");
const path = require("path");

const productsPath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(productsPath, "utf-8");

// Find helper functions
const helperIdx = content.indexOf("export function getProductBySlug");
if (helperIdx === -1) { console.log("helper not found"); process.exit(1); }

// Find MDF products (currently after categories array)
const mdfStart = content.indexOf('slug: "mdf-');
if (mdfStart === -1) { console.log("MDF products not found"); process.exit(1); }

// Find end of MDF block
const afterMdf = content.indexOf("\nexport function getProductBySlug", mdfStart);
const mdfBlock = content.substring(mdfStart - 4, afterMdf);

// Remove MDF from current position
let newContent = content.substring(0, mdfStart - 4) + content.substring(afterMdf);

// Insert MDF before helper functions
const insertIdx = newContent.indexOf("export function getProductBySlug");
newContent = newContent.substring(0, insertIdx) + "\n" + mdfBlock + "\n" + newContent.substring(insertIdx);

fs.writeFileSync(productsPath, newContent);

// Verify
console.log("MDF block length:", mdfBlock.length);
console.log("Inserted at position:", insertIdx);
console.log("Total file length:", newContent.length);
console.log("MDF mentions:", (newContent.match(/MDF-/g) || []).length);
