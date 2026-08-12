import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

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
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
  resolve: {
    /**
     * `@/*` -> `src/*`, mirroring tsconfig paths.
     *
     * This was missing, and the gap was invisible because the route tests
     * `vi.mock()` every `@/lib/*` import they touch — a mock is registered
     * before resolution, so the alias was never exercised. Adding one genuine
     * unmocked import to a route under test then failed with "Cannot find
     * package '@/lib/email-address'", which reads like a missing file rather
     * than missing configuration.
     *
     * Mocks still take precedence where they are declared; this only decides
     * what happens for imports nobody mocked, which previously was "crash".
     */
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
