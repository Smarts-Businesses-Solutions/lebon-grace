import { test, expect } from "@playwright/test";

/**
 * The legal pages must name the entity that actually contracts with the buyer.
 *
 * The registered ADDRESS was already on five surfaces — footer, Terms, Privacy,
 * Contact and the e-mail footer — and Terms already set UAE law and Sharjah
 * jurisdiction. But the entity itself appeared nowhere: "L.L.C" occurred zero
 * times in the codebase or on the live site.
 *
 * So Terms bound the customer to an agreement with a BRAND rather than a legal
 * person, and Privacy never said who the data controller was.
 */
const ENTITY = "LEBON GRACE LLC";

test.describe("legal pages identify the entity", () => {
  for (const path of ["/terms", "/privacy"]) {
    test(`${path} names ${ENTITY}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();

      // PRECONDITION: the page rendered its own content, so a miss below means
      // the entity is genuinely absent rather than the page being empty.
      expect(body.length, "page did not render").toBeGreaterThan(400);
      expect(body).toContain(ENTITY);
    });
  }

  test("/privacy says who the data controller is", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toContain("controller");
  });

  test("the registered address still appears on both", async ({ page }) => {
    // It was already there; this stops a future tidy-up removing the address
    // while adding the name.
    for (const path of ["/terms", "/privacy"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(await page.locator("body").innerText()).toContain("Sharjah");
    }
  });
});
