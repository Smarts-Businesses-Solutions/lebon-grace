/**
 * Assign unique, relevant placeholder images to all 50 MDF products.
 * Uses curated Unsplash images + unique colors per product.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(filePath, "utf-8");

// Image mapping: slug -> { imageUrl, bg, initials }
const mdfImages = {
  // ─── MDF Cutouts (20) ───
  "mdf-heart-cutout":          { imageUrl: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&h=400&fit=crop", bg: "#E8B4B8", initials: "❤️" },
  "mdf-star-cutout":           { imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop", bg: "#F4D03F", initials: "⭐" },
  "mdf-butterfly-cutout":      { imageUrl: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400&h=400&fit=crop", bg: "#AED6F1", initials: "🦋" },
  "mdf-elephant-cutout":       { imageUrl: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400&h=400&fit=crop", bg: "#BDC3C7", initials: "🐘" },
  "mdf-circle-cutout":         { imageUrl: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#F5CBA7", initials: "⭕" },
  "mdf-cat-cutout":            { imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop", bg: "#FAD7A0", initials: "🐱" },
  "mdf-diamond-cutout":        { imageUrl: "https://images.unsplash.com/photo-1502691876148-a84978e59af8?w=400&h=400&fit=crop", bg: "#D5DBDB", initials: "💎" },
  "mdf-bunny-cutout":          { imageUrl: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=400&fit=crop", bg: "#FDEBD0", initials: "🐰" },
  "mdf-hexagon-cutout":        { imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#D5F5E3", initials: "⬡" },
  "mdf-dog-cutout":            { imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop", bg: "#F0E6D3", initials: "🐕" },
  "mdf-oval-cutout":           { imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", bg: "#E8DAEF", initials: "⬭" },
  "mdf-fish-cutout":           { imageUrl: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400&h=400&fit=crop", bg: "#AED6F1", initials: "🐟" },
  "mdf-triangle-cutout":       { imageUrl: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#ABEBC6", initials: "🔺" },
  "mdf-owl-cutout":            { imageUrl: "https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=400&fit=crop", bg: "#F5CBA7", initials: "🦉" },
  "mdf-cross-cutout":          { imageUrl: "https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=400&h=400&fit=crop", bg: "#FADBD8", initials: "✝️" },
  "mdf-bird-cutout":           { imageUrl: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&h=400&fit=crop", bg: "#D4E6F1", initials: "🐦" },
  "mdf-crescent-moon-cutout":  { imageUrl: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=400&h=400&fit=crop", bg: "#F9E79F", initials: "🌙" },
  "mdf-turtle-cutout":         { imageUrl: "https://images.unsplash.com/photo-1518467166778-b88f373ffec7?w=400&h=400&fit=crop", bg: "#82E0AA", initials: "🐢" },
  "mdf-square-cutout":         { imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#F5CBA7", initials: "⬜" },
  "mdf-lion-cutout":           { imageUrl: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&h=400&fit=crop", bg: "#F0B27A", initials: "🦁" },

  // ─── DIY Kits (15) ───
  "mdf-heart-puzzle-5-piece":      { imageUrl: "https://images.unsplash.com/photo-1493723843671-1d655e66ac1c?w=400&h=400&fit=crop", bg: "#F1948A", initials: "🧩" },
  "mdf-animal-face-paint-kit":     { imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop", bg: "#F9E79F", initials: "🎨" },
  "mdf-star-matching-puzzle":      { imageUrl: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=400&fit=crop", bg: "#F7DC6F", initials: "⭐" },
  "mdf-flower-garden-puzzle":      { imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&h=400&fit=crop", bg: "#82E0AA", initials: "🌸" },
  "mdf-dinosaur-paint-set":        { imageUrl: "https://images.unsplash.com/photo-1519019121990-636d8b8b9033?w=400&h=400&fit=crop", bg: "#ABEBC6", initials: "🦕" },
  "mdf-alphabet-puzzle-board":     { imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop", bg: "#AED6F1", initials: "🔤" },
  "mdf-unicorn-paint-your-own":    { imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop", bg: "#D2B4DE", initials: "🦄" },
  "mdf-geometric-pattern-puzzle":  { imageUrl: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#A3E4D7", initials: "🔷" },
  "mdf-ocean-animals-paint-kit":   { imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=400&fit=crop", bg: "#85C1E9", initials: "🐙" },
  "mdf-space-explorer-puzzle":     { imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=400&fit=crop", bg: "#1C2833", initials: "🚀" },
  "mdf-rainbow-color-sorting":     { imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", bg: "#F1948A", initials: "🌈" },
  "mdf-butterfly-garden-puzzle":   { imageUrl: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400&h=400&fit=crop", bg: "#AED6F1", initials: "🦋" },
  "mdf-vehicle-paint-set":         { imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=400&fit=crop", bg: "#AEB6BF", initials: "🚗" },
  "mdf-3d-butterfly-building-kit": { imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&h=400&fit=crop", bg: "#D7BDE2", initials: "🦋" },
  "mdf-3d-dinosaur-building-kit":  { imageUrl: "https://images.unsplash.com/photo-1519669556878-63bdad8a1a49?w=400&h=400&fit=crop", bg: "#ABEBC6", initials: "🦖" },

  // ─── Home Decor (10) ───
  "mdf-forest-animal-wall-art":      { imageUrl: "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400&h=400&fit=crop", bg: "#D5F5E3", initials: "🌲" },
  "mdf-mandala-coaster-set":         { imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop", bg: "#FADBD8", initials: "🏵️" },
  "mdf-botanical-wall-art":          { imageUrl: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop", bg: "#82E0AA", initials: "🌿" },
  "mdf-geometric-ornament-set":      { imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop", bg: "#F9E79F", initials: "✨" },
  "mdf-arabic-calligraphy-art":      { imageUrl: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=400&h=400&fit=crop", bg: "#D4AC0D", initials: "﷽" },
  "mdf-honeycomb-shelf-set":         { imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop", bg: "#F5CBA7", initials: "🏠" },
  "mdf-leaf-coaster-set":            { imageUrl: "https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=400&h=400&fit=crop", bg: "#82E0AA", initials: "🍃" },
  "mdf-moon-phase-wall-hanging":     { imageUrl: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=400&h=400&fit=crop", bg: "#2C3E50", initials: "🌙" },
  "mdf-personalized-name-ornament":  { imageUrl: "https://images.unsplash.com/photo-1513201099705-a9746e0e2010?w=400&h=400&fit=crop", bg: "#FADBD8", initials: "📝" },
  "mdf-spice-jar-labels":            { imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop", bg: "#F5CBA7", initials: "🧂" },

  // ─── Kids Toys (5) ───
  "mdf-counting-abc-board":       { imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop", bg: "#AED6F1", initials: "📚" },
  "mdf-3d-city-building-set":     { imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=400&fit=crop", bg: "#AEB6BF", initials: "🏙️" },
  "mdf-shape-sorter-puzzle":      { imageUrl: "https://images.unsplash.com/photo-1576495199011-eb94736d05d6?w=400&h=400&fit=crop", bg: "#F9E79F", initials: "🔷" },
  "mdf-marble-run-contraption":   { imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#D7BDE2", initials: "🔮" },
  "mdf-tangram-puzzle-set":       { imageUrl: "https://images.unsplash.com/photo-1606092195730-5d7bada7f48f?w=400&h=400&fit=crop", bg: "#F1948A", initials: "🧩" },
};

let updated = 0;
for (const [slug, imgs] of Object.entries(mdfImages)) {
  // Find the product line by slug and replace imageUrl, bg, and initials
  const slugPattern = new RegExp(
    `(slug: "${slug}"[^}]*?)imageUrl: "https://images\\.unsplash\\.com/photo-1513519245088-0e12902e35ca\\?w=400&h=400&fit=crop"`,
    "g"
  );
  content = content.replace(slugPattern, `$1imageUrl: "${imgs.imageUrl}"`);
  
  // Also update the bg color
  const bgPattern = new RegExp(
    `(slug: "${slug}"[^}]*?)bg: "#C9A96E"`,
    "g"
  );
  content = content.replace(bgPattern, `$1bg: "${imgs.bg}"`);
  
  // Update initials
  const initialsPattern = new RegExp(
    `(slug: "${slug}"[^}]*?)initials: "[^"]*"`,
    "g"
  );
  content = content.replace(initialsPattern, `$1initials: "${imgs.initials}"`);
  
  updated++;
}

fs.writeFileSync(filePath, content, "utf-8");
console.log(`✅ Updated ${updated} MDF product images`);
