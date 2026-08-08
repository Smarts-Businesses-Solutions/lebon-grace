/**
 * Replace external image URLs with proxied versions.
 * e.g. https://cdn.3axis.co/user-images/xxx.jpg -> /api/proxy-image?url=https://cdn.3axis.co/user-images/xxx.jpg
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(filePath, "utf-8");

const HOSTS = ["cdn.3axis.co", "free-dxf.com", "www.dxfdownloads.com"];
let replaced = 0;

for (const host of HOSTS) {
  // Match URLs containing this host
  const regex = new RegExp(`https?://${host.replace(/\./g, "\\.")}[^"']*`, "g");
  const newContent = content.replace(regex, (match) => {
    replaced++;
    return `/api/proxy-image?url=${encodeURIComponent(match)}`;
  });
  content = newContent;
}

fs.writeFileSync(filePath, content, "utf-8");
console.log(`✅ Proxied ${replaced} external image URLs`);

// Verify a few
const verify = fs.readFileSync(filePath, "utf-8");
for (const slug of ["mdf-heart-cutout", "mdf-fish-cutout", "mdf-butterfly-cutout"]) {
  const m = verify.match(new RegExp(`slug: "${slug}"[^}]*imageUrl: "([^"]*)"`));
  console.log(`  ${slug}: ${m ? m[1].substring(0, 80) : "NOT FOUND"}`);
}
