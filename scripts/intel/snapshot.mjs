/**
 * Product intelligence — nightly stock snapshot.
 *
 *   node scripts/intel/snapshot.mjs            # snapshot the whole watchlist
 *   node scripts/intel/snapshot.mjs --seed     # seed watchlist from our catalog first
 *   node scripts/intel/snapshot.mjs --limit 50
 *
 * Designed to be run by cron once a day. Two readings a day would be finer
 * grained but doubles CJ calls for little gain — stock moves on a scale of days.
 *
 * Throttled to ~2 req/s (CJ documents 30/s), so a 500-product watchlist takes
 * roughly 4-5 minutes.
 */
import { CONFIG, env, cj, sleep } from "../sourcing/lib.mjs";

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
};

const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 0;

// ── seed the watchlist from products we already sell ──
if (args.includes("--seed")) {
  const rows = await (await fetch(
    `${SB}/rest/v1/products?select=cj_pid,name,category&cj_pid=not.is.null&limit=2000`, { headers: H }
  )).json();
  const seen = new Set();
  const payload = rows
    .filter((r) => r.cj_pid && !seen.has(r.cj_pid) && seen.add(r.cj_pid))
    .map((r) => ({ cj_pid: r.cj_pid, product_name: r.name, category: r.category, source: "catalog" }));
  const res = await fetch(`${SB}/rest/v1/product_intel_watchlist?on_conflict=cj_pid`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
  console.log(res.ok ? `seeded ${payload.length} products into the watchlist` : `seed failed ${res.status}`);
}

// ── take the snapshot ──
const wl = await (await fetch(
  `${SB}/rest/v1/product_intel_watchlist?select=cj_pid,product_name,primary_vid&active=is.true&limit=${LIMIT || 2000}`,
  { headers: H }
)).json();

if (!Array.isArray(wl) || wl.length === 0) {
  console.log("watchlist empty — run with --seed first");
  process.exit(0);
}
console.log(`snapshotting ${wl.length} products (~${Math.round(wl.length * CONFIG.REQ_INTERVAL_MS / 1000 / 60)} min)`);

const batch = [];
const vidUpdates = [];
let ok = 0, miss = 0;

for (const [i, item] of wl.entries()) {
  // Stock does NOT come from /product/query — inventoryNum is null there on both
  // the product and its variants (verified). The real figures live behind
  // /product/stock/queryByVid, which is per-variant, so we cache the primary vid
  // on the watchlist and spend one call per product per night thereafter.
  let vid = item.primary_vid;
  let variantCount = null, sellPrice = null, status = "";

  if (!vid) {
    const d = await cj(`/product/query?pid=${encodeURIComponent(item.cj_pid)}`);
    if (!d) { miss++; continue; }
    const variants = Array.isArray(d.variants) ? d.variants : [];
    vid = variants[0]?.vid;
    variantCount = variants.length;
    sellPrice = Number(d.sellPrice) || null;
    status = String(d.status ?? d.saleStatus ?? "");
    if (!vid) { miss++; continue; }
    vidUpdates.push({ cj_pid: item.cj_pid, primary_vid: vid });
  }

  const stock = await cj(`/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`);
  const rows = Array.isArray(stock) ? stock : [];
  if (!rows.length) { miss++; continue; }

  // Sum across warehouses. cjInventoryNum is stock CJ physically holds (depletes
  // per order); factoryInventoryNum sits at the supplier and moves in bulk.
  // Track both — they tell different stories about demand.
  const total = rows.reduce((s, r) => s + (Number(r.totalInventoryNum) || 0), 0);
  const cjInv = rows.reduce((s, r) => s + (Number(r.cjInventoryNum) || 0), 0);
  const facInv = rows.reduce((s, r) => s + (Number(r.factoryInventoryNum) || 0), 0);

  batch.push({
    cj_pid: item.cj_pid,
    inventory: total,
    cj_inventory: cjInv,
    factory_inventory: facInv,
    variant_count: variantCount,
    sell_price: sellPrice,
    sale_status: status,
  });
  ok++;
  if ((i + 1) % 25 === 0) console.log(`  [${i + 1}/${wl.length}] ok=${ok} miss=${miss}`);
}

// Persist any newly-discovered vids so later runs skip the product lookup.
if (vidUpdates.length) {
  await fetch(`${SB}/rest/v1/product_intel_watchlist?on_conflict=cj_pid`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(vidUpdates),
  });
  console.log(`cached ${vidUpdates.length} variant ids`);
}

// One write at the end: a partial snapshot is still useful, and this keeps the
// captured_at values close together so deltas compare like with like.
if (batch.length) {
  const res = await fetch(`${SB}/rest/v1/product_intel_snapshots`, {
    method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(batch),
  });
  console.log(res.ok ? `wrote ${batch.length} snapshots` : `write failed ${res.status} ${(await res.text()).slice(0, 200)}`);
}
console.log(`done — captured ${ok}, unavailable ${miss}`);
