/**
 * Does the STANDALONE server actually initialise Sentry and send an event?
 *
 * Presence of a chunk is not the claim (B-31, L-24). This stands up a fake
 * Sentry ingest, runs the real standalone server against it, provokes a
 * server-side console.error, and reports whether an envelope arrives.
 *
 * The first attempt at fixing B-31 copied the Sentry chunk into the standalone
 * output and looked correct by every static check — and this script still
 * reported ZERO envelopes, because `.next/server/instrumentation.js`, the file
 * Next loads to call register(), was also missing. Nothing imported the chunk.
 * Without a behavioural check that fix would have shipped.
 *
 * Run it after any change to the build, output mode, instrumentation hook or
 * Sentry config:
 *
 *   NEXT_PUBLIC_SENTRY_DSN="http://abc123@127.0.0.1:9999/1" npm run build
 *   node scripts/prove-sentry-init.mjs        # exit 0 = an event was sent
 *
 * The DSN must be set at BUILD time: NEXT_PUBLIC_* are inlined by Next, so
 * setting it only at runtime bakes `undefined` and proves nothing.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const INGEST_PORT = 9999;
const APP_PORT = 3101;

const envelopes = [];
const ingest = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    envelopes.push({ url: req.url, body });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"id":"fake"}');
  });
});
await new Promise((r) => ingest.listen(INGEST_PORT, "127.0.0.1", r));
console.log(`  fake Sentry ingest listening on ${INGEST_PORT}`);

/*
 * Run from an ISOLATED COPY, outside the project tree.
 *
 * This is the whole reason the previous B-31 fix reached production broken.
 * `node .next/standalone/server.js` executed inside the repo resolves missing
 * externals by walking UP into the project's full node_modules. The deployed
 * container has only the pruned standalone copy, so the proof passed on a build
 * that could not boot in the image (L-26).
 *
 * Copying standalone somewhere with no parent node_modules reproduces the
 * container's isolation, which is the condition that actually matters.
 */
const ISOLATED = mkdtempSync(join(tmpdir(), "lg-standalone-"));
cpSync(".next/standalone", ISOLATED, { recursive: true });
if (existsSync(".next/static")) {
  cpSync(".next/static", join(ISOLATED, ".next/static"), { recursive: true });
}
console.log(`  isolated copy at ${ISOLATED} (no parent node_modules)`);

const app = spawn(process.execPath, ["server.js"], {
  cwd: ISOLATED,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(APP_PORT),
    HOSTNAME: "127.0.0.1",
    // deliberately absent so the webhook route console.errors on the first POST
    STRIPE_WEBHOOK_SECRET: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let appOut = "";
app.stdout.on("data", (d) => (appOut += d));
app.stderr.on("data", (d) => (appOut += d));

// wait for ready, on a condition rather than a fixed sleep
const deadline = Date.now() + 45_000;
let up = false;
while (Date.now() < deadline) {
  try {
    await fetch(`http://127.0.0.1:${APP_PORT}/`, { signal: AbortSignal.timeout(2000) });
    up = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!up) {
  console.log("  SERVER NEVER CAME UP");
  console.log(appOut.slice(0, 1500));
  app.kill();
  process.exit(1);
}
console.log("  standalone server is up");

// PRECONDITION (L-2): prove the route we poke really does log an error, so a
// missing envelope means "Sentry did not send", not "nothing happened".
const res = await fetch(`http://127.0.0.1:${APP_PORT}/api/stripe-webhook`, {
  method: "POST",
  body: "{}",
});
console.log(`  POST /api/stripe-webhook -> ${res.status} (500 = it hit the console.error path)`);

await new Promise((r) => setTimeout(r, 4000)); // let the transport flush

const logged = /STRIPE_WEBHOOK_SECRET not configured/.test(appOut);
console.log(`  server logged the error:      ${logged}`);
console.log(`  envelopes received by ingest: ${envelopes.length}`);

/*
 * With SENTRY_DEBUG=1 the transport wrapper in sentry.server.config.ts prints
 * the ingest's own status code. Surfacing it here means this script reports the
 * same line an operator would read out of `docker logs` in production — so the
 * local proof and the production check are the same observation, not two
 * different ones that happen to agree.
 */
const transportLines = appOut.split(/\r?\n/).filter((l) => l.includes("[sentry-transport]"));
console.log(`  [sentry-transport] lines:     ${transportLines.length}${process.env.SENTRY_DEBUG === "1" ? "" : "  (set SENTRY_DEBUG=1 to enable)"}`);
transportLines.slice(0, 3).forEach((l) => console.log(`    ${l.trim().slice(0, 140)}`));
if (envelopes.length) {
  const b = envelopes[0].body;
  console.log(`  first envelope path:          ${envelopes[0].url}`);
  console.log(`  mentions the message:         ${/STRIPE_WEBHOOK_SECRET/.test(b)}`);
}

app.kill();
ingest.close();
process.exit(envelopes.length > 0 && logged ? 0 : 1);
