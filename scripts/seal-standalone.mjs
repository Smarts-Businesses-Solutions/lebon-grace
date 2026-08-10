#!/usr/bin/env node
/**
 * Fail the build if the server cannot report its own errors. (B-31)
 *
 * ## What this is guarding against
 *
 * `instrumentation.ts` lived at the repo root while this app keeps its code in
 * `src/app`. Next silently ignored it — no warning at build, none at boot, no
 * error at runtime — so `register()` never ran and `Sentry.init` never
 * executed. Server-side error reporting had never worked, and nothing could
 * have told you: a reporter that is switched off produces exactly the same
 * output as one that is working and has nothing to report.
 *
 * ## What it does NOT do any more
 *
 * An earlier version of this script tried to *repair* the standalone output by
 * copying the Sentry chunk into it. That shipped, and crash-looped the
 * container on a missing external (`require-in-the-middle-…`), because Next
 * excludes the whole instrumentation subgraph including its node_modules
 * dependencies. Eleven minutes of downtime. **Do not copy build artefacts
 * around; fix the input instead.** The real cause was the file's location.
 *
 * ## Why a marker string is enough here
 *
 * `CaptureConsole` only exists in the compiled output if `sentry.server.config`
 * was reachable from the instrumentation hook, which only happens if Next
 * resolved the hook at all. It is a cheap proxy for "the chain is intact".
 *
 * It is NOT proof that events are delivered — that needs
 * `scripts/prove-sentry-init.mjs`, which counts envelopes arriving at a real
 * ingest from an isolated copy of the standalone output. Run that after any
 * change to the build, the bundler, this hook, or the Sentry config.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/standalone";
const MARKER = "CaptureConsole";

if (!existsSync(ROOT)) {
  console.log("[seal-standalone] no standalone output — nothing to check");
  process.exit(0);
}

/** Walk the standalone tree looking for the marker in any .js file. */
function hasMarker(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue; // a symlink into a pruned tree; not our concern
    }
    if (st.isDirectory()) {
      if (hasMarker(p)) return true;
    } else if (name.endsWith(".js")) {
      try {
        if (readFileSync(p, "utf8").includes(MARKER)) return true;
      } catch {
        /* unreadable file — keep looking */
      }
    }
  }
  return false;
}

if (hasMarker(ROOT)) {
  console.log("[seal-standalone] Sentry server init reached the standalone output");
  process.exit(0);
}

console.error(
  [
    `[seal-standalone] FAILED: "${MARKER}" is not in the standalone output.`,
    "  Sentry.init will not run, so the server will report NO errors — silently,",
    "  which is exactly how this went unnoticed for the life of the project (B-31).",
    "",
    "  Most likely cause: the instrumentation hook is not where Next looks.",
    "  This app uses src/app, so it must be src/instrumentation.ts — a root-level",
    "  instrumentation.ts is ignored without any warning.",
    "",
    "  Do NOT 'fix' this by copying chunks into .next/standalone. That was tried,",
    "  and it crash-loops the container on a missing external.",
  ].join("\n")
);
process.exit(1);
