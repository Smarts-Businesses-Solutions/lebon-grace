/**
 * Give lebon-grace its own R2 bucket for launch media.
 *
 * WHY NOT THE EXISTING BUCKET: R2_BUCKET in supabase.local points at
 * `mirrortales-trailers`, which belongs to another project AND is the same
 * bucket holding the `restic-cx53` backup repo (supabase.local:1417). Dropping
 * 226 MB of regenerable launch video in there mixes three unrelated concerns
 * into one blast radius: a bucket-wide lifecycle rule, a quota, or a purge
 * aimed at any one of them would hit the other two.
 *
 * WHAT THIS DOES
 *   1. finds a Cloudflare API token in supabase.local that actually works
 *   2. creates the bucket if it is missing (idempotent, safe to re-run)
 *   3. enables the managed r2.dev public domain, because Post for Me fetches
 *      media over plain HTTPS with no credentials
 *   4. prints the exact lines to add to supabase.local
 *
 * It never prints secrets and never edits supabase.local itself.
 *
 * Usage:
 *   node scripts/social/r2-provision.mjs --check    report only, change nothing
 *   node scripts/social/r2-provision.mjs
 */
import fs from "node:fs";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const BUCKET = "lebon-grace-media";
const CHECK = process.argv.includes("--check");

const env = Object.fromEntries(
  fs.readFileSync(SECRETS, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const ACCOUNT = env.R2_ACCOUNT_ID;
if (!ACCOUNT) throw new Error("R2_ACCOUNT_ID missing from supabase.local");

const api = (token, path, init = {}) =>
  fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  }).then((r) => r.json());

/**
 * Several Cloudflare tokens are stored and it is not documented which carries
 * R2 rights. Probe them against the endpoint this actually needs: a token can
 * verify as live and still be denied R2, so the bucket list is the real test.
 */
/*
 * Named explicitly, and the casing matters. An earlier version of the sibling
 * diagnostic anchored /^CLOUDFLARE/ and silently skipped
 * `Cloudflare_Agent_Token-2026-07-29`, then reported that every token in the
 * file was dead. Anything added here must be typed exactly as it appears.
 */
const CANDIDATES = [
  "CLOUDFLARE_R2_ADMIN_TOKEN",
  "CLOUDFLARE_R2_Account_Token",
  "Cloudflare_Agent_Token-2026-07-29",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_WORKERS_API_TOKEN",
  "CLOUDFLARE_API_TOKEN_FROM_PLAINTEXT_20260811",
  "CLOUDFLARE_WORKERS_API_TOKEN_FROM_PLAINTEXT_20260811",
];

let token = null;
let buckets = null;

for (const name of CANDIDATES) {
  if (!env[name]) { console.log(`${name.padEnd(46)} absent`); continue; }
  const r = await api(env[name], `/accounts/${ACCOUNT}/r2/buckets`);
  if (r.success) {
    console.log(`${name.padEnd(46)} R2 OK`);
    token ??= env[name];
    buckets ??= r.result.buckets.map((b) => b.name);
  } else {
    console.log(`${name.padEnd(46)} ${r.errors?.[0]?.message || "denied"}`);
  }
}

if (!token) {
  console.error(
    "\nNo stored Cloudflare token can list R2 buckets.\n" +
    "Create one at dash.cloudflare.com > Manage Account > API Tokens with\n" +
    "  Account > Workers R2 Storage > Edit\n" +
    "then add it to supabase.local as CLOUDFLARE_R2_ADMIN_TOKEN and re-run.",
  );
  process.exit(2);
}

console.log(`\nexisting buckets: ${buckets.join(", ") || "(none)"}`);

if (buckets.includes(BUCKET)) {
  console.log(`${BUCKET} already exists`);
} else if (CHECK) {
  console.log(`${BUCKET} MISSING (--check, not creating)`);
} else {
  // eeur: the shop and its buyers are in the UAE, and Eastern Europe is the
  // closest R2 hint to that. It only biases placement; the bucket is reachable
  // from everywhere either way.
  const made = await api(token, `/accounts/${ACCOUNT}/r2/buckets`, {
    method: "POST",
    body: JSON.stringify({ name: BUCKET, locationHint: "eeur" }),
  });
  if (!made.success) { console.error("create failed:", JSON.stringify(made.errors)); process.exit(1); }
  console.log(`${BUCKET} created`);
}

// The managed r2.dev domain. Without it the bucket answers 401 to anonymous
// GETs, which is exactly what Post for Me will issue.
const domainPath = `/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/domains/managed`;
let dom = await api(token, domainPath);

if (dom.success && dom.result?.enabled) {
  console.log(`public domain already on: https://${dom.result.domain}`);
} else if (CHECK) {
  console.log("public domain NOT enabled (--check, not enabling)");
  process.exit(0);
} else {
  const on = await api(token, domainPath, { method: "PUT", body: JSON.stringify({ enabled: true }) });
  if (!on.success) { console.error("enable failed:", JSON.stringify(on.errors)); process.exit(1); }
  dom = await api(token, domainPath);
  if (!dom.success || !dom.result?.enabled) { console.error("enable reported ok but domain is still off"); process.exit(1); }
  console.log(`public domain enabled: https://${dom.result.domain}`);
}

if (!CHECK) {
  console.log(
    "\nAdd to supabase.local (the launch flywheel reads these, not the shared R2_* pair):\n" +
    `LEBON_GRACE_R2_BUCKET=${BUCKET}\n` +
    `LEBON_GRACE_R2_PUBLIC_BASE=https://${dom.result.domain}`,
  );
}
