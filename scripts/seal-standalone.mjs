#!/usr/bin/env node
/**
 * Put the instrumentation chunk back into the standalone output, and refuse to
 * ship a build that cannot report its own errors. (B-31)
 *
 * `output: "standalone"` copies only what Next's file tracing believes the
 * server entry reaches. Under Turbopack the instrumentation hook is a SEPARATE
 * entry and tracing does not follow it: of 40 `[root-of-the-server]` chunks,
 * 19 were copied, and the one holding `Sentry.init` — plus its `node:net` and
 * `node:inspector` externals — was not.
 *
 * The effect was total and silent. `instrumentation.ts` is correct,
 * `sentry.server.config.ts` is correct, both compile into `.next/server`, and
 * the container simply never received the file. No server error has ever
 * reached GlitchTip. Only the browser bundle reported, which is why GlitchTip
 * receiving *something* was never evidence that the server was reporting.
 *
 * `outputFileTracingIncludes` does NOT fix this — tried, and it changed
 * nothing, because Next excludes its own `.next` output from tracing input.
 * Copying after the build is what actually works.
 *
 * The guard at the end matters more than the copy. A missing chunk produces no
 * error, no warning and a perfectly healthy-looking server — so the only way
 * this stays fixed is for the BUILD to fail when the marker is absent, rather
 * than for someone to notice months later that no errors ever arrive.
 */
import { readdirSync, copyFileSync, existsSync, readFileSync, statSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";

const SRC = ".next/server/chunks";
const DST = ".next/standalone/.next/server/chunks";

/*
 * The entry point, not just the chunks.
 *
 * Copying `chunks/` alone fixed nothing — verified by running the standalone
 * server against a fake Sentry ingest: the chunk was present, the server logged
 * its error, and ZERO envelopes were sent. `.next/server/instrumentation.js` is
 * the file Next actually loads to call `register()`, and standalone was missing
 * it entirely, so the copied chunk sat there with nothing importing it.
 *
 * That is the whole lesson of this bug in miniature: the chunk being present
 * looked like a fix and was not one.
 */
const ENTRIES = ["instrumentation.js", "instrumentation"];

/** A string present in the compiled Sentry init and nowhere else. */
const MARKER = "CaptureConsole";

if (!existsSync(".next/standalone")) {
  console.log("[seal-standalone] no standalone output — nothing to do");
  process.exit(0);
}
if (!existsSync(SRC)) {
  console.error(`[seal-standalone] ${SRC} does not exist; did the build run?`);
  process.exit(1);
}

let copied = 0;

// The instrumentation entry Next loads to call register(). Source maps and
// .nft.json trace files are build metadata and deliberately left behind.
for (const entry of ENTRIES) {
  const from = join(".next/server", entry);
  const to = join(".next/standalone/.next/server", entry);
  if (!existsSync(from) || existsSync(to)) continue;
  if (statSync(from).isDirectory()) {
    cpSync(from, to, { recursive: true });
  } else {
    mkdirSync(join(".next/standalone/.next/server"), { recursive: true });
    copyFileSync(from, to);
  }
  copied++;
}

for (const name of readdirSync(SRC)) {
  // Source maps are deliberately excluded from standalone; only ship code.
  if (!name.endsWith(".js")) continue;
  const from = join(SRC, name);
  const to = join(DST, name);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied++;
}

// Prove the thing this script exists for is actually there now. Presence of a
// file is not the claim — presence of the initialiser is (L-24).
const present = readdirSync(DST)
  .filter((n) => n.endsWith(".js"))
  .some((n) => readFileSync(join(DST, n), "utf8").includes(MARKER));

// Both halves, because either alone is a false pass: the chunk without the
// entry point is dead code nothing imports (which is what the first version of
// this script produced), and the entry without the chunk cannot resolve it.
const entry = ".next/standalone/.next/server/instrumentation.js";
if (!existsSync(entry)) {
  console.error(
    `[seal-standalone] FAILED: ${entry} is missing.\n` +
      `  That is the file Next loads to call register(), so Sentry.init would never run\n` +
      `  no matter which chunks are present.`
  );
  process.exit(1);
}

if (!present) {
  console.error(
    `[seal-standalone] FAILED: "${MARKER}" is not in the standalone output.\n` +
      `  Sentry.init would not run, and the server would report no errors at all —\n` +
      `  silently, which is exactly how this went unnoticed before (B-31).\n` +
      `  Refusing to produce a build that cannot report its own failures.`
  );
  process.exit(1);
}

console.log(`[seal-standalone] copied ${copied} chunk(s); Sentry init present in standalone`);
