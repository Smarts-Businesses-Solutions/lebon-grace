import { defineConfig } from "vitest/config";

/**
 * Vitest owns unit tests under src/. Playwright owns everything in tests/e2e.
 *
 * Without this, vitest collects tests/e2e/**.spec.ts and fails with
 * "Playwright Test did not expect test.describe() to be called here", which
 * looks like a broken test suite rather than two runners fighting over the same
 * files.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
});
