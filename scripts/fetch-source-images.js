/**
 * Fetch original design preview images from 3axis.co, free-dxf.com, dxfdownloads.com
 * and assign them to the corresponding MDF products.
 *
 * 3axis.co pattern: https://cdn.3axis.co/user-images/{code}.jpg
 * free-dxf.com: fetch page, extract og:image
 * dxfdownloads: fetch page, extract og:image
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");

// Mapping: MDF product slug -> source URL and type
// For 3axis.co: just use CDN URL directly
// For free-dxf.com / dxfdownloads: we'll fetch og:image
const productSources = {
  // ─── Cutouts (20) ───
  "mdf-heart-cutout":           { url: "https://free-dxf.com/design-heart-art/free-download-dxf-cdr-ai-svg/CFwkX", type: "free-dxf" },
  "mdf-star-cutout":            { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-butterfly-cutout":       { url: "https://free-dxf.com/design-decorative-butterfly/free-download-dxf-cdr-ai-svg/sLhee", type: "free-dxf" },
  "mdf-elephant-cutout":        { url: "https://free-dxf.com/design-walking-elephant-silhouette/free-download-dxf-cdr-ai-svg/6ve0z", type: "free-dxf" },
  "mdf-circle-cutout":          { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-cat-cutout":             { url: "https://free-dxf.com/design-fluffy-black-cat-silhouette/free-download-dxf-cdr-ai-svg/OL8lw", type: "free-dxf" },
  "mdf-diamond-cutout":         { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-bunny-cutout":           { url: "https://3axis.co/laser-cut-rabbit-3d-puzzle-dxf-file/qommxq4o/", type: "3axis" },
  "mdf-hexagon-cutout":         { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-dog-cutout":             { url: "https://3axis.co/laser-cut-wood-beagle-craft-shape-cutout-cdr-file/zo9yryy7/", type: "3axis" },
  "mdf-oval-cutout":            { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-fish-cutout":            { url: "https://3axis.co/laser-cut-bass-fish-wood-cutout-shape-blank-cdr-file/joednz81/", type: "3axis" },
  "mdf-triangle-cutout":        { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-owl-cutout":             { url: "https://free-dxf.com/design-owl-clipart/free-download-dxf-cdr-ai-svg/BR7bP", type: "free-dxf" },
  "mdf-cross-cutout":           { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-bird-cutout":            { url: "https://3axis.co/laser-cut-bass-fish-wood-cutout-shape-blank-cdr-file/joednz81/", type: "3axis" },
  "mdf-crescent-moon-cutout":   { url: "https://free-dxf.com/design-moon-star-free-vector/free-download-dxf-cdr-ai-svg/3aHfA", type: "free-dxf" },
  "mdf-turtle-cutout":          { url: "https://free-dxf.com/design-sea-turtle-clipart/free-download-dxf-cdr-ai-svg/Gz5sR", type: "free-dxf" },
  "mdf-square-cutout":          { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-lion-cutout":            { url: "https://free-dxf.com/design-lion-silhouette-clipart/free-download-dxf-cdr-ai-svg/ksCsu", type: "free-dxf" },

  // ─── DIY Kits (15) ───
  "mdf-heart-puzzle-5-piece":      { url: "https://3axis.co/laser-cut-wooden-heart-tangram-puzzle-geometric-puzzle-shapes-board-game/kp7y3l45oq/", type: "3axis" },
  "mdf-animal-face-paint-kit":     { url: "https://free-dxf.com/design-bear-face-clipart/free-download-dxf-cdr-ai-svg/vemry", type: "free-dxf" },
  "mdf-star-matching-puzzle":      { url: "https://3axis.co/laser-cut-wooden-heart-tangram-puzzle-geometric-puzzle-shapes-board-game/kp7y3l45oq/", type: "3axis" },
  "mdf-flower-garden-puzzle":      { url: "https://free-dxf.com/design-flowers-clipart/free-download-dxf-cdr-ai-svg/MdKVE", type: "free-dxf" },
  "mdf-dinosaur-paint-set":        { url: "https://3axis.co/laser-cut-brontosaurus-shape-wood-craft-cutout-cdr-file/r1z2xnp1/", type: "3axis" },
  "mdf-alphabet-puzzle-board":     { url: "https://3axis.co/laser-cut-wooden-alphabet-for-kids-abc-puzzle-board/5e1gw80vol/", type: "3axis" },
  "mdf-unicorn-paint-your-own":    { url: "https://www.dxfdownloads.com/free-multi-layer-shelf-butterfly-and-unicorn/", type: "dxfdownloads" },
  "mdf-geometric-pattern-puzzle":  { url: "https://www.dxfdownloads.com/free-pack-svg-geometric-figures/", type: "dxfdownloads" },
  "mdf-ocean-animals-paint-kit":   { url: "https://3axis.co/laser-cut-bass-fish-wood-cutout-shape-blank-cdr-file/joednz81/", type: "3axis" },
  "mdf-space-explorer-puzzle":     { url: "https://3axis.co/laser-cut-wooden-rocket-shaped-3d-puzzle-educational-toddler-matching-blocks/eoxpx9g7/", type: "3axis" },
  "mdf-rainbow-color-sorting":     { url: "https://3axis.co/laser-cut-montessori-circle-puzzle-toy-cdr-file/e1gkedxo/", type: "3axis" },
  "mdf-butterfly-garden-puzzle":   { url: "https://free-dxf.com/design-butterfly-floral-circle-wall-decor/free-download-dxf-cdr-ai-svg/C5LaW", type: "free-dxf" },
  "mdf-vehicle-paint-set":         { url: "https://www.dxfdownloads.com/tractor-toys-for-children-free-dxf-laser/", type: "dxfdownloads" },
  "mdf-3d-butterfly-building-kit": { url: "https://3axis.co/laser-cut-butterfly-3d-puzzle-3mm/eox8lkj1/", type: "3axis" },
  "mdf-3d-dinosaur-building-kit":  { url: "https://3axis.co/laser-cut-brontosaurus-shape-wood-craft-cutout-cdr-file/r1z2xnp1/", type: "3axis" },

  // ─── Home Decor (10) ───
  "mdf-forest-animal-wall-art":      { url: "https://free-dxf.com/design-deer-art/free-download-dxf-cdr-ai-svg/xbfT4", type: "free-dxf" },
  "mdf-mandala-coaster-set":         { url: "https://3axis.co/laser-cut-flower-mandala-wall-art/dyon6pjp7r/", type: "3axis" },
  "mdf-botanical-wall-art":          { url: "https://free-dxf.com/design-tree-of-life-wall-spiritual-art/free-download-dxf-cdr-ai-svg/L28YO", type: "free-dxf" },
  "mdf-geometric-ornament-set":      { url: "https://www.dxfdownloads.com/free-super-pack-bundle-100-geometric-patterns-cdr-file/", type: "dxfdownloads" },
  "mdf-arabic-calligraphy-art":      { url: "https://free-dxf.com/design-arabic-calligraphy-allah/free-download-dxf-cdr-ai-svg/Fn0rC", type: "free-dxf" },
  "mdf-honeycomb-shelf-set":         { url: "https://www.dxfdownloads.com/free-butterfly-shelf-cnc-file-to-cut/", type: "dxfdownloads" },
  "mdf-leaf-coaster-set":            { url: "https://free-dxf.com/design-tree-of-life-wall-spiritual-art/free-download-dxf-cdr-ai-svg/L28YO", type: "free-dxf" },
  "mdf-moon-phase-wall-hanging":     { url: "https://free-dxf.com/design-moon-star-free-vector/free-download-dxf-cdr-ai-svg/3aHfA", type: "free-dxf" },
  "mdf-personalized-name-ornament":  { url: "https://3axis.co/laser-cut-wooden-alphabet-for-kids-abc-puzzle-board/5e1gw80vol/", type: "3axis" },
  "mdf-spice-jar-labels":            { url: "https://3axis.co/laser-cut-wooden-alphabet-for-kids-abc-puzzle-board/5e1gw80vol/", type: "3axis" },

  // ─── Kids Toys (5) ───
  "mdf-counting-abc-board":     { url: "https://3axis.co/laser-cut-wooden-alphabet-for-kids-abc-puzzle-board/5e1gw80vol/", type: "3axis" },
  "mdf-3d-city-building-set":   { url: "https://www.dxfdownloads.com/free-cnc-cut-design-decorative-flower-house/", type: "dxfdownloads" },
  "mdf-shape-sorter-puzzle":    { url: "https://3axis.co/laser-cut-montessori-circle-puzzle-toy-cdr-file/e1gkedxo/", type: "3axis" },
  "mdf-marble-run-contraption": { url: "https://3axis.co/laser-cut-wooden-rocket-shaped-3d-puzzle-educational-toddler-matching-blocks/eoxpx9g7/", type: "3axis" },
  "mdf-tangram-puzzle-set":     { url: "https://3axis.co/laser-cut-wooden-heart-tangram-puzzle-geometric-puzzle-shapes-board-game/kp7y3l45oq/", type: "3axis" },
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function extractOgImage(html) {
  // Try og:image
  const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
  if (ogMatch) return ogMatch[1];

  // Try twitter:image
  const twMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="twitter:image"/i);
  if (twMatch) return twMatch[1];

  // Try first large image in content
  const imgMatch = html.match(/<img[^>]*src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

async function main() {
  const imageMap = {};
  const entries = Object.entries(productSources);

  // Group by unique source URL to avoid duplicate fetches
  const urlToSlugs = {};
  for (const [slug, { url }] of entries) {
    if (!urlToSlugs[url]) urlToSlugs[url] = [];
    urlToSlugs[url].push(slug);
  }

  console.log(`Fetching ${Object.keys(urlToSlugs).length} unique source URLs...`);

  let fetched = 0;
  let failed = 0;

  for (const [url, slugs] of Object.entries(urlToSlugs)) {
    const source = productSources[slugs[0]];
    try {
      let imageUrl;

      if (source.type === "3axis") {
        // Extract code from URL: https://3axis.co/laser-cut-xxx/CODE/
        const codeMatch = url.match(/\/([a-z0-9]+)\/?$/);
        if (codeMatch) {
          imageUrl = `https://cdn.3axis.co/user-images/${codeMatch[1]}.jpg`;
        }
      } else {
        // free-dxf or dxfdownloads: fetch page and extract og:image
        const html = await fetchUrl(url);
        imageUrl = extractOgImage(html);
      }

      if (imageUrl) {
        for (const slug of slugs) {
          imageMap[slug] = imageUrl;
        }
        fetched++;
        console.log(`  ✅ ${slugs[0]}${slugs.length > 1 ? ` (+${slugs.length - 1} more)` : ""} -> ${imageUrl.substring(0, 70)}`);
      } else {
        failed++;
        console.log(`  ❌ ${slugs[0]} - no image found on page`);
      }
    } catch (err) {
      failed++;
      console.log(`  ❌ ${slugs[0]} - ${err.message}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nFetched: ${fetched}, Failed: ${failed}`);

  // Now replace in products.ts
  let content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let replaced = 0;

  for (let i = 0; i < lines.length; i++) {
    for (const [slug, imageUrl] of Object.entries(imageMap)) {
      if (lines[i].includes(`slug: "${slug}"`)) {
        // Replace imageUrl
        lines[i] = lines[i].replace(
          /imageUrl: "[^"]*"/,
          `imageUrl: "${imageUrl}"`
        );
        replaced++;
        break;
      }
    }
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`\n✅ Replaced ${replaced} product images with source images`);
}

main().catch(console.error);
