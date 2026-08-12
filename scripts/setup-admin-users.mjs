#!/usr/bin/env node
/**
 * Turn on named admin logins, end to end (AD-02).
 *
 *   node scripts/setup-admin-users.mjs wanresionne@gmail.com smarts.businesses.solutions@gmail.com
 *
 * Prompts for each operator's password with typing hidden, hashes them here,
 * writes ADMIN_USERS to the server, recreates the container, and then PROVES it
 * works before it exits.
 *
 * WHAT HAPPENS TO YOUR PASSWORD. It is read from your terminal with echo off,
 * hashed in this process, and used exactly twice: once to build the scrypt hash
 * that goes to the server, and once — if you allow the final check — to POST a
 * login to your own shop over HTTPS, the same request your browser would make.
 * It is never written to a file, never logged, never printed, and never sent
 * anywhere except your own site. Only the hash leaves this machine, and a hash
 * cannot be turned back into the password.
 *
 * WHY A SCRIPT AT ALL. The manual version is: run the hash tool twice, paste
 * two long lines into a server file without mangling them, recreate the
 * container, then remember to check it actually worked. Every one of those
 * steps is a place to make a silent mistake that locks you out of your own
 * admin — and you would only find out next time you needed it.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash, createHmac, scryptSync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { escapeComposeEnvValue } from "./lib/compose-env.mjs";

const HOST = process.env.LG_SSH_HOST || "root@116.203.242.215";
const KEYFILE = process.env.LG_SSH_KEY || `${process.env.HOME || process.env.USERPROFILE}/.ssh/hetzner_ed25519`;
const SERVICE_DIR = "/data/coolify/services/lixqbqbkz39l0bnz9xv2227t";
const CONTAINER = "lebon-grace-lixqbqbkz39l0bnz9xv2227t";
const SITE = process.env.LG_SITE || "https://shop.lebon-grace.com";

const GENERATE = process.argv.includes("--generate");
const emails = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  .map((e) => e.trim().toLowerCase()).filter(Boolean);
if (!emails.length || emails.some((e) => !e.includes("@"))) {
  console.error("usage: node scripts/setup-admin-users.mjs <email> [<email> ...]");
  process.exit(1);
}

const ssh = (cmd) =>
  execFileSync("ssh", ["-i", KEYFILE, "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", HOST, cmd],
              { encoding: "utf8" });

/** Read a line with the terminal echo suppressed. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const muted = new Writable({ write(_c, _e, cb) { cb(); } });
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
    process.stdout.write(prompt);
    rl.question("", (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

// ── collect credentials ──────────────────────────────────────────────────────
const entries = [];
const plaintext = new Map(); // held in memory only, for the final proof
let STORE = null;                // set only in --generate mode

/**
 * --generate: strong random passwords instead of typed ones.
 *
 * Asked for "default passwords the operators will change after logging in".
 * There is no change-password feature — credentials are scrypt hashes in
 * ADMIN_USERS, and changing one means re-running this tool and recreating the
 * container. So a default password would not be a default; it would be the
 * permanent password, and a memorable one would be a permanent weak one.
 *
 * These are generated here, never displayed, and written to supabase.local,
 * which is where this project keeps credentials. That gives the same
 * convenience — nobody has to invent a password — without a password existing
 * in a chat transcript or a shell history.
 */
function strongPassword() {
  // 24 base64url chars ~ 144 bits. No ambiguous-character trimming: these are
  // pasted from a password store, never read aloud or retyped.
  return randomBytes(18).toString("base64url");
}

for (const email of emails) {
  let pw = "";
  if (GENERATE) {
    pw = strongPassword();
    console.log(`  generated a ${pw.length}-character password for ${email} (not shown)`);
  } else {
    for (;;) {
      pw = await askHidden(`Password for ${email} (hidden): `);
      if (pw.length < 12) { console.error("  too short — use at least 12 characters. This is the only lock on the shop's admin."); continue; }
      const again = await askHidden(`Repeat it: `);
      if (again !== pw) { console.error("  they do not match, try again"); continue; }
      break;
    }
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  entries.push(`${email}:${salt}$${hash}`);
  plaintext.set(email, pw);
}

const ADMIN_USERS = entries.join(",");
console.log(`\n  built ${entries.length} operator entr${entries.length === 1 ? "y" : "ies"} (${ADMIN_USERS.length} chars, not shown)`);

if (GENERATE) {
  // BEFORE the server is touched, deliberately.
  //
  // A generated password exists in exactly one place: this process's memory.
  // If it were saved after the container was recreated, a failing write — a bad
  // path, a locked file — would leave the server holding credentials that exist
  // nowhere at all. Saving first means the worst case is a saved password for a
  // server that was never configured, which is harmless and obvious.
  //
  // Written, not printed. supabase.local is this project's credential store and
  // is already where the staging database's secrets live.
  const { appendFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  // join(), not a template literal: `\Desktop` in a template literal is the
  // escape `\D`, which JS collapses to a bare `D`. The first version of this
  // built `C:\UsersuserDesktopaprojectssupabase.local` and would have created a
  // stray file in the home directory with the only copy of both passwords in it.
  STORE = process.env.LG_CRED_STORE
    || join(process.env.USERPROFILE || process.env.HOME, "Desktop", "aprojects", "supabase.local");
  const stamp = new Date().toISOString().slice(0, 10);
  const lines = [
    "",
    "#---- lebon-grace admin logins ----",
    `# Generated ${stamp} by scripts/setup-admin-users.mjs --generate`,
    "# These are the ONLY copy. They were not displayed anywhere.",
    "# There is no change-password screen: to change one, re-run that script",
    "# and let it recreate the container. Permanent until you do.",
    ...[...plaintext].map(([email, pw]) =>
      `ADMIN_LOGIN_${email.replace(/[^a-z0-9]/gi, "_").toUpperCase()}=${pw}`),
    "",
  ];
  appendFileSync(STORE, lines.join("\r\n")); // CRLF — the dominant convention in this file
  console.log(`\n  passwords appended to ${STORE}`);
  console.log("  that is the only copy — they were never printed here or sent anywhere but your own shop");
}

// ── write it to the server ───────────────────────────────────────────────────
//
// Into the compose's `.env`, not its `environment:` block: the block is
// Coolify-managed YAML and a bad edit there breaks the whole service, whereas
// `.env` is a flat file the compose already reads via `env_file:`.
//
// Delivered over stdin, never as an argument, so it cannot appear in `ps` or in
// the shell history of the remote host.
console.log("  writing ADMIN_USERS to the server");
const remote = `
set -e
cd ${SERVICE_DIR}
cp -n .env .env.before-admin-users 2>/dev/null || true
grep -v '^ADMIN_USERS=' .env > .env.tmp 2>/dev/null || true
cat >> .env.tmp
mv .env.tmp .env
chmod 600 .env
echo "written: $(grep -c . .env) lines, mode $(stat -c %a .env)"
`;
const wrote = execFileSync("ssh",
  ["-i", KEYFILE, "-o", "BatchMode=yes", HOST, remote],
  // ESCAPED. This `.env` sits beside a compose file, so `$` in a value is a
  // variable reference rather than a character — and the credential format is
  // `email:<salt>$<hash>`. Unescaped, Compose deletes the hash on the way to the
  // container. scripts/lib/compose-env.mjs has the incident.
  { input: `ADMIN_USERS=${escapeComposeEnvValue(ADMIN_USERS)}\n`, encoding: "utf8" });
console.log("  " + wrote.trim());

// ── recreate the container ───────────────────────────────────────────────────
console.log("  recreating the container (this app's service only)");
ssh(`cd ${SERVICE_DIR} && docker compose up -d --force-recreate --no-deps lebon-grace 2>&1 | tail -2`);

await new Promise((r) => setTimeout(r, 8000));
const status = ssh(`docker ps --filter name=${CONTAINER} --format '{{.Status}}'`).trim();
console.log(`  container: ${status}`);

// ── does the container hold what we meant to send? ───────────────────────────
//
// Compared as a hash, so no value is printed, and compared at all because the
// failure this catches is invisible from the file's side: the .env was correct
// and complete, the container's copy was 129 characters shorter, and the only
// symptom was one operator getting a 401 while the other signed in fine.
//
// Hashing the whole value rather than measuring its length also catches
// substitution and reordering, not just truncation.
const want = createHash("sha256").update(ADMIN_USERS).digest("hex");
const got = ssh(`docker exec ${CONTAINER} sh -c 'printf %s "$ADMIN_USERS"' | sha256sum`)
  .trim().split(/\s+/)[0];
console.log(`  container holds exactly what was written : ${want === got ? "yes" : "NO"}`);
if (want !== got) {
  const len = ssh(`docker exec ${CONTAINER} sh -c 'printf %s "$ADMIN_USERS"' | wc -c`).trim();
  console.error(`\n  The container's ADMIN_USERS is not what was written to the .env.`);
  console.error(`  Intended ${ADMIN_USERS.length} characters; the container has ${len.trim()}.`);
  console.error("  Something between the file and the process is rewriting the value.");
  console.error("  ADMIN_PASSWORD is still set, so you are not locked out.");
  process.exit(1);
}

// ── prove it ─────────────────────────────────────────────────────────────────
//
// "Configured" and "working" are different claims. Everything above could
// succeed while the login still fails — a mangled entry, a stale container, a
// typo in an address. The whole point of doing this in a script is to close
// that gap before you walk away.
async function get(path) {
  const res = await fetch(SITE + path, { redirect: "manual" });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

console.log("\n  verifying:");
const state = await get("/api/admin/login");
console.log(`    named logins active : ${state.body.namedLogins === true ? "yes" : "NO"}`);
if (state.body.namedLogins !== true) {
  console.error("\n  ADMIN_USERS did not reach the running container. The shared ADMIN_PASSWORD still works,");
  console.error("  so you are not locked out. Check /data/coolify/services/.../.env on the server.");
  process.exit(1);
}

// A wrong password must be refused — otherwise "it accepted my login" proves
// nothing at all.
const bad = await fetch(SITE + "/api/admin/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: emails[0], password: "definitely-not-the-password-" + randomBytes(4).toString("hex") }),
});
console.log(`    wrong password refused : ${bad.status === 401 ? "yes" : "NO (" + bad.status + ")"}`);

for (const email of emails) {
  const res = await fetch(SITE + "/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: plaintext.get(email) }),
  });
  const cookie = res.headers.get("set-cookie") || "";
  const ok = res.status === 200 && cookie.includes("lg_admin=");
  console.log(`    ${email} can sign in : ${ok ? "yes" : "NO (" + res.status + ")"}`);
  if (!ok) {
    console.error("\n  That operator cannot sign in. ADMIN_PASSWORD is still set, so you are not locked out.");
    process.exit(1);
  }
}

if (GENERATE) {
  // The block had to be saved before the server was touched, so a run that
  // fails afterwards leaves passwords in the store that nothing accepts. This
  // line is what separates the two: a block without it never worked, and can be
  // deleted without checking anything.
  const { appendFileSync } = await import("node:fs");
  appendFileSync(STORE, `# ^ verified working ${new Date().toISOString().slice(0, 10)}\r\n`);
}

console.log(`
  Named logins are on. Every /admin action is now recorded against whoever did it.

  ONE THING LEFT, and do it only now that you have signed in successfully at
  least once in a browser: remove ADMIN_PASSWORD from the same .env and
  recreate the container. Until you do, the old shared password still works —
  which is deliberate, it is your way back in if something here went wrong.
`);
