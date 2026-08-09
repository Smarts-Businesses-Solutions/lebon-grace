/**
 * Shared public-route smoke suite — MASTER-QA-PROTOCOL §1 (DoD) and §6.
 *
 * The Playwright API is INJECTED, not imported. The kit lives outside every
 * project's node_modules, so importing @playwright/test here loads a second
 * copy and Playwright aborts with "Requiring @playwright/test second time".
 * Passing it in keeps exactly one copy — the project's own.
 *
 *   // tests/e2e/navigation/smoke.spec.ts
 *   import { test, expect } from "@playwright/test";
 *   import { registerSmokeSuite } from "../../../../ops/qa/smoke-suite";
 *   import sitemap from "../../fixtures/sitemap.json";
 *
 *   registerSmokeSuite({ test, expect }, sitemap.routes);
 *
 * Requires NO data-testid instrumentation and NO seeded users — which is the
 * point. It applies to all eleven apps today, where every other protocol module
 * is blocked on per-project fixtures.
 *
 * WHAT FAILS, AND WHAT DELIBERATELY DOES NOT:
 *
 *   FAIL  5xx                      the server broke
 *   FAIL  spinner past 10s         §3 Spinner Rule
 *   FAIL  uncaught page exception  error boundaries hide these from users
 *   FAIL  placeholder / mock text  §1 DoD, the LLM-specific failure class
 *   FAIL  broken asset 404         css/js/font/image
 *
 *   PASS  redirect to login/gate   an authenticated route refusing an anonymous
 *                                  visitor is the system WORKING
 *   PASS  4xx on an unlisted route not reachable, out of scope here
 *
 * That auth distinction is load-bearing: without it every protected route in
 * these apps fails, the run goes red, and the signal is worthless.
 */
import { attachGuards, assertNoStuckSpinner, assertNoPlaceholders, type PwApi } from "./guards";

const AUTH_LANDING_RE =
  /\/(login|signin|sign-in|signup|sign-up|gate|auth|unauthorized|403)(\/|$|\?)/i;

export type SmokeOptions = {
  /** Routes to skip entirely — destructive, or known-external. */
  skip?: (string | RegExp)[];
  /** Cap route count (useful to split @smoke from @regression). */
  limit?: number;
  /**
   * Phrases containing a placeholder keyword that are INTENTIONAL product copy.
   * Matched against ~60 chars of surrounding context, so "SSO (coming soon)" can
   * be allowed without allowing a bare "Coming soon" heading.
   */
  allowPlaceholders?: (string | RegExp)[];
};

const matches = (route: string, pats?: (string | RegExp)[]) =>
  !!pats?.some((p) => (typeof p === "string" ? route === p : p.test(route)));

export function registerSmokeSuite(pw: PwApi, routes: string[], opts: SmokeOptions = {}) {
  const { test, expect } = pw;
  const targets = routes
    .filter((r) => !matches(r, opts.skip))
    .slice(0, opts.limit ?? routes.length);

  test.describe("@smoke public route health", () => {
    for (const route of targets) {
      test(`${route} renders without defects`, async ({ page }: any, testInfo: any) => {
        const { assertClean } = attachGuards(pw, page, testInfo);

        const res = await page.goto(route, { waitUntil: "domcontentloaded" });

        const status = res?.status() ?? 0;
        expect(status, `${route} returned ${status}`).toBeLessThan(500);

        const landed = new URL(page.url()).pathname;
        const isAuthRefusal = AUTH_LANDING_RE.test(landed) && landed !== route;

        // The Spinner Rule applies everywhere — including the login page, which
        // is exactly where a stuck auth check would surface.
        await assertNoStuckSpinner(page);

        if (isAuthRefusal) {
          // Correct refusal. Assert the refusal page is sound, but not its
          // content — that would be asserting on the login page, not on the
          // route under test.
          await assertClean(`${route} (auth refusal -> ${landed})`);
          return;
        }

        await assertNoPlaceholders(pw, page, opts.allowPlaceholders);
        await assertClean(route);
      });
    }
  });
}

/**
 * Deeper pass: follows in-page links one hop, catching routes the filesystem
 * crawl cannot see (runtime-generated hrefs). Registered separately so it can
 * be tagged @regression and kept out of the release gate.
 */
export function registerLinkIntegritySuite(pw: PwApi, entryRoutes: string[]) {
  const { test, expect } = pw;
  test.describe("@regression link integrity", () => {
    for (const route of entryRoutes) {
      test(`${route} has no dead internal links`, async ({ page }: any) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        const hrefs: string[] = await page.$$eval("a[href^='/']", (as: any[]) =>
          Array.from(new Set(as.map((a) => a.getAttribute("href")))),
        );

        const dead: string[] = [];
        for (const href of hrefs.slice(0, 40)) {
          // HEAD first (cheap), then GET — Next route handlers frequently do
          // not implement HEAD and answer 405, which is not a dead link.
          let r = await page.request.head(href).catch(() => null);
          if (!r || r.status() === 405) r = await page.request.get(href).catch(() => null);
          if (r && r.status() >= 500) dead.push(`${r.status()} ${href}`);
        }
        expect(dead.join("\n"), `dead internal links on ${route}`).toBe("");
      });
    }
  });
}
