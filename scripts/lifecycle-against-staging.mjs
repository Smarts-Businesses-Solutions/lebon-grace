#!/usr/bin/env node
/**
 * Run the order-lifecycle suite against the staging database (TR-03).
 *
 *   npm run test:lifecycle:staging
 *
 * Opens an SSH tunnel to cx53's staging kong, fetches the service key from the
 * server, runs the suite, and closes the tunnel. One command, because a test
 * that needs three manual steps first is a test that stops being run — which is
 * how P-006 stayed manual for so long.
 *
 * The key is read into a variable and passed as an environment variable to the
 * child process. It is never printed, never written to disk here, and never
 * placed on a command line where `ps` could see it.
 */
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HOST = process.env.STAGING_SSH_HOST || "root@116.203.242.215";
const KEYFILE = process.env.STAGING_SSH_KEY || `${process.env.HOME || process.env.USERPROFILE}/.ssh/hetzner_ed25519`;
const REMOTE_PORT = 8114;

/**
 * A local port nobody else is on.
 *
 * The first version pinned 8114 locally too. A leftover tunnel from an earlier
 * run already held it, so ssh failed with "Address already in use" — and the
 * readiness probe then succeeded anyway, because something WAS answering on
 * 8114. It reported "tunnel is up" about a tunnel it had not opened.
 *
 * That is the failure mode worth engineering out, not just the collision: a
 * check that cannot tell your own connection from a stranger's is not a check.
 * Binding an ephemeral port makes the probe unambiguous — if anything answers
 * there, it is ours — and lets runs happen concurrently.
 */
async function freePort() {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
const PORT = await freePort();

/**
 * Run one command on cx53.
 *
 * The remote command is a SINGLE string. ssh joins its argv with spaces and the
 * remote shell re-splits the result, so passing an awk program as separate
 * arguments shreds it — the first attempt died with "unexpected newline or end
 * of string" from awk, which reads like a broken script rather than broken
 * quoting.
 */
const ssh = (remoteCommand) =>
  execFileSync("ssh", ["-i", KEYFILE, "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", HOST, remoteCommand],
               { encoding: "utf8" });

console.log(`  opening a tunnel: localhost:${PORT} -> ${HOST}:${REMOTE_PORT}`);
const tunnel = spawn("ssh", [
  "-i", KEYFILE, "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes",
  "-N", "-L", `${PORT}:127.0.0.1:${REMOTE_PORT}`, HOST,
], { stdio: ["ignore", "ignore", "inherit"] });

const stop = () => { if (!tunnel.killed) tunnel.kill(); };
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });

try {
  // Wait for the tunnel to actually carry traffic. 401 is the CORRECT answer
  // from kong to an unauthenticated request — it proves the whole path works.
  // Waiting for 200 would mean waiting for a request we are not making yet.
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/rest/v1/`);
      ready = res.status === 401 || res.ok;
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!ready) throw new Error(`tunnel localhost:${PORT} -> ${HOST}:${REMOTE_PORT} never carried traffic`);
  console.log("  tunnel is up");

  const key = ssh(
    "awk -F= '/^SERVICE_ROLE_KEY=/{print $2}' /root/lg-staging/ops/staging/.env.staging"
  ).trim();
  if (!key) throw new Error("no SERVICE_ROLE_KEY on the server — has ops/staging/setup.sh been run?");

  const cli = createRequire(import.meta.url).resolve("vitest/vitest.mjs");
  const code = await new Promise((resolve) => {
    const v = spawn(process.execPath, [cli, "run", "--config", "vitest.lifecycle.config.ts"], {
      stdio: "inherit",
      env: {
        ...process.env,
        STAGING_SUPABASE_URL: `http://127.0.0.1:${PORT}`,
        STAGING_SUPABASE_SERVICE_KEY: key,
      },
    });
    v.on("close", resolve);
  });
  stop();
  process.exit(code ?? 1);
} catch (err) {
  console.error(err.message || err);
  stop();
  process.exit(1);
}
