import { defineConfig, devices } from "@playwright/test";
// Vendored at ops/qa/, not "../ops/qa/". The shared kit is designed to live
// outside every project, which also means a clone of this repo alone cannot run
// its own E2E suite: CI died with "Cannot find module
// '../ops/qa/playwright.base.config'" the first time it got this far. The copy
// is kept honest by src/lib/qa-kit-drift.test.ts.
import { makeBaseConfig } from "./ops/qa/playwright.base.config";

const base = makeBaseConfig(devices);

/**
 * Browser channel.
 *
 * The shared kit pins `channel: "msedge"` on all three projects and calls it
 * non-negotiable. That cannot hold in CI: a channel names the *installed*
 * browser, and the Forgejo runner's container has no Edge, so every test would
 * fail at launch — reading as a suite-wide outage rather than a test failure.
 * The kit's own header warns about exactly this.
 *
 * `CLAUDE.md` also supersedes the Edge-only rule (Learned Corrections: prefer
 * Chrome, fall back to msedge only if Chrome is absent), noting it "was
 * mitigating the wrong risk" — the real hazard was `connect_over_cdp()` and
 * `launch_persistent_context()` against a real profile, neither of which is
 * used here.
 *
 * So: default to Playwright's BUNDLED Chromium, which is downloaded by
 * `playwright install` and therefore always present. Set QA_BROWSER_CHANNEL to
 * `msedge` or `chrome` to test against an installed browser instead.
 */
const channel = process.env.QA_BROWSER_CHANNEL || undefined;

const PORT = Number(process.env.QA_PORT ?? 3105);
const baseURL = process.env.QA_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  ...base,
  testDir: "./tests/e2e",
  use: {
    ...base.use,
    baseURL,
  },
  // `channel: undefined` is meaningful, not a no-op: devices["Desktop Edge"]
  // carries `channel: "msedge"` of its own, so it has to be overridden rather
  // than simply left unset.
  projects: base.projects?.map((p: { use?: Record<string, unknown> }) => ({
    ...p,
    use: { ...p.use, channel },
  })),
  /**
   * Start the app for the run unless one is already up.
   *
   * Playwright owns the lifecycle so the server is guaranteed ready before the
   * first navigation — backgrounding it in the workflow and sleeping is the
   * version of this that fails intermittently at 3am. Requires a prior
   * `npm run build`.
   *
   * Serves the STANDALONE build, which is the artifact the container runs, and
   * which Next requires instead of `next start` under output: "standalone".
   *
   * Skipped entirely when QA_BASE_URL points somewhere else, which is how the
   * same suite runs against a deployed environment.
   */
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command: `node scripts/serve-standalone.mjs`,
        env: { PORT: String(PORT), HOSTNAME: "127.0.0.1" },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
