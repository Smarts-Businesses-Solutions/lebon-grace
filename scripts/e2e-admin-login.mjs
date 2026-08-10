#!/usr/bin/env node
/**
 * Run the /admin named-operator E2E against a throwaway server (AD-02).
 *
 * The default suite's server is started without ADMIN_USERS, because that is the
 * state the shop is actually in until the operators are configured. The named
 * login therefore cannot be exercised by it — the e-mail field is deliberately
 * not rendered.
 *
 * So this starts a SECOND standalone server on its own port with a throwaway
 * operator and a throwaway session secret, runs one spec against it, and stops
 * it. Nothing here reads, needs, or touches the real credentials, and nothing it
 * creates outlives the run.
 *
 *   node scripts/e2e-admin-login.mjs
 *
 * Requires a prior `npm run build`.
 *
 * DESKTOP PROJECT ONLY, and that is a finding rather than a convenience: the
 * login route allows 5 attempts per 15 minutes per IP, and every project runs
 * from 127.0.0.1. Running all three meant 12 logins from one address, so the
 * later ones were correctly throttled and the tests read as auth failures. The
 * rate limit was doing its job; the suite was the attacker. This spec tests the
 * credential wiring, which does not vary by viewport.
 */
import { spawn } from "node:child_process";
import { scryptSync, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const PORT = Number(process.env.QA_ADMIN_PORT || 3107);
const BASE = `http://127.0.0.1:${PORT}`;

// Must match tests/e2e/admin/login.spec.ts.
const EMAIL = "test.operator@example.com";
const PASSWORD = "throwaway-test-password-123";

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");

const env = {
  ...process.env,
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
  ADMIN_USERS: `${EMAIL}:${salt}$${hash}`,
  // Generated per run, so a session minted here is worthless anywhere else.
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  // Removed on purpose: with no shared password, a successful login PROVES the
  // named path worked rather than quietly falling through to the old one.
  ADMIN_PASSWORD: "",
};

const server = spawn(process.execPath, ["scripts/serve-standalone.mjs"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

/** Poll for readiness rather than sleeping — a fixed wait is a flake waiting to happen. */
async function waitForServer(deadlineMs = 90_000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${BASE}/api/admin/login`);
      if (res.ok) {
        const body = await res.json();
        if (body.namedLogins !== true) {
          throw new Error(
            `Server started but reports namedLogins=${body.namedLogins}. ` +
              "ADMIN_USERS did not reach it, so the spec would test nothing."
          );
        }
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Server started")) throw err;
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not become ready on ${BASE} within ${deadlineMs}ms`);
}

function stop() {
  if (!server.killed) server.kill();
}

try {
  await waitForServer();
  console.log(`\n  server ready on ${BASE}, named operators confirmed present\n`);

  /*
   * Node's own binary running Playwright's CLI entry point — NOT `npx`.
   *
   * Since CVE-2024-27980 (Node 18.20.2 / 20.12.2 / 21.7.3), spawning a .cmd or
   * .bat on Windows without `shell: true` fails with EINVAL, and `npx` on
   * Windows is `npx.cmd`. The usual fix is to pass `shell: true`, which is
   * exactly the flag that vulnerability was about — it re-opens argument
   * injection if any argument ever stops being a literal.
   *
   * Resolving the CLI and handing it to `process.execPath` sidesteps both: no
   * shell, no platform branch, and no .cmd wrapper to be blocked.
   */
  const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  const code = await new Promise((resolve) => {
    const pw = spawn(
      process.execPath,
      [cli, "test", "tests/e2e/admin/login.spec.ts", "--project=desktop", "--reporter=line"],
      { env: { ...process.env, QA_BASE_URL: BASE, CI: "1" }, stdio: "inherit" }
    );
    pw.on("close", resolve);
  });
  stop();
  process.exit(code ?? 1);
} catch (err) {
  console.error(err);
  stop();
  process.exit(1);
}
