import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(flag, def = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// Product data — map of all products
const products = [
  { name: "Custom Dog Memorial Portrait — Framed Canvas", price: "$89", format: "Framed Canvas 16x20", rating: 4.9, reviews: 203, img: "dog-memorial-portrait.jpg" },
  { name: "Custom Cat Memorial Portrait — Framed Canvas", price: "$89", format: "Framed Canvas 16x20", rating: 4.9, reviews: 187, img: "cat-memorial-portrait.jpg" },
  { name: "Dog Memorial Keepsake Blanket — Personalized", price: "$79", format: "Fleece Throw 60x80", rating: 4.8, reviews: 156, img: "dog-blanket.jpg" },
  { name: "Dog Mom Ceramic Mug — 11oz", price: "$19", format: "Ceramic Mug 11oz", rating: 4.7, reviews: 62, img: "pet-mug.jpg" },
  { name: "Custom Pet Portrait Hoodie — Pullover", price: "$49", format: "Unisex Pullover", rating: 4.8, reviews: 41, img: "pet-hoodie.jpg" },
  { name: "Custom Pet Portrait T-Shirt — Unisex Crew", price: "$29", format: "Unisex Crew Neck", rating: 4.6, reviews: 33, img: "pet-tshirt.jpg" },
  { name: "Dog Mom Personalized Embroidered Sweatshirt", price: "$55", format: "Embroidered Sweatshirt", rating: 4.8, reviews: 88, img: "dog-mom-sweatshirt.jpg" },
  { name: "Dog Portrait Canvas Tote Bag", price: "$29", format: "Canvas Tote 15x15", rating: 4.5, reviews: 19, img: "pet-tote.jpg" },
  { name: "Pet Portrait Throw Pillow — 16x16", price: "$39", format: "Throw Pillow 16x16", rating: 4.7, reviews: 28, img: "pet-pillow.jpg" },
  { name: "Custom Pet Photo Keychain — Metal Frame", price: "$18", format: "Metal Keychain", rating: 4.6, reviews: 44, img: "pet-keychain.jpg" },
  { name: "Custom Pet Photo Necklace — Sterling Silver Locket", price: "$49", format: "Sterling Silver Locket", rating: 4.7, reviews: 37, img: "pet-necklace.jpg" },
  { name: "Custom Pet Photo Phone Case", price: "$29", format: "Snap Case", rating: 4.5, reviews: 22, img: "pet-phonecase.jpg" },
  { name: "Custom Pet Photo Wine Glass — Etched Design", price: "$24", format: "Etched Wine Glass", rating: 4.6, reviews: 18, img: "pet-wineglass.jpg" },
  { name: "Custom Pet Travel Mug — 16oz Stainless", price: "$24", format: "Stainless Steel 16oz", rating: 4.7, reviews: 27, img: "pet-travelmug.jpg" },
  { name: "Custom Pet Memory Candle — Soy Wax", price: "$19", format: "Soy Candle 8oz", rating: 4.5, reviews: 33, img: "memorial-candle.jpg" },
  { name: "Rainbow Bridge Dog Memorial — Framed Canvas", price: "$99", format: "Framed Canvas 16x20", rating: 4.9, reviews: 142, img: "rainbow-bridge.jpg" },
  { name: "Custom Pet Photo Magnet Set — 4 Pack", price: "$14", format: "Set of 4 Magnets", rating: 4.3, reviews: 22, img: "pet-keychain.jpg" },
  { name: "Pet Loss Sympathy Card — Personalized", price: "$7", format: "Folded Card A5", rating: 4.4, reviews: 15, img: "metal-card.jpg" },
  { name: "Pet Memorial Garden Stone — Engraved Granite", price: "$30", format: "Engraved Granite", rating: 4.8, reviews: 64, img: "memorial-stone.jpg" },
  { name: "Pet Memorial Metal Card — Name and Dates", price: "$10", format: "Brushed Metal Card", rating: 4.6, reviews: 51, img: "metal-card.jpg" },
];

async function main() {
  const slug = arg("--slug");
  const outDir = arg("--out", path.join(HERE, "..", "public", "videos"));

  // Filter products
  const toRender = slug
    ? products.filter(p => p.img.replace(".jpg", "").includes(slug))
    : products;

  if (!toRender.length) {
    console.error(`No product found for slug="${slug}"`);
    process.exit(1);
  }

  console.log(`[remotion] bundling…
  entry: ${path.resolve(HERE, "src", "index.ts")}`);
  await ensureBrowser();
  const serveUrl = await bundle({ entryPoint: path.resolve(HERE, "src", "index.ts") });

  for (const props of toRender) {
    const videoName = props.img.replace(".jpg", ".mp4");
    const out = path.join(outDir, videoName);
    console.log(`[remotion] rendering ${videoName}…`);

    const composition = await selectComposition({
      serveUrl,
      id: "ProductCard",
      inputProps: props,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      pixelFormat: "yuv420p",
      outputLocation: out,
      inputProps: props,
    });

    console.log(`[remotion] wrote ${out}`);
  }

  console.log(`\nDone! Rendered ${toRender.length} product videos.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
