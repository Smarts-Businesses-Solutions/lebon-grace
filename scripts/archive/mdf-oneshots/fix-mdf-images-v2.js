/**
 * Fix MDF product images — simpler approach using line-by-line replacement.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(filePath, "utf-8");

const GENERIC_IMG = "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop";

const mdfImages = {
  "mdf-heart-cutout":          { img: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&h=400&fit=crop", bg: "#E8B4B8", ini: "MH" },
  "mdf-star-cutout":           { img: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop", bg: "#F4D03F", ini: "MS" },
  "mdf-butterfly-cutout":      { img: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400&h=400&fit=crop", bg: "#AED6F1", ini: "MB" },
  "mdf-elephant-cutout":       { img: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400&h=400&fit=crop", bg: "#BDC3C7", ini: "ME" },
  "mdf-circle-cutout":         { img: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#F5CBA7", ini: "MC" },
  "mdf-cat-cutout":            { img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop", bg: "#FAD7A0", ini: "MC" },
  "mdf-diamond-cutout":        { img: "https://images.unsplash.com/photo-1502691876148-a84978e59af8?w=400&h=400&fit=crop", bg: "#D5DBDB", ini: "MD" },
  "mdf-bunny-cutout":          { img: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=400&fit=crop", bg: "#FDEBD0", ini: "MB" },
  "mdf-hexagon-cutout":        { img: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#D5F5E3", ini: "MH" },
  "mdf-dog-cutout":            { img: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop", bg: "#F0E6D3", ini: "MD" },
  "mdf-oval-cutout":           { img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", bg: "#E8DAEF", ini: "MO" },
  "mdf-fish-cutout":           { img: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400&h=400&fit=crop", bg: "#AED6F1", ini: "MF" },
  "mdf-triangle-cutout":       { img: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#ABEBC6", ini: "MT" },
  "mdf-owl-cutout":            { img: "https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=400&fit=crop", bg: "#F5CBA7", ini: "MO" },
  "mdf-cross-cutout":          { img: "https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=400&h=400&fit=crop", bg: "#FADBD8", ini: "MC" },
  "mdf-bird-cutout":           { img: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&h=400&fit=crop", bg: "#D4E6F1", ini: "MB" },
  "mdf-crescent-moon-cutout":  { img: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=400&h=400&fit=crop", bg: "#F9E79F", ini: "MC" },
  "mdf-turtle-cutout":         { img: "https://images.unsplash.com/photo-1518467166778-b88f373ffec7?w=400&h=400&fit=crop", bg: "#82E0AA", ini: "MT" },
  "mdf-square-cutout":         { img: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#F5CBA7", ini: "MS" },
  "mdf-lion-cutout":           { img: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&h=400&fit=crop", bg: "#F0B27A", ini: "ML" },
  "mdf-heart-puzzle-5-piece":      { img: "https://images.unsplash.com/photo-1493723843671-1d655e66ac1c?w=400&h=400&fit=crop", bg: "#F1948A", ini: "MH" },
  "mdf-animal-face-paint-kit":     { img: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop", bg: "#F9E79F", ini: "PA" },
  "mdf-star-matching-puzzle":      { img: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=400&fit=crop", bg: "#F7DC6F", ini: "MS" },
  "mdf-flower-garden-puzzle":      { img: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&h=400&fit=crop", bg: "#82E0AA", ini: "MF" },
  "mdf-dinosaur-paint-set":        { img: "https://images.unsplash.com/photo-1519019121990-636d8b8b9033?w=400&h=400&fit=crop", bg: "#ABEBC6", ini: "PD" },
  "mdf-alphabet-puzzle-board":     { img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop", bg: "#AED6F1", ini: "MA" },
  "mdf-unicorn-paint-your-own":    { img: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop", bg: "#D2B4DE", ini: "PU" },
  "mdf-geometric-pattern-puzzle":  { img: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=400&fit=crop", bg: "#A3E4D7", ini: "MG" },
  "mdf-ocean-animals-paint-kit":   { img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=400&fit=crop", bg: "#85C1E9", ini: "PO" },
  "mdf-space-explorer-puzzle":     { img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=400&fit=crop", bg: "#1C2833", ini: "MS" },
  "mdf-rainbow-color-sorting":     { img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", bg: "#F1948A", ini: "MR" },
  "mdf-butterfly-garden-puzzle":   { img: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400&h=400&fit=crop", bg: "#AED6F1", ini: "MB" },
  "mdf-vehicle-paint-set":         { img: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=400&fit=crop", bg: "#AEB6BF", ini: "PV" },
  "mdf-3d-butterfly-building-kit": { img: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&h=400&fit=crop", bg: "#D7BDE2", ini: "3B" },
  "mdf-3d-dinosaur-building-kit":  { img: "https://images.unsplash.com/photo-1519669556878-63bdad8a1a49?w=400&h=400&fit=crop", bg: "#ABEBC6", ini: "3D" },
  "mdf-forest-animal-wall-art":      { img: "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400&h=400&fit=crop", bg: "#D5F5E3", ini: "MF" },
  "mdf-mandala-coaster-set":         { img: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop", bg: "#FADBD8", ini: "MM" },
  "mdf-botanical-wall-art":          { img: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop", bg: "#82E0AA", ini: "MB" },
  "mdf-geometric-ornament-set":      { img: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop", bg: "#F9E79F", ini: "MG" },
  "mdf-arabic-calligraphy-art":      { img: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=400&h=400&fit=crop", bg: "#D4AC0D", ini: "MA" },
  "mdf-honeycomb-shelf-set":         { img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop", bg: "#F5CBA7", ini: "MH" },
  "mdf-leaf-coaster-set":            { img: "https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=400&h=400&fit=crop", bg: "#82E0AA", ini: "ML" },
  "mdf-moon-phase-wall-hanging":     { img: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=400&h=400&fit=crop", bg: "#2C3E50", ini: "MM" },
  "mdf-personalized-name-ornament":  { img: "https://images.unsplash.com/photo-1513201099705-a9746e0e2010?w=400&h=400&fit=crop", bg: "#FADBD8", ini: "MP" },
  "mdf-spice-jar-labels":            { img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop", bg: "#F5CBA7", ini: "MS" },
  "mdf-counting-abc-board":       { img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop", bg: "#AED6F1", ini: "MC" },
  "mdf-3d-city-building-set":     { img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=400&fit=crop", bg: "#AEB6BF", ini: "3C" },
  "mdf-shape-sorter-puzzle":      { img: "https://images.unsplash.com/photo-1576495199011-eb94736d05d6?w=400&h=400&fit=crop", bg: "#F9E79F", ini: "MS" },
  "mdf-marble-run-contraption":   { img: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop", bg: "#D7BDE2", ini: "MM" },
  "mdf-tangram-puzzle-set":       { img: "https://images.unsplash.com/photo-1606092195730-5d7bada7f48f?w=400&h=400&fit=crop", bg: "#F1948A", ini: "MT" },
};

// Split into lines for line-by-line processing
const lines = content.split("\n");
let updated = 0;

for (let i = 0; i < lines.length; i++) {
  // Find which slug this line belongs to
  for (const [slug, data] of Object.entries(mdfImages)) {
    if (lines[i].includes(`slug: "${slug}"`)) {
      // Replace the generic imageUrl
      lines[i] = lines[i].replace(GENERIC_IMG, data.img);
      // Replace bg color
      lines[i] = lines[i].replace(/bg: "#C9A96E"/, `bg: "${data.bg}"`);
      updated++;
      break;
    }
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
console.log(`✅ Updated ${updated} product lines`);

// Verify a few
const verify = fs.readFileSync(filePath, "utf-8");
for (const slug of ["mdf-heart-cutout", "mdf-cat-cutout", "mdf-unicorn-paint-your-own", "mdf-tangram-puzzle-set"]) {
  const match = verify.match(new RegExp(`slug: "${slug}"[^}]*imageUrl: "([^"]*)"`));
  console.log(`  ${slug}: ${match ? match[1].substring(0, 60) : "NOT FOUND"}`);
}
