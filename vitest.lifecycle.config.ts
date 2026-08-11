import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The lifecycle suite, which needs a real database (TR-03).
 *
 * Deliberately a SEPARATE config rather than a folder added to the default one.
 * These tests write and delete rows, so they must never be picked up by an
 * ordinary `vitest run` or by CI's `npm test` — a destructive test that runs by
 * accident is the thing this whole task exists to prevent.
 *
 * The staging guard would refuse anyway (no marker, no run), so this is the
 * second of two independent barriers: the runner does not collect them, and
 * they refuse to execute without proof of a disposable database. Either alone
 * would probably do. Both, because the failure mode is writing to a live shop.
 *
 *   npm run test:lifecycle
 */
export default defineConfig({
  test: {
    include: ["tests/lifecycle/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // A real database over an SSH tunnel is slower than a mock, and a timeout
    // failure here would read as a product bug.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Rows are shared state; parallel files would race on cleanup.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
