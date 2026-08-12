#!/usr/bin/env node
/**
 * Generate an ADMIN_USERS entry for one operator (AD-02).
 *
 * Run this yourself. The password is read from the terminal, hashed here, and
 * never written to a file, sent anywhere, or echoed — only the resulting entry
 * is printed, and that entry cannot be reversed into the password.
 *
 *   node scripts/admin-password-hash.mjs you@example.com
 *
 * Paste the printed line into ADMIN_USERS (comma-separated for several people),
 * in BOTH /root/build/buildenv.txt and the Coolify compose env, then recreate
 * the container. It is a runtime variable, so no rebuild is needed.
 *
 * scrypt with N=16384 — memory-hard, so a leaked env cannot be brute-forced the
 * way a bare SHA could. ~100ms per verify, which is unnoticeable at login and
 * expensive at scale.
 */
import { createInterface } from "node:readline";
import { scryptSync, randomBytes } from "node:crypto";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("usage: node scripts/admin-password-hash.mjs <email>");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

// Suppress echo so the password is not left on screen or in scrollback.
const wasRaw = process.stdin.isTTY;
if (wasRaw) process.stdin.setRawMode?.(false);
process.stdout.write(`Password for ${email} (typing is hidden): `);

const muted = new (await import("node:stream")).Writable({
  write(_chunk, _enc, cb) { cb(); },
});
rl.output = muted;

rl.question("", (password) => {
  rl.close();
  process.stdout.write("\n");

  if (!password || password.length < 12) {
    console.error("Refusing: use at least 12 characters. This is the only lock on the shop's admin.");
    process.exit(1);
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");

  console.log("\nAdd this to ADMIN_USERS (comma-separate multiple operators):\n");
  console.log(`${email}:${salt}$${hash}`);
  console.log("\nThe password itself was not stored or transmitted by this script.");

  // The `$` between salt and hash is a variable reference to Docker Compose, and
  // a hash beginning with a letter gets silently deleted on its way into the
  // container. It cost a debugging session on 2026-08-12: the .env was correct,
  // the container's copy was 129 characters shorter, and the only symptom was a
  // 401 for one operator and a clean login for the other.
  //
  // Intermittent, too — a hash starting with a digit is not a valid variable
  // name and survives untouched, which is roughly five times in eight.
  console.log("\nIf you are pasting into a docker-compose .env, use THIS form instead —");
  console.log("doubling the $ is how Compose spells a literal one:\n");
  console.log(`${email}:${salt}$$${hash}`);
  console.log("\nOr skip the paste entirely: scripts/setup-admin-users.mjs handles the");
  console.log("escaping, and checks afterwards that the container really got the value.");
});
