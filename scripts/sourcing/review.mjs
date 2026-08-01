/**
 * Sourcing review queue — the human gate.
 *
 * Nothing the agent finds reaches the storefront until it is approved here.
 *
 *   node scripts/sourcing/review.mjs                 # list pending, best first
 *   node scripts/sourcing/review.mjs --show <pid>    # full detail for one
 *   node scripts/sourcing/review.mjs --approve <pid> [--price 149]
 *   node scripts/sourcing/review.mjs --reject  <pid> --note "reason"
 *   node scripts/sourcing/review.mjs --publish       # promote approved -> products
 *
 * --publish writes into `products`; run the catalog generator + rebuild after.
 */
import { env, dbHeaders } from "./lib.mjs";

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const args = process.argv.slice(2);
const arg = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);

const get = (q) => fetch(`${SB}/rest/v1/${q}`, { headers: dbHeaders }).then((r) => r.json());
const patch = (q, body) => fetch(`${SB}/rest/v1/${q}`, {
  method: "PATCH", headers: { ...dbHeaders, Prefer: "return=minimal" }, body: JSON.stringify(body),
});

// ── show one ──
if (arg("--show")) {
  const [c] = await get(`sourcing_candidates?cj_pid=eq.${arg("--show")}&select=*`);
  if (!c) { console.log("not found"); process.exit(1); }
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}

// ── approve ──
if (arg("--approve")) {
  const body = { status: "approved", reviewed_at: new Date().toISOString() };
  if (arg("--price")) body.suggested_retail_aed = Number(arg("--price"));
  if (arg("--note")) body.reviewer_note = arg("--note");
  const r = await patch(`sourcing_candidates?cj_pid=eq.${arg("--approve")}`, body);
  console.log(r.ok ? "approved" : "failed " + r.status);
  process.exit(r.ok ? 0 : 1);
}

// ── reject ──
if (arg("--reject")) {
  const r = await patch(`sourcing_candidates?cj_pid=eq.${arg("--reject")}`, {
    status: "rejected", reviewer_note: arg("--note") || null, reviewed_at: new Date().toISOString(),
  });
  console.log(r.ok ? "rejected" : "failed " + r.status);
  process.exit(r.ok ? 0 : 1);
}

// ── publish approved -> products ──
if (args.includes("--publish")) {
  const approved = await get(`sourcing_candidates?status=eq.approved&select=*`);
  if (!approved.length) { console.log("nothing approved"); process.exit(0); }
  let ok = 0;
  for (const c of approved) {
    const slug = c.product_title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const product = {
      slug,
      name: c.product_title,
      price: Number(c.suggested_retail_aed),
      category: c.category,
      stock: 50,
      image_url: (() => { try { const i = JSON.parse(c.raw?.image || "[]"); return Array.isArray(i) ? i[0] : c.raw?.image; } catch { return c.raw?.image || ""; } })(),
      description: c.product_title,
      cj_pid: c.cj_pid,
      cj_price: String(c.sourcing_cost_usd),
      details: {
        material: c.primary_material || "Mixed materials",
        weight: `${Math.round(Number(c.actual_weight_kg) * 1000)}g`,
        dimensions: c.dims_cm?.length ? `${c.dims_cm.length} x ${c.dims_cm.width} x ${c.dims_cm.height} cm` : undefined,
      },
      image_placeholder: { bg: "#C9A96E", initials: c.product_title.slice(0, 2).toUpperCase() },
      hidden: false,
    };
    const r = await fetch(`${SB}/rest/v1/products?on_conflict=slug`, {
      method: "POST", headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(product),
    });
    if (r.ok) { ok++; await patch(`sourcing_candidates?cj_pid=eq.${c.cj_pid}`, { status: "published" }); }
    else console.log("  fail", slug, r.status, (await r.text()).slice(0, 120));
  }
  console.log(`published ${ok}/${approved.length} into products`);
  console.log("next: node scripts/catalog/04-generate-catalog.mjs && rebuild the container");
  process.exit(0);
}

// ── record a market price a human looked up (Amazon.ae / Noon / etc) ──
// Enforces the rule "we must be cheaper than the market": if the suggested
// retail is not below the market price, the candidate is auto-rejected.
if (arg("--set-market")) {
  const pid = arg("--set-market");
  const price = Number(arg("--price"));
  if (!Number.isFinite(price) || price <= 0) { console.log("need --price <aed>"); process.exit(1); }
  const [c] = await get(`sourcing_candidates?cj_pid=eq.${pid}&select=*`);
  if (!c) { console.log("not found"); process.exit(1); }
  const undercut = 1 - Number(c.suggested_retail_aed) / price;
  const viable = undercut >= 0.10;
  await patch(`sourcing_candidates?cj_pid=eq.${pid}`, {
    market_price_aed: price,
    market_source: arg("--source") || "manual",
    status: viable ? "pending_review" : "rejected",
    reviewer_note: viable
      ? `undercuts market by ${Math.round(undercut * 100)}%`
      : `NOT cheaper than market: ours AED ${c.suggested_retail_aed} vs market AED ${price}`,
    reviewed_at: new Date().toISOString(),
  });
  console.log(viable
    ? `viable — undercuts market by ${Math.round(undercut * 100)}% -> pending_review`
    : `REJECTED — AED ${c.suggested_retail_aed} is not at least 10% below market AED ${price}`);
  process.exit(0);
}

// ── default: list everything awaiting a human ──
const pending = await get(`sourcing_candidates?status=in.(pending_review,needs_market_check)&select=*&order=score.desc&limit=50`);
if (!pending.length) { console.log("queue empty — run: node scripts/sourcing/run.mjs"); process.exit(0); }
const needMkt = pending.filter((c) => c.status === "needs_market_check").length;
console.log(`${pending.length} awaiting review (best first)${needMkt ? ` — ${needMkt} need a market price` : ""}\n`);
console.log("PID".padEnd(21), "TITLE".padEnd(40), "RETAIL", "MARGIN", "VOL", "LISTED", "MARKET");
for (const c of pending) {
  console.log(
    String(c.cj_pid).padEnd(21),
    String(c.product_title).slice(0, 38).padEnd(40),
    String(c.suggested_retail_aed).padStart(6),
    String(c.expected_margin_aed).padStart(6),
    String(c.volumetric_ratio + "x").padStart(5),
    String(c.competition?.listed_num ?? "-").padStart(6),
    c.market_price_aed ? `AED ${c.market_price_aed}` : c.market_source
  );
}
console.log(`\napprove:  node scripts/sourcing/review.mjs --approve <pid> [--price 149]`);
console.log(`reject:   node scripts/sourcing/review.mjs --reject <pid> --note "why"`);
