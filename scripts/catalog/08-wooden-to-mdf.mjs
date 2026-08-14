/**
 * Replace "wooden" with "raw MDF" in the three peg-board descriptions.
 *
 * The products are natural raw MDF, and three descriptions called the pegs
 * wooden. Not false — MDF is engineered wood — but it sits directly beside
 * `material: "3mm MDF, sanded by hand"` on the same page, and the shop should
 * say one thing.
 *
 * WRITES TO POSTGRES, NOT TO products.generated.ts. That file is generated and
 * carries a DO-NOT-EDIT header; editing it would be silently reverted by the
 * next `node scripts/catalog/04-generate-catalog.mjs`.
 *
 * Dry by default. Pass --apply to write.
 *
 *   node scripts/catalog/08-wooden-to-mdf.mjs
 *   node scripts/catalog/08-wooden-to-mdf.mjs --apply
 *   node scripts/catalog/04-generate-catalog.mjs      # then regenerate
 */
import { existsSync, readFileSync } from "fs";

/**
 * Credentials come from supabase.local, falling back to .env.local.
 *
 * The sibling generator (04-generate-catalog.mjs) reads .env.local, which no
 * longer exists in this checkout — so it cannot run as written either. The
 * live credentials live in the shared secrets file as LG_SELFHOSTED_*, which is
 * where keys for this project are kept.
 */
const parse = (p) =>
  Object.fromEntries(
    readFileSync(p, "utf8").split(/\r?\n/)
      .filter((l) => /^[A-Za-z_]+=/.test(l) && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const env = { ...(existsSync(SECRETS) ? parse(SECRETS) : {}),
              ...(existsSync(".env.local") ? parse(".env.local") : {}) };

const SB = env.LG_SELFHOSTED_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.LG_SELFHOSTED_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) throw new Error("no Supabase URL/service-role key in supabase.local or .env.local");
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

const apply = process.argv.includes("--apply");

const SLUGS = ["first-animals-peg-board", "sea-creatures-peg-board", "shape-peg-board"];

/** "chunky wooden pegs" -> "chunky raw MDF pegs"; "a wooden peg" -> "a raw MDF peg". */
const fix = (s) => s.replace(/\bwooden\b/gi, "raw MDF");

const get = async (slug) => {
  const r = await fetch(`${SB}/rest/v1/products?slug=eq.${slug}&select=slug,description`, { headers: H });
  if (!r.ok) throw new Error(`GET ${slug}: HTTP ${r.status} ${await r.text()}`);
  const rows = await r.json();
  // PostgREST returns [] for a miss rather than an error — an empty array here
  // means the slug is wrong, not that the row has no description.
  if (!rows.length) throw new Error(`${slug}: no such product`);
  return rows[0];
};

let changed = 0;
for (const slug of SLUGS) {
  const row = await get(slug);
  const next = fix(row.description);

  if (next === row.description) {
    console.log(`${slug}: nothing to change`);
    continue;
  }

  const was = row.description.split("\n").find((l) => /wooden/i.test(l)) ?? "";
  const now = next.split("\n").find((l) => /raw MDF/i.test(l)) ?? "";
  console.log(`\n${slug}`);
  console.log(`  - ${was.trim()}`);
  console.log(`  + ${now.trim()}`);

  if (!apply) { changed++; continue; }

  const r = await fetch(`${SB}/rest/v1/products?slug=eq.${slug}`, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ description: next }),
  });
  if (!r.ok) throw new Error(`PATCH ${slug}: HTTP ${r.status} ${await r.text()}`);

  // Read back rather than trusting the write — the same habit that caught the
  // compose-file hash silently losing characters.
  const after = await get(slug);
  const ok = after.description === next && !/wooden/i.test(after.description);
  console.log(`  ${ok ? "written and verified" : "<-- READ-BACK MISMATCH"}`);
  if (!ok) process.exitCode = 1;
  changed++;
}

console.log(
  `\n${changed} product(s) ${apply ? "updated" : "would change"}.` +
  (apply ? "\nNow run: node scripts/catalog/04-generate-catalog.mjs" : "\nRe-run with --apply to write."),
);
