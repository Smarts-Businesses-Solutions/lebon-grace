import { test, expect } from "@playwright/test";

/**
 * HTTP status correctness.
 *
 * Asserted at the HTTP level rather than the DOM, deliberately. The page for a
 * non-existent product already SAYS "Product Not Found" — a DOM assertion
 * passes today and would have caught nothing. What is wrong is the status line
 * above it, so that is what these tests read.
 *
 * A "soft 404" (200 OK carrying not-found content) is not cosmetic:
 *   - crawlers index unlimited fake product URLs as real pages;
 *   - `npm run verify:deploy` and every synthetic monitor asserting `status <
 *     400` can never detect a broken product link;
 *   - analytics counts fake product views.
 *
 * Found 2026-08-09 walking production as an anonymous visitor.
 */

// Slugs that have never existed.
//
// These are CONSTANTS on purpose. The first draft built the title with
// `Date.now()` to defeat caching, and Playwright reported "Test not found in
// the worker process": it re-evaluates the spec file in each worker, so a
// title computed at module scope differs between the main process and the
// worker and the test can no longer be matched. Cache-busting belongs in the
// request, never in the test identity — see the `?_cb=` below.
const NEVER_EXISTED = [
  "/shop/definitely-not-a-real-product-zzq",
  "/shop/../../etc/passwd",
  "/shop/%20",
];

test.describe("@seo HTTP status correctness", () => {
  test("a real product still returns 200 (precondition)", async ({ page, baseURL }) => {
    // Without this, "the bogus slug 404s" could pass on a site that 404s
    // everything -- including a totally broken deployment.
    const res = await page.goto("/shop", { waitUntil: "load" });
    expect(res?.status(), `${baseURL}/shop must be reachable`).toBe(200);

    const firstProduct = await page
      .locator('a[href^="/shop/"]')
      .first()
      .getAttribute("href");
    expect(firstProduct, "the shop grid must list at least one product").toBeTruthy();

    const good = await page.goto(firstProduct!, { waitUntil: "load" });
    expect(good?.status(), `${firstProduct} is a real product and must be 200`).toBe(200);
    await expect(page.locator("h1")).not.toHaveText(/not found/i);
  });

  for (const path of NEVER_EXISTED) {
    test(`a product slug that does not exist returns 404, not a soft 404: ${path}`, async ({
      page,
    }) => {
      // Cache-buster in the request, not the title, so the test identity is
      // stable across workers while a cached 200 still cannot mask a failure.
      const url = path.includes("%") || path.includes("..")
        ? path
        : `${path}?_cb=${Date.now()}`;
      const res = await page.goto(url, { waitUntil: "load" });
      const status = res?.status();

      // The failure this catches: status 200 with not-found content in the body.
      const body = await page.locator("body").innerText();
      const saysNotFound = /not found/i.test(body);

      expect(
        status,
        `${path} returned ${status}. Body ${saysNotFound ? "DOES" : "does not"} say "not found" — ` +
          `a 200 carrying not-found content is a soft 404.`
      ).toBe(404);
    });
  }

  test("a withdrawn product is gone, not merely empty", async ({ page }) => {
    // phone-case-clearance was withdrawn pending a recount (A-16). Its URL was
    // live and may sit in search results or a customer's bookmarks, so the
    // status has to say something honest: 404, or 410 if we want it deindexed
    // faster. 200 tells a crawler the page is fine.
    const res = await page.goto("/shop/phone-case-clearance", { waitUntil: "load" });
    expect(
      [404, 410],
      `a withdrawn product returned ${res?.status()}; expected 404 or 410`
    ).toContain(res?.status());
  });
});
