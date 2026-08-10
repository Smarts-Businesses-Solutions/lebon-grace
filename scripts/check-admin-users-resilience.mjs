#!/usr/bin/env node
/**
 * Can a mistyped ADMIN_USERS take the shop down, or lock the operator out?
 *
 *   node scripts/check-admin-users-resilience.mjs     (needs a prior build)
 *
 * Run this after changing anything in the login path. It exists because the
 * operator hand-pastes ADMIN_USERS into two places, and the blast radius of a
 * stray character is the whole shop.
 *
 * Two different questions, and the second is the one that bites. A value that is
 * malformed ENOUGH degrades to "no named operators" and the shared password
 * carries on. A value that is well-formed but WRONG — a hash with a character
 * dropped during a copy-paste — looks configured, and the named login simply
 * never matches. That is the case where the fallback has to save you.
 */
import { spawn } from "node:child_process";

const CASES = [
  // [label, ADMIN_USERS, expected namedLogins]
  ["missing the $ separator",   "a@example.com:deadbeefnodollar",               false],
  ["missing the colon",         "a@example.comdeadbeef$cafe",                   false],
  ["only whitespace",           "   ",                                          false],
  ["no email, just a hash",     ":aa$bb",                                       false],
  ["shell-ish junk",            "a@example.com:$(rm -rf /)$`whoami`",           false],
  // These three ARE well-formed entries — extra commas and long values do not
  // make them malformed. namedLogins=true is the correct answer, and the hash
  // being wrong is what the fallback exists for.
  ["trailing comma",            "a@example.com:aa$bb,",                         true],
  ["empty entry in the middle", "a@example.com:aa$bb,,b@example.com:cc$dd",     true],
  ["long but valid-shaped",     "a@example.com:" + "f".repeat(500) + "$" + "e".repeat(500), true],
];

let port = 3321, failures = 0;

for (const [label, value, expectNamed] of CASES) {
  const p = port++;
  const server = spawn(process.execPath, ["scripts/serve-standalone.mjs"], {
    env: { ...process.env, PORT: String(p), HOSTNAME: "127.0.0.1",
           ADMIN_USERS: value, ADMIN_SESSION_SECRET: "test-secret", ADMIN_PASSWORD: "fallback-password" },
    stdio: ["ignore", "ignore", "ignore"],
  });

  let res = null;
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    try {
      const shop = await fetch(`http://127.0.0.1:${p}/`);
      const login = await fetch(`http://127.0.0.1:${p}/api/admin/login`);
      const state = await login.json();

      // THE question: can a human still get in with the shared password?
      const post = await fetch(`http://127.0.0.1:${p}/api/admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "fallback-password" }),
      });
      // And a wrong one still must not work — otherwise "can log in" is meaningless.
      const bad = await fetch(`http://127.0.0.1:${p}/api/admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "not-the-password" }),
      });

      res = { shopUp: shop.ok, named: state.namedLogins, canGetIn: post.status === 200, wrongRejected: bad.status === 401 };
      break;
    } catch { await new Promise((r) => setTimeout(r, 400)); }
  }
  server.kill();

  const pass = res && res.shopUp && res.named === expectNamed && res.canGetIn && res.wrongRejected;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${label.padEnd(28)} ${res ? `shop=${res.shopUp?"up":"DOWN"} named=${res.named} fallbackWorks=${res.canGetIn} wrongRejected=${res.wrongRejected}` : "server never answered"}`);
}

console.log(failures === 0
  ? "\nNo value of ADMIN_USERS takes the shop down or locks the operator out.\nThe shared password remains the way back in — which is exactly why it stayed."
  : `\n${failures} case(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
