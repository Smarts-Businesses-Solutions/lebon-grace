/**
 * Why do all the Cloudflare tokens read as invalid?
 *
 * Three candidate causes, and they need different fixes:
 *   1. the key appears more than once and Object.fromEntries keeps the LAST,
 *      which may be an older or blanked copy
 *   2. the value is empty, quoted, or has trailing whitespace the parser kept
 *   3. the token is genuinely revoked or scoped away from R2
 *
 * This reports the shape of every CLOUDFLARE_* line and tests each occurrence
 * INDIVIDUALLY, so a duplicate cannot mask a working one.
 *
 * Prints lengths and the last four characters only. Never the token.
 */
import fs from "node:fs";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const raw = fs.readFileSync(SECRETS, "utf8").split(/\r?\n/);

/** Every occurrence, with its line number, not collapsed into a map. */
const hits = [];
raw.forEach((line, i) => {
  if (line.trimStart().startsWith("#")) return;
  const eq = line.indexOf("=");
  if (eq < 0) return;
  const key = line.slice(0, eq).trim();
  // Case-INSENSITIVE, and anywhere in the name. An earlier version anchored
  // /^CLOUDFLARE/ and silently skipped `Cloudflare_Agent_Token-2026-07-29`,
  // then reported that every token was dead. Keys in this file are named by
  // hand and their casing is not a convention worth trusting.
  if (!/cloudflare|r2[_-]?admin/i.test(key)) return;
  hits.push({ line: i + 1, key, rawValue: line.slice(eq + 1) });
});

console.log(`${hits.length} CLOUDFLARE_* line(s)\n`);

const seen = new Map();
for (const h of hits) seen.set(h.key, (seen.get(h.key) || 0) + 1);

for (const h of hits) {
  const v = h.rawValue;
  const trimmed = v.trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  const notes = [];
  if (seen.get(h.key) > 1) notes.push(`DUPLICATE x${seen.get(h.key)}`);
  if (!trimmed) notes.push("EMPTY");
  if (v !== trimmed) notes.push("whitespace-padded");
  if (trimmed !== unquoted) notes.push("quoted");
  console.log(
    `${String(h.line).padStart(5)}  ${h.key.padEnd(48)} len=${String(unquoted.length).padStart(3)}` +
    `${unquoted ? `  ...${unquoted.slice(-4)}` : "        "}  ${notes.join(", ")}`,
  );
}

// ── test each occurrence against the two endpoints that matter ──────────────
const ACCOUNT = raw.find((l) => l.startsWith("R2_ACCOUNT_ID="))?.split("=")[1]?.trim();
console.log(`\ntesting each occurrence against account ${ACCOUNT?.slice(0, 6)}...\n`);

for (const h of hits) {
  const tok = h.rawValue.trim().replace(/^["']|["']$/g, "");
  if (!tok) { console.log(`${String(h.line).padStart(5)}  ${h.key.padEnd(48)} skipped, empty`); continue; }

  const hdr = { Authorization: `Bearer ${tok}` };
  const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: hdr })
    .then((r) => r.json()).catch((e) => ({ errors: [{ message: e.message }] }));
  const r2 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets`, { headers: hdr })
    .then((r) => r.json()).catch((e) => ({ errors: [{ message: e.message }] }));

  console.log(
    `${String(h.line).padStart(5)}  ${h.key.padEnd(48)} ` +
    `verify=${verify.success ? verify.result.status : (verify.errors?.[0]?.message || "fail")}  ` +
    `r2=${r2.success ? "OK" : (r2.errors?.[0]?.message || "fail")}`,
  );
}
