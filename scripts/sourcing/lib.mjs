/**
 * Sourcing agent — shared library.
 *
 * Sections:
 *   CONFIG     tunable business parameters (all in one place)
 *   CJ         authenticated, throttled CJ Dropshipping client
 *   FILTERS    Filter A (Montaji), Filter B (TDRA), volumetric, category
 *   ECONOMICS  landed cost + expected-margin gate
 *   MARKET     competition + market-price oracle (pluggable)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

// ───────────────────────────── CONFIG ─────────────────────────────
// Every number that encodes a business assumption lives here. Values marked
// ASSUMPTION should be replaced with measured figures.
export const CONFIG = {
  FX_USD_AED: 3.6725,          // AED is pegged
  STRIPE_PCT: 0.029,           // ASSUMPTION — confirm your UAE Stripe rate
  STRIPE_FIXED_AED: 1.0,       // ASSUMPTION
  COD_FEE_AED: 5.0,            // ASSUMPTION — courier cash-handling per delivery
  COD_FAIL_RATE: 0.15,         // ASSUMPTION — measure this; it moves results most
  MARGIN_GATE_AED: 25.0,       // required EXPECTED contribution per unit
  MIN_RETAIL_AED: 49.0,        // price floor for "quiet luxury" positioning
  RETAIL_ROUNDING: 5,          // round suggested retail up to a multiple of this
  MAX_VOLUMETRIC_RATIO: 1.5,   // volumetric weight must not exceed actual by >1.5x
  MAX_LISTED_NUM: 200,         // saturation ceiling — too many sellers = commodity
  REQ_INTERVAL_MS: 500,        // ~2 req/s — far below CJ's documented 30/s
  MIN_UNDERCUT: 0.10,          // must sell at least 10% BELOW prevailing market price
  PAGES_PER_KEYWORD: 3,        // CJ search is noisy; screen deeper for recall
  PAGE_SIZE: 20,
};

export const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────── CJ ───────────────────────────────
const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const TOKEN_FILE = ".cj_token.json";
let _token = null, _lastCall = 0;

async function token() {
  if (_token) return _token;
  if (existsSync(TOKEN_FILE)) {
    const t = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    if (t.accessToken && new Date(t.expiry) > new Date(Date.now() + 3600e3)) return (_token = t.accessToken);
  }
  const j = await (await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: env.CJDS_API_KEY }),
  })).json();
  if (!j.result) throw new Error("CJ auth failed: " + j.message);
  writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken: j.data.accessToken, expiry: j.data.accessTokenExpiryDate }));
  return (_token = j.data.accessToken);
}

/** Throttled + backed-off CJ request. Never hammers: fair-usage by construction. */
export async function cj(path, { method = "GET", body = null, attempt = 0 } = {}) {
  const wait = CONFIG.REQ_INTERVAL_MS - (Date.now() - _lastCall);
  if (wait > 0) await sleep(wait);
  _lastCall = Date.now();
  const t = await token();
  const res = await fetch(`${CJ_BASE}${path}`, {
    method, headers: { "CJ-Access-Token": t, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) return null;
    await sleep(2000 * 2 ** attempt);
    return cj(path, { method, body, attempt: attempt + 1 });
  }
  const j = await res.json().catch(() => null);
  if (!j?.result) return null;
  return j.data;
}

export const cjSearch = (keyword, page = 1, size = 20) =>
  cj(`/product/list?pageNum=${page}&pageSize=${size}&productNameEn=${encodeURIComponent(keyword)}`);
export const cjProduct = (pid) => cj(`/product/query?pid=${encodeURIComponent(pid)}`);
export const cjFreight = (vid, qty = 1) =>
  cj(`/logistic/freightCalculate`, { method: "POST", body: { startCountryCode: "CN", endCountryCode: "AE", products: [{ quantity: qty, vid }] } });

// ───────────────────────────── FILTERS ─────────────────────────────
// Filter A — Dubai Municipality (Montaji). Anything ingestible, or applied to
// and left on skin/hair/nails, needs product registration. Design it out.
//
// Widened after a live run leaked "Minoxidil Hair Wash" and "Silk Peptide
// Ampoule": brand-name actives and dosage-form words must be caught too, not
// just the obvious "cream/serum/gel".
const FAIL_A = /\b(cream|serum|ampoule|essence|lotion|ointment|balm|salve|toner|emulsion|gel|oil|shampoo|conditioner|hair ?wash|body ?wash|soap|cleanser|micellar|mask(?!ing tape)|scrub(?! brush)|peel|exfoliant|liquid|powder|paste|wax|spray|mist|perfume|fragrance|cologne|deodorant|antiperspirant|sunscreen|spf|repellent|sanitiz|disinfect|antibacterial|bleach|adhesive|glue|resin|paint|ink|dye|candle|incense|diffuser|aroma|scented|tea|coffee|supplement|vitamin|collagen|edible|food|snack|syrup|extract|tincture|minoxidil|retinol|niacinamide|salicylic|hyaluronic|peptide|keratin|botox|whitening|anti-?aging|treatment|therapy|medicated|pharmaceutical)\b/i;

// Filter A2 — MoHAP medical-device exposure. Anything that penetrates skin or
// makes a therapeutic claim is a separate (stricter) registration regime.
const FAIL_MEDICAL = /\b(needle|micro-?needl|derma ?roll|dermaroller|lancet|syringe|surgical|medical|therapeutic|orthopedic|prosthe|laser|uv|ultrasonic|infrared|diagnos|thermometer|blood pressure|oximeter)\b/i;

// Filter B — TDRA / MoIAT. Anything powered or radiating needs type approval.
const FAIL_B = /\b(led|usb|battery|batteries|rechargeable|charging|charger|bluetooth|wireless|wi-?fi|electric|electronic|motor|motoriz|vibrat|heated|heating|lamp|light-?up|luminous|glow|power ?bank|plug|adapter|cord|cable(?! organi)|speaker|sensor|digital|smart)\b/i;

// Inert, stable materials the spec explicitly allows.
const ALLOWED_MATERIAL = /(stainless steel|steel|metal|jade|quartz|stone|marble|wood|bamboo|silicone|silk|satin|linen|canvas|cotton|microfiber|micro-?fibre|leather|pu leather|felt|nylon|polyester|ceramic|aluminum|aluminium)/i;
const REJECT_MATERIAL = /\b(glass|acrylic)\b/i;

export function filterA(text) {
  const m = text.match(FAIL_A);
  if (m) return { pass: false, reason: `Montaji risk: "${m[0]}"` };
  const med = text.match(FAIL_MEDICAL);
  if (med) return { pass: false, reason: `MoHAP medical-device risk: "${med[0]}"` };
  return { pass: true };
}

/**
 * Relevance gate. CJ's keyword search is fuzzy — a search for
 * "silk sleeping bonnet" returns pillows, dresses and baby clothes. A product
 * only counts if it shares meaningful tokens with the query that found it.
 */
export function filterRelevance(title, keyword) {
  const stop = new Set(["the", "and", "for", "with", "set", "of", "only", "empty", "premium"]);
  const kw = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  const t = title.toLowerCase();

  // Whole-word match (with simple plural tolerance). Substring matching let
  // "mat" match "Boot Sandals MATching" and ship footwear as a desk mat.
  const has = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i").test(t);
  const hits = kw.filter(has);

  // The HEAD NOUN (last token, e.g. "sculptor", "bonnet", "cubes") is what the
  // product actually IS; the leading words are usually material adjectives.
  // Without this, "stainless steel facial sculptor" matched a "Stainless Steel
  // Identification Solution" and a "Pet Water Fountain" on the two generic
  // material words alone.
  const head = kw[kw.length - 1];
  if (head && !has(head)) {
    return { pass: false, reason: `off-target: missing head noun "${head}"` };
  }
  const need = Math.max(2, Math.ceil(kw.length * 0.6));
  return hits.length >= Math.min(need, kw.length)
    ? { pass: true, matched: hits.length }
    : { pass: false, reason: `off-target: matched ${hits.length}/${kw.length} of "${keyword}"` };
}

/**
 * Market gate — we must undercut the prevailing UAE market price.
 * Returns pass/fail, or `unknown` when no market data is available (in which
 * case the candidate must be price-checked by a human before approval).
 */
export function filterMarket(retailAed, marketAed, C = CONFIG) {
  if (!marketAed) return { pass: null, reason: "no market price — manual check required" };
  const ceiling = marketAed * (1 - C.MIN_UNDERCUT);
  return retailAed <= ceiling
    ? { pass: true, undercut: +(1 - retailAed / marketAed).toFixed(3) }
    : { pass: false, reason: `AED ${retailAed} is not ${Math.round(C.MIN_UNDERCUT * 100)}% under market AED ${marketAed}` };
}
export function filterB(text) {
  const m = text.match(FAIL_B);
  return m ? { pass: false, reason: `TDRA risk: "${m[0]}"` } : { pass: true };
}
export function filterMaterial(material, text) {
  const hay = `${material || ""} ${text}`;
  const bad = hay.match(REJECT_MATERIAL);
  if (bad) return { pass: false, reason: `brittle/bulky material: "${bad[0]}"` };
  if (material && !ALLOWED_MATERIAL.test(material)) return { pass: true, warn: `material not whitelisted: "${material}"` };
  return { pass: true };
}

/**
 * Volumetric screen. CJ returns variant dimensions in MILLIMETRES
 * (verified: a 12g item reports 100 x 100 x 20 with volume 200000 = L*W*H).
 * Volumetric weight (kg) = (L_cm * W_cm * H_cm) / 5000, so with mm inputs
 * that is (L*W*H) / 5,000,000.
 */
export function filterVolumetric(variant) {
  const L = Number(variant?.variantLength || 0), W = Number(variant?.variantWidth || 0), H = Number(variant?.variantHeight || 0);
  const actualKg = Number(variant?.variantWeight || 0) / 1000;
  if (!L || !W || !H || !actualKg) return { pass: false, reason: "missing dimensions or weight" };
  const volKg = (L * W * H) / 5_000_000;
  const ratio = volKg / actualKg;
  return {
    pass: ratio <= CONFIG.MAX_VOLUMETRIC_RATIO,
    reason: ratio > CONFIG.MAX_VOLUMETRIC_RATIO ? `volumetric ratio ${ratio.toFixed(2)}x exceeds ${CONFIG.MAX_VOLUMETRIC_RATIO}x` : undefined,
    dims_cm: { length: L / 10, width: W / 10, height: H / 10 },
    actual_weight_kg: actualKg,
    volumetric_weight_kg: Number(volKg.toFixed(3)),
    volumetric_ratio: Number(ratio.toFixed(2)),
  };
}

/** Flat-pack / compressible items get a scoring bonus (cheaper to fly). */
export function packagingType(text) {
  if (/vacuum[- ]?(seal|pack)/i.test(text)) return "Vacuum-sealed";
  if (/(flat[- ]?pack|foldable|collapsible|rolled|roll[- ]?up)/i.test(text)) return "Flat-pack";
  if (/\btube\b/i.test(text)) return "Tube";
  return "Box";
}

// ──────────────────────────── ECONOMICS ────────────────────────────
/**
 * Landed cost and EXPECTED contribution under the 50/50 deposit + COD model.
 *
 *   landed      = (product + freight) * FX
 *   stripe_fee  = (R/2) * pct + fixed        (only the deposit is charged)
 *   delivered   = R - landed - stripe - cod_fee
 *   refused     = R/2 - landed - stripe      (deposit kept, goods+freight lost)
 *   E[C]        = (1-p)*delivered + p*refused
 */
export function economics(retailAed, productUsd, freightUsd, C = CONFIG) {
  const landed = (Number(productUsd) + Number(freightUsd)) * C.FX_USD_AED;
  const stripe = (retailAed / 2) * C.STRIPE_PCT + C.STRIPE_FIXED_AED;
  const delivered = retailAed - landed - stripe - C.COD_FEE_AED;
  const refused = retailAed / 2 - landed - stripe;
  const expected = (1 - C.COD_FAIL_RATE) * delivered + C.COD_FAIL_RATE * refused;
  return {
    landed_cost_aed: +landed.toFixed(2),
    margin_if_delivered: +delivered.toFixed(2),
    margin_if_refused: +refused.toFixed(2),
    expected_margin_aed: +expected.toFixed(2),
  };
}

/** Smallest retail price that clears the gate (closed form, then rounded up). */
export function minViableRetail(productUsd, freightUsd, C = CONFIG) {
  const landed = (Number(productUsd) + Number(freightUsd)) * C.FX_USD_AED;
  const s = C.STRIPE_PCT / 2, p = C.COD_FAIL_RATE;
  const coef = (1 - p) * (1 - s) + p * (0.5 - s);
  const konst = -(landed + C.STRIPE_FIXED_AED) - (1 - p) * C.COD_FEE_AED;
  const raw = (C.MARGIN_GATE_AED - konst) / coef;
  const floored = Math.max(raw, C.MIN_RETAIL_AED);
  return Math.ceil(floored / C.RETAIL_ROUNDING) * C.RETAIL_ROUNDING;
}

// ───────────────────────────── MARKET ─────────────────────────────
/**
 * Competition + market price.
 *
 * CJ gives a genuine saturation signal (`listedNum` = how many merchants
 * already list this product). It does NOT give UAE market prices.
 *
 * Real Amazon.ae / Noon pricing has no free public API, so `marketPrice` is a
 * pluggable oracle:
 *   - default: returns null and flags the candidate for manual price check
 *   - set MARKET_PRICE_API + MARKET_PRICE_KEY in .env.local to enable an
 *     external provider (Apify/SerpAPI-style) without touching this code
 */
export function competition(detail, listItem) {
  const listed = Number(detail?.listedNum ?? listItem?.listedNum ?? 0);
  const suggest = Number(detail?.suggestSellPrice ?? 0);
  let saturation = "low";
  if (listed > CONFIG.MAX_LISTED_NUM) saturation = "saturated";
  else if (listed > 50) saturation = "high";
  else if (listed > 10) saturation = "medium";
  return {
    listed_num: listed,
    saturation,
    cj_suggest_usd: suggest || null,
    cj_suggest_aed: suggest ? +(suggest * CONFIG.FX_USD_AED).toFixed(2) : null,
  };
}

export async function marketPrice(title) {
  const api = env.MARKET_PRICE_API, key = env.MARKET_PRICE_KEY;
  if (!api || !key) return { market_price_aed: null, market_source: "manual-check-required" };
  try {
    const r = await fetch(`${api}?q=${encodeURIComponent(title)}&country=AE`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { market_price_aed: null, market_source: "oracle-error" };
    const j = await r.json();
    const prices = (j.results || j.items || []).map((x) => Number(x.price)).filter((n) => n > 0).sort((a, b) => a - b);
    if (!prices.length) return { market_price_aed: null, market_source: "oracle-no-match" };
    return { market_price_aed: +prices[Math.floor(prices.length / 2)].toFixed(2), market_source: "oracle-median" };
  } catch {
    return { market_price_aed: null, market_source: "oracle-error" };
  }
}

// ────────────────────────────── DB ──────────────────────────────
const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
export const dbHeaders = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
export async function upsertCandidate(row) {
  const r = await fetch(`${SB}/rest/v1/sourcing_candidates?on_conflict=cj_pid`, {
    method: "POST",
    headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  return r.ok ? null : `${r.status} ${(await r.text()).slice(0, 160)}`;
}
export async function existingPids() {
  const [c, p] = await Promise.all([
    fetch(`${SB}/rest/v1/sourcing_candidates?select=cj_pid&limit=5000`, { headers: dbHeaders }).then((r) => r.ok ? r.json() : []),
    fetch(`${SB}/rest/v1/products?select=cj_pid&cj_pid=not.is.null&limit=5000`, { headers: dbHeaders }).then((r) => r.ok ? r.json() : []),
  ]);
  return new Set([...c.map((x) => x.cj_pid), ...p.map((x) => x.cj_pid)].filter(Boolean));
}
