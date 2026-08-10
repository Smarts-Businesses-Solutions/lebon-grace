#!/usr/bin/env node
/**
 * Report — do NOT fix — the standalone output's missing Sentry init. (B-31)
 *
 * ## This script used to copy. Copying took the shop down.
 *
 * `output: "standalone"` does not ship `.next/server/instrumentation.js` or the
 * chunk holding `Sentry.init`, so server-side error reporting has never run in
 * the container. The obvious repair — copy them in after the build — was tried,
 * shipped, and crashed the server at boot:
 *
 *   Failed to prepare server Error: An error occurred while loading
 *   instrumentation hook: Cannot find module
 *   'require-in-the-middle-2ca7b9c2766f317e'
 *
 * Next does not merely *forget* the instrumentation chunk. It excludes the whole
 * instrumentation subgraph, **including its node_modules externals**, and those
 * externals are not in the pruned standalone `node_modules`. So the copied chunk
 * loads, requires something that was never shipped, and takes the process with
 * it. A silent gap became an outage.
 *
 * It passed a local runtime proof first, which is the part worth remembering:
 * `node .next/standalone/server.js` run from the project root resolves the
 * missing module by walking up into the FULL `node_modules`. The container has
 * only the pruned copy. The proof ran in an environment that does not exist in
 * production (L-26).
 *
 * So this script now only reports. Fixing B-31 properly means getting Next to
 * trace the instrumentation subgraph — not hand-copying pieces of it.
 */
import { existsSync } from "node:fs";

if (!existsSync(".next/standalone")) {
  console.log("[seal-standalone] no standalone output — nothing to do");
  process.exit(0);
}

const entry = ".next/standalone/.next/server/instrumentation.js";
if (existsSync(entry)) {
  console.log("[seal-standalone] instrumentation entry present in standalone");
} else {
  // A warning, not a failure. The build is CORRECT and deployable without it —
  // it simply has no server-side error reporting, which is B-31 and is tracked.
  // Failing here would block every deploy on an unsolved upstream issue.
  console.warn(
    [
      "[seal-standalone] NOTE: .next/server/instrumentation.js is absent from the",
      "  standalone output, so Sentry.init will not run and server-side errors will",
      "  not reach GlitchTip. This is B-31, still open. Do NOT 'fix' it by copying",
      "  the chunk in — that crashes the server at boot on a missing external.",
    ].join("\n")
  );
}
