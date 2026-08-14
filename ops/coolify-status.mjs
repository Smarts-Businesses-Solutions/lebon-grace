/**
 * Which Coolify application serves shop.lebon-grace.com, and what is it set to
 * deploy?
 *
 * READ ONLY. Nothing here triggers a deployment.
 *
 * Two reasons this exists rather than a hard-coded uuid:
 *
 *   1. supabase.local records a COOLIFY_*_UUID for eleven other projects but
 *      none for lebon-grace, so the uuid has to be discovered.
 *   2. ops/selfhost/PROJECT-CONTEXT.md says this app's branch is
 *      `fix/email-sender-domain`. If that is still what Coolify watches, then
 *      merging to main changes nothing and a deploy would ship other code.
 *      That has to be checked against the live control plane, not a doc.
 *
 * Usage:  node ops/coolify-status.mjs
 */
import fs from "node:fs";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";

/*
 * supabase.local is APPEND-ONLY and several keys appear more than once, where
 * an early occurrence can be a dead value. Object.fromEntries keeps the last
 * assignment, which is the one that wins. Do not switch this to a find-first.
 */
const env = Object.fromEntries(
  fs.readFileSync(SECRETS, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const TOKEN = env.COOLIFY_CLOUD_API_TOKEN;
if (!TOKEN) throw new Error("COOLIFY_CLOUD_API_TOKEN missing from supabase.local");

const api = (p) =>
  fetch(`https://app.coolify.io/api/v1${p}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }));

const apps = await api("/applications");
if (!apps.ok) {
  console.error(`GET /applications -> ${apps.status}`, JSON.stringify(apps.body).slice(0, 300));
  process.exit(1);
}

const list = Array.isArray(apps.body) ? apps.body : apps.body?.data ?? [];
console.log(`${list.length} application(s) on the control plane\n`);

const matches = list.filter((a) =>
  [a.name, a.fqdn, a.git_repository, a.description].some((v) => String(v ?? "").toLowerCase().includes("lebon")),
);

if (!matches.length) {
  console.log("no application mentions 'lebon'. All names and fqdns:");
  for (const a of list) console.log(`  ${String(a.name).padEnd(34)} ${a.fqdn ?? ""}`);
  process.exit(2);
}

for (const a of matches) {
  console.log(`name            ${a.name}`);
  console.log(`uuid            ${a.uuid}`);
  console.log(`fqdn            ${a.fqdn}`);
  console.log(`repo            ${a.git_repository}`);
  console.log(`BRANCH          ${a.git_branch}`);
  console.log(`commit          ${a.git_commit_sha ?? "(head)"}`);
  console.log(`status          ${a.status}`);
  console.log(`auto deploy     ${a.settings?.is_auto_deploy_enabled ?? "?"}`);
  console.log(`build pack      ${a.build_pack}`);
  console.log();
}
