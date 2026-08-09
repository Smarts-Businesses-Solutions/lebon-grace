import { test, expect, type Page } from "@playwright/test";

/**
 * Tap-target size for STANDALONE controls, on mobile viewports.
 *
 * The project's own floor, stated in DESIGN.md, is 44x44 (WCAG 2.5.5). B-9
 * fixed the cart quantity controls to meet it; this pins the two places that
 * were never checked:
 *
 *   - the header controls, which appear on every page: search, cart, menu
 *   - "Add to cart" on the shop grid, which is a money-path control
 *
 * Measured on production 2026-08-09 at 390px: search 36x36, cart 36x36,
 * toggle 40x40, grid Add-to-cart 95x36.
 *
 * Scope note. A naive sweep of every a/button on the homepage returns ~53
 * "violations", and reporting that number would be wrong: WCAG 2.5.5 exempts
 * targets inline in a sentence, and most of those are body links or product
 * titles inside a card whose whole surface is clickable. This spec therefore
 * asserts on named, standalone controls only — the ones a thumb actually has
 * to find.
 */

const MIN = 44;

async function box(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await expect(el, `${selector} should exist`).toHaveCount(1);
  const b = await el.boundingBox();
  expect(b, `${selector} should be laid out`).not.toBeNull();
  return b!;
}

test.describe("@mobile standalone tap targets meet the 44x44 floor", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "mobile viewports only");
  });

  test("header controls are thumb-sized", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    // Named individually so a failure says WHICH control is too small.
    for (const [label, selector] of [
      ["cart", 'header a[aria-label*="cart" i]'],
      ["menu toggle", 'header button[aria-label*="menu" i]'],
    ] as const) {
      const b = await box(page, selector);
      expect(
        Math.min(b.width, b.height),
        `header ${label} is ${Math.round(b.width)}x${Math.round(b.height)}, below the ${MIN}x${MIN} floor in DESIGN.md`
      ).toBeGreaterThanOrEqual(MIN);
    }
  });

  test("Add to cart on the shop grid is thumb-sized", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "load" });
    const addBtn = page.getByRole("button", { name: /add to cart/i }).first();
    await expect(addBtn, "the shop grid must offer Add to cart").toBeVisible();

    const b = (await addBtn.boundingBox())!;
    expect(
      b.height,
      `grid Add to cart is ${Math.round(b.width)}x${Math.round(b.height)}; height is below the ${MIN}px floor`
    ).toBeGreaterThanOrEqual(MIN);
  });

  test("the cart quantity controls have not regressed (B-9)", async ({ page }) => {
    // Precondition: put something in the cart, or there are no controls to
    // measure and this test would pass by finding nothing.
    await page.goto("/shop", { waitUntil: "load" });
    const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    await page.goto(href!, { waitUntil: "load" });
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await page.goto("/cart", { waitUntil: "load" });

    const inc = page.locator('[data-testid="cart-qty-inc"]').first();
    await expect(inc, "precondition: the cart must contain a line").toBeVisible();

    const b = (await inc.boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(MIN);
  });
});
