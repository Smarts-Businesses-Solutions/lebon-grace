/**
 * Autonomous sourcing agent — UAE D2C, "Quiet Luxury".
 *
 * Pipeline per candidate:
 *   search (whitelist keywords)
 *     -> negative-keyword screen
 *     -> Filter A  (Montaji: chemical / topical / ingestible)   HARD FAIL
 *     -> Filter B  (TDRA:    electrical / battery / wireless)   HARD FAIL
 *     -> material screen (no glass / thick acrylic)             HARD FAIL
 *     -> volumetric screen (vol weight <= 1.5x actual)          HARD FAIL
 *     -> live freight quote CN->AE
 *     -> landed cost + EXPECTED margin gate                     HARD FAIL
 *     -> competition + market price
 *     -> score, write to sourcing_candidates (status=pending_review)
 *
 * Nothing is ever published automatically. A human reviews the queue and
 * approves; approval is what promotes a candidate into `products`.
 *
 * Run:  node scripts/sourcing/run.mjs [--category Beauty] [--limit 40] [--dry]
 */
import {
  CONFIG, cjSearch, cjProduct, cjFreight, filterA, filterB, filterMaterial,
  filterVolumetric, filterRelevance, filterMarket, packagingType, economics,
  minViableRetail, competition, marketPrice, upsertCandidate, existingPids,
} from "./lib.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ONLY = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 40;

// ── Category definitions (from the sourcing spec) ──
const CATEGORIES = {
  Beauty: {
    keywords: ["heatless hair curler", "silk sleeping bonnet", "satin pillowcase", "jade gua sha",
      "rose quartz roller", "stainless steel facial sculptor", "silicone face scrubber",
      "canvas makeup brush roll", "microfiber makeup remover puff"],
    negative: /\b(electric|led|vibrat|charging|serum|cream|acne|liquid|acrylic organizer)\b/i,
  },
  Workspace: {
    keywords: ["pu leather desk mat", "foldable aluminum laptop stand", "felt cable organizer pouch",
      "mechanical keyboard canvas sleeve", "wood desk tidy tray"],
    negative: /\b(rgb|usb hub|wireless charger|lamp|power strip)\b/i,
  },
  Travel: {
    keywords: ["compression packing cubes", "nylon travel storage set", "hanging toiletry bag empty",
      "rfid leather passport wallet", "silicone travel bottle sleeve"],
    negative: /\b(hard shell luggage|rigid vanity case|power bank)\b/i,
  },
  Textiles: {
    keywords: ["embroidered cushion cover", "linen table runner", "woven placemat set",
      "vacuum sealed throw blanket", "tufted cotton pillowcase"],
    negative: /\b(pillow with insert|floor pouf|stuffed|ceramic vase|glass ornament)\b/i,
  },
};

const stats = { seen: 0, dupe: 0, negative: 0, offTarget: 0, failA: 0, failB: 0, failMaterial: 0, failVolumetric: 0, noFreight: 0, badPrice: 0, failMargin: 0, aboveMarket: 0, passed: 0, needsMarketCheck: 0 };
const seenPids = await existingPids();
console.log(`sourcing agent — ${seenPids.size} known pids (skipped as duplicates)`);
console.log(`gate: expected margin >= AED ${CONFIG.MARGIN_GATE_AED}, retail floor AED ${CONFIG.MIN_RETAIL_AED}, max volumetric ${CONFIG.MAX_VOLUMETRIC_RATIO}x\n`);

for (const [category, def] of Object.entries(CATEGORIES)) {
  if (ONLY && category !== ONLY) continue;
  console.log(`\n=== ${category} ===`);
  let acceptedInCat = 0;

  for (const kw of def.keywords) {
    if (acceptedInCat >= LIMIT) break;
    // Screen several pages per keyword: CJ's relevance ranking is weak, so the
    // on-target items are scattered rather than concentrated on page 1.
    const list = [];
    for (let pg = 1; pg <= CONFIG.PAGES_PER_KEYWORD; pg++) {
      const page = await cjSearch(kw, pg, CONFIG.PAGE_SIZE);
      const chunk = page?.list || [];
      list.push(...chunk);
      if (chunk.length < CONFIG.PAGE_SIZE) break;   // no more pages
    }
    if (!list.length) { console.log(`  "${kw}" — no results`); continue; }

    for (const item of list) {
      if (acceptedInCat >= LIMIT) break;
      stats.seen++;
      const pid = item.pid;
      const title = item.productNameEn || item.productName || "";
      if (!pid || seenPids.has(pid)) { stats.dupe++; continue; }
      seenPids.add(pid);

      const blob = `${title} ${item.categoryName || ""}`;
      if (def.negative.test(blob)) { stats.negative++; continue; }

      // CJ search is fuzzy — reject results that aren't actually the thing we
      // searched for, before spending API calls on them.
      const rel = filterRelevance(title, kw);
      if (!rel.pass) { stats.offTarget++; continue; }

      const a = filterA(blob); if (!a.pass) { stats.failA++; continue; }
      const b = filterB(blob); if (!b.pass) { stats.failB++; continue; }

      const detail = await cjProduct(pid);
      if (!detail) continue;
      const material = (() => { try { const m = JSON.parse(detail.materialNameEn || "[]"); return Array.isArray(m) ? m[0] : detail.materialNameEn; } catch { return detail.materialNameEn || null; } })();
      const fullText = `${title} ${detail.description || ""} ${material || ""}`;

      const a2 = filterA(fullText); if (!a2.pass) { stats.failA++; continue; }
      const b2 = filterB(fullText); if (!b2.pass) { stats.failB++; continue; }
      const mat = filterMaterial(material, fullText); if (!mat.pass) { stats.failMaterial++; continue; }

      const variant = (detail.variants || [])[0];
      const vol = filterVolumetric(variant);
      if (!vol.pass) { stats.failVolumetric++; continue; }

      const freightOpts = await cjFreight(variant.vid);
      const cheapest = Array.isArray(freightOpts)
        ? freightOpts.filter((o) => Number(o.logisticPrice) > 0).sort((a, b) => Number(a.logisticPrice) - Number(b.logisticPrice))[0]
        : null;
      if (!cheapest) { stats.noFreight++; continue; }

      // Guard against missing/!numeric prices (a live run produced AED NaN).
      const productUsd = Number(detail.sellPrice ?? item.sellPrice ?? NaN);
      const freightUsd = Number(cheapest.logisticPrice);
      if (!Number.isFinite(productUsd) || productUsd <= 0 || !Number.isFinite(freightUsd) || freightUsd <= 0) {
        stats.badPrice++; continue;
      }
      const retail = minViableRetail(productUsd, freightUsd);
      const econ = economics(retail, productUsd, freightUsd);
      if (!Number.isFinite(econ.expected_margin_aed)) { stats.badPrice++; continue; }
      if (econ.expected_margin_aed < CONFIG.MARGIN_GATE_AED) { stats.failMargin++; continue; }

      const comp = competition(detail, item);
      if (comp.saturation === "saturated") { stats.negative++; continue; }
      const mkt = await marketPrice(title);

      // Market gate: we must undercut the prevailing UAE price. If our
      // minimum viable retail is ABOVE market, the product is unsellable —
      // landed cost and market ceiling have squeezed it out.
      const market = filterMarket(retail, mkt.market_price_aed);
      if (market.pass === false) { stats.aboveMarket++; continue; }
      // pass === null -> market price unknown; queue for manual price check
      const queueStatus = market.pass === true ? "pending_review" : "needs_market_check";

      // score: margin, flat-pack bonus, low-saturation bonus, market headroom
      let score = econ.expected_margin_aed;
      const pack = packagingType(fullText);
      if (pack === "Flat-pack" || pack === "Vacuum-sealed") score *= 1.25;
      if (comp.saturation === "low") score *= 1.15;
      if (mkt.market_price_aed && mkt.market_price_aed > retail) score *= 1.2; // priced under market

      const row = {
        cj_pid: pid,
        product_title: title.slice(0, 200),
        category,
        primary_material: material,
        packaging_type: pack,
        sourcing_cost_usd: productUsd,
        freight_usd: freightUsd,
        actual_weight_kg: vol.actual_weight_kg,
        dims_cm: vol.dims_cm,
        volumetric_weight_kg: vol.volumetric_weight_kg,
        volumetric_ratio: vol.volumetric_ratio,
        landed_cost_aed: econ.landed_cost_aed,
        suggested_retail_aed: retail,
        expected_margin_aed: econ.expected_margin_aed,
        competition: comp,
        market_price_aed: mkt.market_price_aed,
        market_source: mkt.market_source,
        passes_all_filters: true,
        filter_results: {
          montaji: "pass", tdra: "pass", material: mat.warn ? `pass (${mat.warn})` : "pass",
          volumetric: `pass (${vol.volumetric_ratio}x)`,
          margin: `pass (AED ${econ.expected_margin_aed} >= ${CONFIG.MARGIN_GATE_AED})`,
          relevance: `matched ${rel.matched} tokens of "${kw}"`,
          market: market.pass === true ? `pass (${Math.round(market.undercut*100)}% under market)` : market.reason,
          shipping: `${cheapest.logisticName} $${freightUsd} ${cheapest.logisticAging || ""}`,
        },
        score: +score.toFixed(2),
        status: queueStatus,
        raw: { image: detail.productImage, sku: detail.productSku, listed: comp.listed_num, variants: (detail.variants || []).length },
      };

      if (!DRY) { const err = await upsertCandidate(row); if (err) console.log("   db:", err); }
      stats.passed++; acceptedInCat++; if (queueStatus === "needs_market_check") stats.needsMarketCheck++;
      console.log(`  + ${title.slice(0, 46).padEnd(46)} AED ${String(retail).padStart(4)} | margin ${String(econ.expected_margin_aed).padStart(6)} | vol ${vol.volumetric_ratio}x | listed ${comp.listed_num}${queueStatus === "needs_market_check" ? " | NEEDS MARKET CHECK" : ""}`);
    }
  }
}

console.log("\n=== SUMMARY ===");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)} ${v}`);
console.log(DRY ? "\nDRY RUN — nothing written" : `\n${stats.passed} candidates queued for review (status=pending_review)`);
console.log("Review:  node scripts/sourcing/review.mjs");
