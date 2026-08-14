/**
 * Deploy lebon-grace on Coolify.
 *
 * There is NO deploy script for this app in ops/selfhost/scripts/ -- it is one
 * of the projects PROJECT-CONTEXT.md marks "via Coolify UI / git push". Note
 * that "git push" is misleading: PROJECT-CONTEXT.md item 9 says no project
 * deploys on push, deployment is always explicit. Hence this.
 *
 * Deliberately NOT modelled on the deploy-<app>.py scripts. Four of those ten
 * accept --patch and six silently ignore it and fall through to POST /services
 * with instant_deploy, creating a DUPLICATE service rather than updating the
 * existing one. This script only ever calls the deploy endpoint for a uuid that
 * already exists, so it has no path that can create anything.
 *
 * Usage:
 *   node ops/coolify-deploy.mjs --check    report the current state only
 *   node ops/coolify-deploy.mjs            trigger a deployment
 */
import fs from "node:fs";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const CHECK = process.argv.includes("--check");

// Append-only file: several keys repeat and the LAST assignment is the live
// one, which is what Object.fromEntries keeps.
const env = Object.fromEntries(
  fs.readFileSync(SECRETS, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const TOKEN = env.COOLIFY_CLOUD_API_TOKEN;
const UUID = env.COOLIFY_LEBON_GRACE_APP_UUID;
if (!TOKEN) throw new Error("COOLIFY_CLOUD_API_TOKEN missing from supabase.local");
if (!UUID) throw new Error("COOLIFY_LEBON_GRACE_APP_UUID missing from supabase.local");

const api = (p, init = {}) =>
  fetch(`https://app.coolify.io/api/v1${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json", ...init.headers },
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }));

const app = await api(`/applications/${UUID}`);
if (!app.ok) { console.error(`GET /applications/${UUID} -> ${app.status}`); process.exit(1); }

console.log(`${app.body.name}  branch ${app.body.git_branch}  status ${app.body.status}`);

/*
 * Guard: deploying a branch other than main would ship code nobody reviewed.
 * PROJECT-CONTEXT.md still claims this app tracks fix/email-sender-domain, so
 * the possibility is real enough to check rather than assume.
 */
if (app.body.git_branch !== "main") {
  console.error(`\nREFUSING: this app is set to deploy '${app.body.git_branch}', not main.`);
  console.error(`Change the branch in the Coolify UI first, or deploy knowingly by hand.`);
  process.exit(2);
}

if (CHECK) { console.log("\n--check, nothing triggered"); process.exit(0); }

const dep = await api(`/deploy?uuid=${UUID}`, { method: "POST" });
if (!dep.ok) { console.error(`deploy -> ${dep.status}`, JSON.stringify(dep.body).slice(0, 400)); process.exit(1); }

console.log(`\ntriggered: ${JSON.stringify(dep.body)}`);
