/**
 * Release-gate guards — MASTER-QA-PROTOCOL §3.
 *
 * These implement the parts of the protocol that ordinary assertions miss.
 * A page can render, return 200 and still be broken: a spinner that never
 * resolves, a console exception swallowed by an error boundary, a 404 on a
 * font. Each guard below turns one of those into a test failure.
 *
 *   import { attachGuards } from "../../../ops/qa/guards";
 *   test.beforeEach(async ({ page }, testInfo) => attachGuards(page, testInfo));
 */
/**
 * The Playwright API is INJECTED for the same reason as smoke-suite.ts: this
 * kit sits outside every project's node_modules, and importing @playwright/test
 * here would load a second copy ("Requiring @playwright/test second time").
 */
export type PwApi = { test: any; expect: any };
type Page = any;
type TestInfo = any;

/**
 * Structural types for the event payloads.
 *
 * `Page` is `any` on purpose (see above), which means the `page.on(...)`
 * callbacks get no contextual type and fail `noImplicitAny` — TS7006 — in any
 * project whose tsconfig reaches this file. That broke `next build` in
 * mirrortales, whose pre-push hook runs it.
 *
 * Annotating with `any` would silence it; describing only the members actually
 * used keeps real checking on `msg.text()`, `res.status()` and friends without
 * importing @playwright/test and reintroducing the double-load this file
 * exists to avoid. They are structurally compatible with Playwright's real
 * types, so a mismatch still surfaces at the call site.
 */
type ConsoleMessage = { type(): string; text(): string };
type PageError = { message: string };
type FailedRequest = {
  failure(): { errorText: string } | null;
  method(): string;
  url(): string;
};
type PageResponse = {
  status(): number;
  url(): string;
  request(): { method(): string };
};

/** §3 Spinner Rule: no busy state may persist beyond this. */
export const SPINNER_BUDGET_MS = 10_000;

/**
 * Console errors that are noise rather than defects. Kept deliberately small —
 * every entry here is a class of real bug the suite can no longer see, so it
 * must be justified, not convenient.
 */
const CONSOLE_IGNORE: RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

/**
 * Asset types whose 404s break the product visually but never throw.
 * The protocol calls these out explicitly (§3 "broken asset loads").
 */
const ASSET_RE = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js)(\?|$)/i;

export type GuardReport = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  brokenAssets: string[];
};

/**
 * Attach console/network/exception monitoring to a page.
 *
 * Returns the live report. Call `assertClean()` at the end of a test — the
 * guard deliberately does NOT throw on first error, because failing mid-flow
 * loses the rest of the evidence for the same page load.
 */
export function attachGuards(pw: PwApi, page: Page, testInfo?: TestInfo) {
  const { expect } = pw;
  const report: GuardReport = { consoleErrors: [], pageErrors: [], failedRequests: [], brokenAssets: [] };

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return;
    report.consoleErrors.push(`${text}  @ ${page.url()}`);
  });

  // Uncaught exceptions. These are the ones an error boundary hides from the
  // user *and* from a naive "does the page render" assertion.
  page.on("pageerror", (err: PageError) => {
    report.pageErrors.push(`${err.message}  @ ${page.url()}`);
  });

  page.on("requestfailed", (req: FailedRequest) => {
    const f = req.failure()?.errorText ?? "unknown";
    // Aborted requests are normal during navigation — the browser cancelling
    // in-flight work is not a defect.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(f)) return;
    report.failedRequests.push(`${req.method()} ${req.url()} — ${f}`);
  });

  page.on("response", (res: PageResponse) => {
    if (res.status() < 400) return;
    const url = res.url();
    if (ASSET_RE.test(url)) report.brokenAssets.push(`${res.status()} ${url}`);
    else report.failedRequests.push(`${res.status()} ${res.request().method()} ${url}`);
  });

  const assertClean = async (label = "page") => {
    const lines: string[] = [];
    if (report.pageErrors.length) lines.push(`uncaught exceptions:\n  ${report.pageErrors.join("\n  ")}`);
    if (report.consoleErrors.length) lines.push(`console errors:\n  ${report.consoleErrors.join("\n  ")}`);
    if (report.brokenAssets.length) lines.push(`broken assets:\n  ${report.brokenAssets.join("\n  ")}`);
    if (report.failedRequests.length) lines.push(`failed requests:\n  ${report.failedRequests.join("\n  ")}`);
    if (lines.length && testInfo) {
      await testInfo.attach(`guards-${label}.txt`, { body: lines.join("\n\n"), contentType: "text/plain" });
    }
    expect(lines.join("\n\n"), `guard violations on ${label}`).toBe("");
  };

  return { report, assertClean };
}

/**
 * §3 Spinner Rule. Fails if any busy indicator is still visible after the
 * budget.
 *
 * Matches on role/aria first and falls back to common class names, because
 * most of these apps have no data-testid instrumentation yet — an
 * aria-only matcher would silently pass on every one of them, which is worse
 * than a slightly loose selector.
 */
export async function assertNoStuckSpinner(page: Page, budgetMs = SPINNER_BUDGET_MS) {
  const spinner = page
    .locator(
      [
        '[data-testid*="spinner" i]',
        '[data-testid*="loading" i]',
        '[role="progressbar"]',
        '[aria-busy="true"]',
        '[class*="spinner" i]',
        '[class*="animate-spin" i]',
        '[class*="skeleton" i]',
      ].join(", "),
    )
    .first();

  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (!(await spinner.isVisible().catch(() => false))) return;
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Spinner Rule violated: a busy indicator was still visible after ${budgetMs}ms at ${page.url()}`,
  );
}

/**
 * Placeholder / mock-content detector — §1 DoD and the protocol's
 * "LLM-specific code issues" section. LLM-generated apps ship these into
 * production routinely and nothing else in a test suite catches them.
 */
const PLACEHOLDER_RE =
  /\b(lorem ipsum|coming soon|TBD|TODO:|placeholder|dummy data|mock data|FIXME|replace me|your text here)\b/i;

/**
 * `allow` exists because this detector cannot infer intent, and pretending
 * otherwise produces false positives that erode trust in the whole suite.
 *
 * Real example: church_content_os /pricing lists "SSO (coming soon)" — a
 * deliberate roadmap disclosure on a feature list, not an unfinished page. The
 * blunt regex flagged it as a defect.
 *
 * Weakening the pattern globally would have been the wrong fix: "Coming Soon"
 * as a page heading IS the defect the protocol targets. So intent is declared
 * per project instead. Every entry added here is an assertion that the copy is
 * intentional — it should be reviewed like any other exception, not used to
 * silence a failing test.
 */
export async function assertNoPlaceholders(pw: PwApi, page: Page, allow: (string | RegExp)[] = []) {
  const { expect } = pw;
  const body = (await page.locator("body").innerText().catch(() => "")) || "";

  const hits: string[] = [];
  for (const m of body.matchAll(new RegExp(PLACEHOLDER_RE.source, "gi"))) {
    // Compare against the surrounding phrase, not the bare keyword — "SSO
    // (coming soon)" is allowable while a "Coming soon" heading is not.
    const ctx = body.slice(Math.max(0, m.index! - 60), m.index! + m[0].length + 60);
    const allowed = allow.some((a) => (typeof a === "string" ? ctx.includes(a) : a.test(ctx)));
    if (!allowed) hits.push(m[0]);
  }

  expect(hits.join(", "), `placeholder content visible at ${page.url()}`).toBe("");
}
