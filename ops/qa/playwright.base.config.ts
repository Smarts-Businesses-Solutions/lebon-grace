/**
 * Shared Playwright base config — MASTER-QA-PROTOCOL §3 "Reliability Defaults".
 *
 * IMPORTANT: this module imports NOTHING from @playwright/test at runtime.
 *
 * The kit lives outside every project, so if it required @playwright/test the
 * module would resolve from ops/qa upward while the project resolved from its
 * own node_modules — two copies, and Playwright aborts at config load with
 * "Requiring @playwright/test second time". The consumer therefore passes its
 * own `devices` in. Types are erased at compile time so `import type` is safe.
 *
 *   // <project>/playwright.config.ts
 *   import { defineConfig, devices } from "@playwright/test";
 *   import { makeBaseConfig } from "../ops/qa/playwright.base.config";
 *
 *   export default defineConfig({
 *     ...makeBaseConfig(devices),
 *     testDir: "./tests/e2e",
 *   });
 *
 * BROWSER CHANNEL: Chrome by default, Edge on request.
 *
 * MASTER-QA-PROTOCOL §0 mandates Edge exclusively. That mandate is SUPERSEDED by
 * the operator rule in aprojects/CLAUDE.md, which says so explicitly:
 *
 *   "Use Playwright's launch(channel="chrome") ... (fall back to msedge only if
 *    Chrome isn't installed). (Supersedes the earlier 'use Edge only' rule,
 *    which was mitigating the wrong risk and created an ambiguous mandate.)"
 *
 * The risk Edge-only was reaching for was disturbing the operator's open
 * browser. Browser BRAND was never what controlled that. `launch()` always
 * starts a new process with a throwaway profile, so an already-running Chrome is
 * untouched. The operations that genuinely attach to a live profile are
 * `connect_over_cdp()` and `launch_persistent_context(user_data_dir=<real
 * profile>)` — neither is used here, and neither should be. That is the actual
 * guardrail; the channel name is not.
 *
 * Consequence worth knowing either way: a `channel` uses the *installed* browser
 * binary, not a Playwright-managed one, so a CI image must have it present —
 * otherwise every run fails at launch rather than at assertion, which reads as a
 * suite-wide outage rather than a test failure. `npx playwright install chrome`
 * covers it. Set QA_BROWSER_CHANNEL=msedge on a host where Chrome is absent.
 */
/**
 * The Playwright config type is described structurally rather than imported.
 *
 * `import type { PlaywrightTestConfig } from "@playwright/test"` is erased at
 * runtime, so it causes no double-load — but it still has to RESOLVE at compile
 * time, and this kit deliberately sits outside every project's node_modules
 * (see guards.ts). The result was a build that passed in projects which happen
 * to have Playwright installed and failed in those that do not:
 *
 *   ../ops/qa/playwright.base.config.ts:27:43
 *   Type error: Cannot find module '@playwright/test'
 *
 * which broke `next build` in vouchnexus. Describing only the fields this
 * factory actually sets keeps the return value checked without the dependency.
 * `projects` and `reporter` stay loose because their shapes are Playwright's to
 * define and pinning them here would be a second source of truth.
 */
// These three are LITERAL UNIONS, not `string`, and that is load-bearing.
// When @playwright/test is absent the difference is invisible, but as soon as a
// project does have it installed the result of this factory gets passed to
// defineConfig() and checked against Playwright's real types — where
// `screenshot: string` is not assignable to ScreenshotMode and the build fails
// with a wall of "no overload matches this call". Widening any of these back to
// `string` reintroduces that, and only in the projects that have Playwright.
type TraceMode =
  | 'off'
  | 'on'
  | 'retain-on-failure'
  | 'on-first-retry'
  | 'on-all-retries'
  | 'retain-on-first-failure';
type ScreenshotMode = 'off' | 'on' | 'only-on-failure' | 'on-first-failure';
type VideoMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';

type PlaywrightTestConfig = {
  timeout?: number;
  expect?: { timeout?: number };
  fullyParallel?: boolean;
  forbidOnly?: boolean;
  retries?: number;
  workers?: number;
  // `unknown` is wrong here even though it reads as the safer choice: the
  // returned object is spread into defineConfig(), and unknown[] is not
  // assignable to Playwright's Project[]. These two shapes are Playwright's to
  // define — describing them here would be a second source of truth that drifts
  // — so they are deliberately opaque and assignable in both directions.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  reporter?: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above
  projects?: any[];
  use?: {
    baseURL?: string;
    actionTimeout?: number;
    navigationTimeout?: number;
    trace?: TraceMode;
    screenshot?: ScreenshotMode;
    video?: VideoMode;
    ignoreHTTPSErrors?: boolean;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

const isCI = !!process.env.CI;

/**
 * Chrome unless told otherwise. Override with QA_BROWSER_CHANNEL=msedge on a
 * host without Chrome — the fallback the operator rule allows for.
 *
 * Only chrome/msedge are accepted. An unrecognised value would reach Playwright
 * and fail at browser launch, which surfaces as every test erroring at once
 * rather than as a config mistake, so it is rejected here where the message can
 * name the actual problem.
 */
const CHANNEL = (() => {
  const c = process.env.QA_BROWSER_CHANNEL?.trim() || "chrome";
  if (c !== "chrome" && c !== "msedge") {
    throw new Error(
      `QA_BROWSER_CHANNEL must be "chrome" or "msedge", got "${c}". ` +
        `Leave it unset for Chrome (the default per aprojects/CLAUDE.md).`,
    );
  }
  return c;
})();

/** Desktop descriptor has to match the channel, or the UA contradicts the engine. */
const DESKTOP_DEVICE = CHANNEL === "msedge" ? "Desktop Edge" : "Desktop Chrome";

/** `devices` is injected by the consumer — see the note above. */
export function makeBaseConfig(devices: Record<string, any>): PlaywrightTestConfig {
  return {
    // §3 strict timeouts. Deliberately tight: the point is to catch hangs, and
    // a generous timeout turns a hang into a slow pass.
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
      actionTimeout: 10_000,
      navigationTimeout: 30_000,

      // §3 artifacts. on-first-retry rather than always — traces are large and
      // a green run does not need one.
      trace: "on-first-retry",
      screenshot: "only-on-failure",
      video: "retain-on-failure",

      baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3000",
      ignoreHTTPSErrors: false,
    },

    // §3: 2 retries on CI, 0 locally. Local retries hide flakes from the person
    // best placed to fix them.
    retries: isCI ? 2 : 0,
    workers: isCI ? 2 : undefined,
    fullyParallel: true,

    // A stray .only silently narrows CI to one test while still reporting green.
    forbidOnly: isCI,

    reporter: isCI
      ? [["github"], ["html", { open: "never" }], ["json", { outputFile: "playwright-report/results.json" }]]
      : [["list"], ["html", { open: "never" }]],

    // §2.3 three viewports, one channel. See the channel note in the header:
    // Chrome by default per the operator rule that supersedes §0's Edge-only.
    projects: [
      {
        name: "desktop",
        use: { ...devices[DESKTOP_DEVICE], channel: CHANNEL, viewport: { width: 1920, height: 1080 } },
      },
      {
        name: "mobile-ios",
        // iPhone descriptors default to WebKit. We want the viewport, UA and
        // touch emulation but NOT the engine, so defaultBrowserType forces it
        // back to Chromium — which is what a `channel` of chrome/msedge needs.
        use: { ...devices["iPhone 14 Pro"], channel: CHANNEL, defaultBrowserType: "chromium" },
      },
      {
        name: "mobile-android",
        use: { ...devices["Pixel 7"], channel: CHANNEL, defaultBrowserType: "chromium" },
      },
    ],
  };
}
