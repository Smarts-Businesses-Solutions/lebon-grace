/**
 * Update all MDF product imageUrls to point to the new AI-generated PNG files.
 * Run after generate-mdf-images batch completes.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
const imgDir = path.join(__dirname, "..", "public", "images", "mdf");

// List all available images
const availableImages = new Set(
  fs.readdirSync(imgDir)
    .filter(f => f.endsWith(".png"))
    .map(f => f.replace(".png", ""))
);

console.log(`Found ${availableImages.size} AI-generated images`);

let content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");

let updated = 0;
let skipped = 0;

for (let i = 0; i < lines.length; i++) {
  // Match MDF product lines
  const slugMatch = lines[i].match(/slug: "(mdf-[^"]+)"/);
  if (!slugMatch) continue;
  
  const slug = slugMatch[1];
  if (!availableImages.has(slug)) {
    console.log(`  ⏭ ${slug} — no image found, keeping SVG`);
    skipped++;
    continue;
  }

  const imgUrl = `/images/mdf/${slug}.png`;
  
  // Replace imageUrl (whether SVG data URI or external URL)
  if (lines[i].includes('imageUrl: "')) {
    lines[i] = lines[i].replace(
      /imageUrl: "[^"]*"/,
      `imageUrl: "${imgUrl}"`
    );
    updated++;
    console.log(`  ✅ ${slug}`);
  } else {
    // If no imageUrl field, add one before the closing }
    // Find the position to insert
    const insertPos = lines[i].lastIndexOf("}");
    if (insertPos > 0) {
      lines[i] = lines[i].slice(0, insertPos) + `, imageUrl: "${imgUrl}"` + lines[i].slice(insertPos);
      updated++;
      console.log(`  ✅ ${slug} (added)`);
    }
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
console.log(`\nDone: ${updated} updated, ${skipped} skipped (no image)`);
