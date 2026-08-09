const fs = require("fs");

const mdfProducts = JSON.parse(fs.readFileSync("data/mdf-products.json", "utf-8"));
console.log(`Loaded ${mdfProducts.length} MDF products`);

const entries = mdfProducts.map(p => {
  const desc = (p.description || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
  const material = (p.details?.material || "3mm MDF").replace(/"/g, '\\"');
  const weight = p.details?.weight || "50g";
  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return `  { slug: "${p.slug}", name: "${p.name}", variant: "${p.variant || 'Premium'}", price: ${p.price}, category: "${p.category}", stock: ${p.stock}, description: "${desc}", details: { material: "${material}", weight: "${weight}" }, imagePlaceholder: { bg: "#C9A96E", initials: "${initials}" }, imageUrl: "${p.imageUrl}", cjPid: "${p.cjPid}", cjPrice: "0" },`;
}).join("\n");

let content = fs.readFileSync("src/lib/products.ts", "utf-8");

// Find the line with the products array closing
const lines = content.split("\n");
let insertLine = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === "];") {
    insertLine = i;
    break;
  }
}

if (insertLine > 0) {
  lines.splice(insertLine, 0, entries);
  fs.writeFileSync("src/lib/products.ts", lines.join("\n"));
  console.log(`Added ${mdfProducts.length} MDF products`);
  const count = lines.filter(l => l.includes('slug:')).length;
  console.log(`Total products: ${count}`);
} else {
  console.log("Could not find array end");
}
