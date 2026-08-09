#!/usr/bin/env node
/**
 * Serve the standalone build — the same artifact production runs.
 *
 * `next start` prints:
 *   ⚠ "next start" does not work with "output: standalone" configuration.
 *     Use "node .next/standalone/server.js" instead.
 *
 * It happens to serve anyway today, but building a release gate on something
 * Next explicitly says does not work is a slow-motion flake. More usefully,
 * `.next/standalone/server.js` IS what the container runs (Dockerfile:55-59), so
 * testing it means the E2E suite exercises the production artifact rather than a
 * near-neighbour of it.
 *
 * The one wrinkle is that `next build` does not copy static assets into the
 * standalone directory — the Dockerfile does that as a separate step. Without
 * it every page loads with no CSS and no images, which the QA guards correctly
 * report as broken assets. So this copies them first, exactly as the Dockerfile
 * does, then hands over.
 *
 *   node scripts/serve-standalone.mjs        # PORT / HOSTNAME respected
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "No .next/standalone — run `npm run build` first.\n" +
      "(next.config.ts sets output: \"standalone\", so this directory is the build.)"
  );
  process.exit(1);
}

// Mirrors Dockerfile:54-56.
for (const [from, to] of [
  [join(root, "public"), join(standalone, "public")],
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
]) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

process.env.PORT ||= "3105";
process.env.HOSTNAME ||= "127.0.0.1";

// The standalone server reads PORT/HOSTNAME and starts listening on import.
// pathToFileURL, not a bare path: on Windows the ESM loader rejects "C:\..."
// with ERR_UNSUPPORTED_ESM_URL_SCHEME because it reads the drive letter as a
// protocol. Harmless on Linux, required here.
await import(pathToFileURL(join(standalone, "server.js")).href);
