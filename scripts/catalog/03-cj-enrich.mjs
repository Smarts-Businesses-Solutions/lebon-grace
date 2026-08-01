/**
 * Phase 2b step 3 — enrich Postgres from the CJ Dropshipping API.
 *
 * For every product with a cj_pid:
 *   products.details       <- authoritative weight + material from CJ
 *   products.image_url     <- CJ's primary image (only if ours is missing)
 *   product_variants       <- FULL variant list (sku, name, color, size, price, image)
 *
 * Variants are the main win: Postgres currently has 4 variant rows for 515
 * products, because the old flow scraped them by hand.
 *
 * FAIR USAGE (deliberate):
 *   - CJ documents 30 req/s (6 req/s on some tiers). We run at ~2 req/s.
 *   - One access token is fetched and reused (tokens last ~15 days).
 *   - 429/5xx -> exponential backoff, then skip; never hammer.
 *   - Checkpointed: re-running resumes and skips products already enriched.
 *
 * Run:  node scripts/catalog/03-cj-enrich.mjs [--limit N] [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

const REQ_INTERVAL_MS = 500;   // ~2 req/s — far under CJ's documented ceiling
const CHECKPOINT = ".cj-enrich-checkpoint.json";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── auth (single token, reused) ──────────────────────────────────────────────
async function getToken() {
  if (existsSync(".cj_token.json")) {
    const t = JSON.parse(readFileSync(".cj_token.json", "utf8"));
    if (t.accessToken && new Date(t.expiry) > new Date(Date.now() + 3600e3)) return t.accessToken;
  }
  const r = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: env.CJDS_API_KEY }),
  });
  const j = await r.json();
  if (!j.result) throw new Error("CJ auth failed: " + j.message);
  writeFileSync(".cj_token.json", JSON.stringify({ accessToken: j.data.accessToken, expiry: j.data.accessTokenExpiryDate }));
  return j.data.accessToken;
}

// ── one CJ product query, with backoff ───────────────────────────────────────
async function cjQuery(pid, token, attempt = 0) {
  const r = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(pid)}`,
    { headers: { "CJ-Access-Token": token } });
  if (r.status === 429 || r.status >= 500) {
    if (attempt >= 3) return null;
    const wait = 2000 * Math.pow(2, attempt);       // 2s, 4s, 8s
    console.log(`    rate/server limit (${r.status}) — backing off ${wait}ms`);
    await sleep(wait);
    return cjQuery(pid, token, attempt + 1);
  }
  const j = await r.json().catch(() => null);
  if (!j?.result) return null;
  return j.data;
}

function firstJson(v) {                              // CJ returns some fields as JSON strings
  if (!v) return null;
  try { const a = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(a) ? a[0] : a; }
  catch { return typeof v === "string" ? v : null; }
}

// Map a CJ variant to our product_variants row shape.
function mapVariant(slug, v) {
  const key = v.variantKey || v.variantNameEn || v.variantName || "";
  const parts = String(key).split(/[-/]/).map((s) => s.trim()).filter(Boolean);
  const COLOR = /^(red|blue|green|black|white|pink|gold|silver|grey|gray|brown|purple|yellow|orange|beige|navy|ivory|clear|transparent|multicolor)$/i;
  const SIZE = /^(xs|s|m|l|xl|xxl|\d+(\.\d+)?\s*(cm|mm|inch|in|ml|g|kg)?)$/i;
  let color = null, size = null;
  for (const p of parts) { if (!color && COLOR.test(p)) color = p; else if (!size && SIZE.test(p)) size = p; }
  if (!color && parts.length) color = parts[0];
  if (!size && parts.length > 1) size = parts[1];
  return {
    product_slug: slug,
    variant_sku: v.variantSku || v.vid || `${slug}-${parts.join("-") || "default"}`,
    variant_name: String(key || "Default").slice(0, 200),
    variant_image: v.variantImage || "",
    variant_color: color ? String(color).slice(0, 60) : null,
    variant_size: size ? String(size).slice(0, 60) : null,
    variant_price: v.variantSellPrice != null ? Number(v.variantSellPrice) : null,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
const token = await getToken();
console.log("CJ auth OK");

const res = await fetch(`${SB}/rest/v1/products?select=slug,cj_pid,details,image_url&cj_pid=not.is.null&order=slug&limit=2000`, { headers: H });
let rows = await res.json();
const done = existsSync(CHECKPOINT) ? new Set(JSON.parse(readFileSync(CHECKPOINT, "utf8"))) : new Set();
rows = rows.filter((r) => r.cj_pid && !done.has(r.slug)).slice(0, LIMIT);
console.log(`${rows.length} products to enrich (${done.size} already done) @ ~2 req/s`);

let enriched = 0, variantRows = 0, failed = 0, i = 0;
for (const row of rows) {
  i++;
  const t0 = Date.now();
  const d = await cjQuery(row.cj_pid, token);
  if (!d) { failed++; console.log(`  [${i}/${rows.length}] ${row.slug} — no data`); await sleep(REQ_INTERVAL_MS); continue; }

  // details: keep existing dimensions/care, overwrite weight/material from CJ
  const details = { ...(row.details || {}) };
  const material = firstJson(d.materialNameEn);
  if (material) details.material = String(material);
  if (d.productWeight) details.weight = `${d.productWeight}g`;
  if (d.packingWeight) details.packWeight = `${d.packingWeight}g`;

  const image = firstJson(d.productImage);
  const patch = { details };
  if (image && !row.image_url) patch.image_url = image;

  if (!DRY) {
    await fetch(`${SB}/rest/v1/products?slug=eq.${encodeURIComponent(row.slug)}`,
      { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  }
  enriched++;

  // variants
  const vs = Array.isArray(d.variants) ? d.variants : [];
  if (vs.length) {
    const mapped = vs.map((v) => mapVariant(row.slug, v))
      .filter((v, idx, arr) => arr.findIndex((x) => x.variant_sku === v.variant_sku) === idx); // dedupe by sku
    if (!DRY && mapped.length) {
      const r = await fetch(`${SB}/rest/v1/product_variants?on_conflict=product_slug,variant_sku`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(mapped),
      });
      if (!r.ok && variantRows === 0) console.log("   variant upsert issue:", r.status, (await r.text()).slice(0, 160));
    }
    variantRows += mapped.length;
  }

  done.add(row.slug);
  if (!DRY && i % 25 === 0) writeFileSync(CHECKPOINT, JSON.stringify([...done]));
  if (i % 25 === 0 || i === rows.length) console.log(`  [${i}/${rows.length}] enriched=${enriched} variants=${variantRows} failed=${failed}`);

  const elapsed = Date.now() - t0;
  if (elapsed < REQ_INTERVAL_MS) await sleep(REQ_INTERVAL_MS - elapsed);
}
if (!DRY) writeFileSync(CHECKPOINT, JSON.stringify([...done]));
console.log(`DONE — enriched ${enriched}, variant rows ${variantRows}, failed ${failed}`);
