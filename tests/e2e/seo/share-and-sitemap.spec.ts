import { test, expect } from "@playwright/test";

/**
 * What a shared link looks like, and what the sitemap must never contain.
 *
 * Both are invisible from inside the app: a wrong og:title breaks nothing on
 * screen, and a leaked sitemap entry only shows up when Google indexes
 * something it should not have seen. Neither is caught by a unit test, because
 * the failure is in the rendered document.
 */

const LISTED = "abc-jigsaw-board";
const UNLISTED = "internal-test-item";

async function metaContent(page: import("@playwright/test").Page, property: string) {
  const el = page.locator(`meta[property="${property}"]`).first();
  return (await el.count()) ? el.getAttribute("content") : null;
}

test.describe("a shared product link renders a card", () => {
  test("carries its own title, description and image", async ({ page }) => {
    await page.goto(`/shop/${LISTED}`, { waitUntil: "domcontentloaded" });

    const [title, desc, image] = await Promise.all([
      metaContent(page, "og:title"),
      metaContent(page, "og:description"),
      metaContent(page, "og:image"),
    ]);

    expect(title, "no og:title — WhatsApp shows a bare URL").toBeTruthy();
    expect(desc).toBeTruthy();
    expect(image, "no og:image — the card has no picture").toBeTruthy();
    expect(image!).toMatch(/^https?:\/\//);

    // The actual regression: every product used to inherit the site-wide title.
    expect(title!.toLowerCase()).not.toBe("lebon grace — wooden puzzles, made to order in the uae");
  });

  test("two different products do not share a title", async ({ page }) => {
    await page.goto(`/shop/${LISTED}`, { waitUntil: "domcontentloaded" });
    const first = await page.title();

    const other = page.locator('a[href^="/shop/"]').first();
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await other.waitFor({ state: "visible" });
    const href = await other.getAttribute("href");
    await page.goto(href!, { waitUntil: "domcontentloaded" });

    // Skip only if the listing happened to hand back the same product.
    test.skip(href === `/shop/${LISTED}`, "listing returned the same product");
    expect(await page.title()).not.toBe(first);
  });

  test("declares a canonical URL pointing at itself", async ({ page }) => {
    await page.goto(`/shop/${LISTED}`, { waitUntil: "domcontentloaded" });
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute("href");
    expect(canonical).toContain(`/shop/${LISTED}`);
  });

  test("publishes Product JSON-LD with a price", async ({ page }) => {
    await page.goto(`/shop/${LISTED}`, { waitUntil: "domcontentloaded" });
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(raw, "no JSON-LD block").toBeTruthy();

    const data = JSON.parse(raw!);
    expect(data["@type"]).toBe("Product");
    expect(data.offers?.priceCurrency).toBe("AED");
    expect(Number(data.offers?.price)).toBeGreaterThan(0);
  });
});

test.describe("unlisted products stay out of discovery", () => {
  test("the sitemap lists real products but not the unlisted one", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();

    // PRECONDITION: without this, "absent" would also pass on an empty sitemap.
    expect(xml, "sitemap has no real products — the check would be vacuous")
      .toContain(`/shop/${LISTED}`);
    expect(xml, "an unlisted product leaked into the sitemap")
      .not.toContain(UNLISTED);
  });

  test("the unlisted product asks not to be indexed", async ({ page }) => {
    const res = await page.goto(`/shop/${UNLISTED}`, { waitUntil: "domcontentloaded" });
    // It must still be reachable — invisible is not the same as unsellable.
    expect(res?.status()).toBe(200);

    const robots = await page.locator('meta[name="robots"]').first().getAttribute("content");
    expect(robots, "unlisted product is indexable").toContain("noindex");
  });

  test("robots.txt exists and points at the sitemap", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt.toLowerCase()).toContain("sitemap");
  });
});
