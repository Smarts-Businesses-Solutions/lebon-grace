/**
 * Read and set environment variables on the lebon-grace Coolify application.
 *
 * Needed because src/lib/contact.ts no longer defaults the phone number: the
 * repo is public, so the literal has been removed from source and the value now
 * has to reach production some other way. There is no .env.local in this folder,
 * so Coolify's application environment IS the production configuration.
 *
 * Default is read-only. --set applies the pairs in PAIRS and nothing else, and
 * it PATCHes an existing key rather than posting a second one, because Coolify
 * will happily hold two entries with the same key and which one wins is not
 * something to leave to chance.
 *
 * Usage:
 *   node ops/coolify-env.mjs              list keys (values shown masked)
 *   node ops/coolify-env.mjs --set        apply the pairs below
 */
import fs from "node:fs";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const SET = process.argv.includes("--set");

const env = Object.fromEntries(
  fs.readFileSync(SECRETS, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const TOKEN = env.COOLIFY_CLOUD_API_TOKEN;
const UUID = env.COOLIFY_LEBON_GRACE_APP_UUID;
if (!TOKEN || !UUID) throw new Error("COOLIFY_CLOUD_API_TOKEN or COOLIFY_LEBON_GRACE_APP_UUID missing");

/** Sourced from supabase.local so the number appears in exactly one place. */
const PAIRS = [
  ["CONTACT_WHATSAPP", env.CONTACT_WHATSAPP],
  ["CONTACT_PHONE_DISPLAY", env.CONTACT_PHONE_DISPLAY],
];

const missing = PAIRS.filter(([, v]) => !v).map(([k]) => k);
if (missing.length) throw new Error(`not in supabase.local: ${missing.join(", ")}`);

const api = (p, init = {}) =>
  fetch(`https://app.coolify.io/api/v1${p}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }));

const listed = await api(`/applications/${UUID}/envs`);
if (!listed.ok) { console.error(`GET envs -> ${listed.status}`, JSON.stringify(listed.body).slice(0, 300)); process.exit(1); }

const existing = Array.isArray(listed.body) ? listed.body : listed.body?.data ?? [];
console.log(`${existing.length} env var(s) on the application\n`);

/*
 * TWO ENTRIES PER KEY IS NORMAL, NOT A DUPLICATE.
 *
 * Coolify keeps a production row (is_preview false) and a preview row
 * (is_preview true) for every variable. An earlier version of this script
 * counted them and refused to touch anything, which would have left production
 * on the old number.
 *
 * AND THE LIST ENDPOINT DOES NOT RETURN `value`. Not masked, absent. So this
 * cannot report or compare the current value, and must not pretend to: it
 * writes, then verifies against the running site instead. See the note at the
 * bottom of this file.
 */
for (const [k] of PAIRS) {
  const hits = existing.filter((e) => e.key === k);
  const prod = hits.filter((e) => !e.is_preview).length;
  const prev = hits.filter((e) => e.is_preview).length;
  console.log(`${k.padEnd(24)} production:${prod}  preview:${prev}  (values not returned by the API)`);
}

if (!SET) { console.log("\nread-only, pass --set to apply"); process.exit(0); }

console.log();
for (const [key, value] of PAIRS) {
  // Both scopes, so a preview deploy does not quietly serve the retired number.
  for (const is_preview of [false, true]) {
    const scope = is_preview ? "preview" : "production";
    const exists = existing.some((e) => e.key === key && !!e.is_preview === is_preview);

    const r = exists
      ? await api(`/applications/${UUID}/envs`, {
          method: "PATCH",
          body: JSON.stringify({ key, value, is_preview }),
        })
      : await api(`/applications/${UUID}/envs`, {
          method: "POST",
          body: JSON.stringify({ key, value, is_preview, is_build_time: false }),
        });

    console.log(
      `${key.padEnd(24)} ${scope.padEnd(11)} ${exists ? "PATCH" : "POST "} ` +
      `${r.ok ? "ok" : `FAILED ${r.status} ${JSON.stringify(r.body).slice(0, 180)}`}`,
    );
  }
}

/*
 * No read-back here on purpose.
 *
 * The only endpoint available does not return values, so a read-back could
 * confirm nothing beyond "a row exists", which was already true when the row
 * held the old number. The honest verification is to redeploy and read
 * /api/contact/reveal on the live site, which is what actually serves the
 * number to a customer.
 */
console.log(
  `\nWritten, but NOT verified: the API does not return values.\n` +
  `Verify for real after the next deploy:\n` +
  `  curl -s https://shop.lebon-grace.com/api/contact/reveal`,
);
