/**
 * Product intelligence — velocity report.
 *
 *   node scripts/intel/report.mjs            # fastest movers
 *   node scripts/intel/report.mjs --days 14
 *
 * Reads the append-only snapshots and ranks products by observed sell-through.
 *
 * Method: for each consecutive pair of snapshots, a FALL in stock is treated as
 * units sold. A RISE is a restock and is counted separately — it is never
 * allowed to offset real sales, otherwise a supplier restocking 500 units would
 * make a fast seller look dead.
 *
 * Restocks are themselves a signal: a supplier who repeatedly replenishes is
 * telling you the product moves.
 */
import { env } from "../sourcing/lib.mjs";

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
const args = process.argv.slice(2);
const DAYS = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 30;

const since = new Date(Date.now() - DAYS * 86400e3).toISOString();
const rows = await (await fetch(
  `${SB}/rest/v1/product_intel_snapshots?select=cj_pid,captured_at,inventory&captured_at=gte.${since}&order=cj_pid,captured_at&limit=100000`,
  { headers: H }
)).json();

if (!Array.isArray(rows) || rows.length === 0) {
  console.log("no snapshots yet — run: node scripts/intel/snapshot.mjs --seed");
  process.exit(0);
}

const names = Object.fromEntries(
  (await (await fetch(`${SB}/rest/v1/product_intel_watchlist?select=cj_pid,product_name&limit=2000`, { headers: H })).json())
    .map((w) => [w.cj_pid, w.product_name])
);

const byPid = new Map();
for (const r of rows) {
  if (!byPid.has(r.cj_pid)) byPid.set(r.cj_pid, []);
  byPid.get(r.cj_pid).push(r);
}

const stats = [];
for (const [pid, snaps] of byPid) {
  if (snaps.length < 2) continue;
  let sold = 0, restocked = 0, restockEvents = 0;
  for (let i = 1; i < snaps.length; i++) {
    const delta = (snaps[i - 1].inventory ?? 0) - (snaps[i].inventory ?? 0);
    if (delta > 0) sold += delta;
    else if (delta < 0) { restocked += -delta; restockEvents++; }
  }
  const spanDays =
    (new Date(snaps[snaps.length - 1].captured_at) - new Date(snaps[0].captured_at)) / 86400e3;
  if (spanDays <= 0) continue;
  stats.push({
    pid,
    name: names[pid] || pid,
    perDay: sold / spanDays,
    sold,
    restockEvents,
    spanDays,
    latest: snaps[snaps.length - 1].inventory,
    readings: snaps.length,
  });
}

if (!stats.length) {
  console.log(`only one reading so far — velocity needs at least two.`);
  console.log(`snapshots exist for ${byPid.size} products; run again tomorrow.`);
  process.exit(0);
}

stats.sort((a, b) => b.perDay - a.perDay);
console.log(`VELOCITY — ${stats.length} products with >=2 readings over ${DAYS}d\n`);
console.log("UNITS/DAY  SOLD  RESTOCKS  STOCK  PRODUCT");
for (const s of stats.slice(0, 25)) {
  console.log(
    String(s.perDay.toFixed(1)).padStart(9),
    String(s.sold).padStart(5),
    String(s.restockEvents).padStart(9),
    String(s.latest).padStart(6),
    " " + String(s.name).slice(0, 44)
  );
}
const dead = stats.filter((s) => s.sold === 0).length;
console.log(`\n${dead}/${stats.length} showed no movement in this window.`);
console.log(`Median observation span: ${stats[Math.floor(stats.length / 2)].spanDays.toFixed(1)} days.`);
