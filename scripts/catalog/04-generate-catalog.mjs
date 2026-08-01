/**
 * Phase 2b step 4 — generate src/lib/products.generated.ts FROM POSTGRES.
 *
 * Postgres is the single source of truth for the catalog. This emits the same
 * shape the storefront already imports (`products`, `categories`), so the seven
 * client components that import it synchronously stay unchanged — no rewrite of
 * every page, no client-side DB calls.
 *
 * Why generate rather than fetch at runtime: the catalog changes rarely, the
 * consumers are client components, and a static import keeps pages fast and
 * SEO-friendly. Regenerate + rebuild when the catalog changes (this is the
 * documented Next.js pattern: DB as source of truth, static generation for
 * rarely-changing data).
 *
 * The 36 duplicate "-N" slugs disappear automatically: they don't exist in
 * Postgres. Hidden products keep their `hidden` flag from the DB.
 *
 * Run:  node scripts/catalog/04-generate-catalog.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

const res = await fetch(`${SB}/rest/v1/products?select=*&order=price.asc,slug.asc&limit=5000`, { headers: H });
if (!res.ok) { console.error("fetch failed", res.status); process.exit(1); }
const rows = await res.json();
if (!rows.length) { console.error("REFUSING to generate an empty catalog"); process.exit(1); }

// Category counts drive the category list (visible products only).
const counts = {};
// Retired products (hidden in the DB) are NOT emitted. They stay in Postgres as
// the record of what was sold, but shipping 500+ dead entries to every browser
// costs bundle size for nothing. `hidden` remains in the type because a product
// can still be hidden individually without being retired.
const visible = rows.filter((r) => !r.hidden);
for (const r of visible) counts[r.category] = (counts[r.category] || 0) + 1;

const ICONS = { "MDF Cutouts": "🪵", "DIY Kits": "🎨", "Kids Toys": "🧸" };

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim();

const productLines = visible.map((r) => {
  const details = r.details && Object.keys(r.details).length ? r.details : { material: "Mixed materials" };
  const ph = r.image_placeholder && r.image_placeholder.bg
    ? r.image_placeholder
    : { bg: "#C9A96E", initials: String(r.name || "?").slice(0, 2).toUpperCase() };
  // Arrays (e.g. the gallery `images`) must stay arrays; String() would flatten
  // them into one comma-joined value and the gallery would render a single
  // broken src.
  const detailPairs = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => Array.isArray(v)
      ? `${k}: [${v.map((x) => `"${esc(x)}"`).join(", ")}]`
      : `${k}: "${esc(v)}"`)
    .join(", ");
  return `  { slug: "${esc(r.slug)}", name: "${esc(r.name)}", variant: "${esc(r.variant || "Good Value")}", price: ${Number(r.price)}, category: "${esc(r.category)}", stock: ${Number(r.stock ?? 0)},
    description: "${esc(r.description)}",
    details: { ${detailPairs} },
    imagePlaceholder: { bg: "${esc(ph.bg)}", initials: "${esc(ph.initials)}" },
    imageUrl: "${esc(r.image_url)}"${r.cj_pid ? `, cjPid: "${esc(r.cj_pid)}"` : ""}${r.cj_price ? `, cjPrice: "${esc(r.cj_price)}"` : ""}${r.hidden ? ", hidden: true" : ""} },`;
}).join("\n");

const categoryLines = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([name, n]) => `  { name: "${esc(name)}", description: "${n} products", icon: "${ICONS[name] || "📦"}" },`)
  .join("\n");

const out = `// AUTO-GENERATED FROM POSTGRES — DO NOT EDIT BY HAND.
// Source of truth: the \`products\` table in the self-hosted Postgres.
// Regenerate:  node scripts/catalog/04-generate-catalog.mjs
// Generated:   ${new Date().toISOString()}  (${visible.length} products)

export interface Product {
  slug: string; name: string; variant: string; price: number;
  category: string;
  stock: number; description: string;
  details: { dimensions?: string; material?: string; care?: string; weight?: string; packWeight?: string;
             age?: string; made?: string; personalisation?: string; images?: string[]; };
  imagePlaceholder: { bg: string; initials: string; };
  imageUrl: string; cjPid?: string; cjPrice?: string;
  hidden?: boolean;
}

export const products: Product[] = [
${productLines}
]

export function getProductBySlug(slug: string): Product | undefined { return products.find((p) => p.slug === slug && !p.hidden); }
export function getProductsByCategory(category: string): Product[] {
  if (category === "All") return products.filter((p) => !p.hidden);
  return products.filter((p) => p.category === category && !p.hidden);
}
export function formatPrice(price: number): string { return "AED " + price.toString(); }
export function calculateSubtotal(items: { product: Product; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

// The hidden flag stays in the type because the storefront filters on it.
// Hidden categories simply aren't emitted (no visible products in Postgres),
// so the flag is always undefined here — the filters still compile and pass.
export interface Category { name: string; description: string; icon: string; hidden?: boolean; }

export const categories: Category[] = [
${categoryLines}
]
`;

writeFileSync("src/lib/products.generated.ts", out, "utf8");
console.log(`generated src/lib/products.generated.ts — ${visible.length} products, ${Object.keys(counts).length} categories`);
console.log(`hidden: ${rows.filter((r) => r.hidden).length}`);
