import { test, expect } from "@playwright/test";

/**
 * The fixed mobile purchase bar must not cover what the customer is typing.
 *
 * SH-02 and SH-09 were filed as things needing a human to look at a rendered
 * layout. They are not: an overlap is two rectangles intersecting, and a
 * rectangle is four numbers. This measures them.
 *
 * It matters because the bar is `fixed bottom-0 … z-40` and the engraving field
 * is the last thing in the page flow — so on a short viewport the control that
 * decides what gets cut irreversibly into a piece of wood can sit underneath an
 * opaque bar, and the customer confirms an engraving they cannot read.
 */

/** Do two boxes share any area at all? */
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe("@money the mobile purchase bar does not cover the engraving field", () => {
  test.skip(({ viewport }) => !viewport || viewport.width >= 1024, "the bar is lg:hidden — mobile only");

  test("the engraving input is fully visible once opted in", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "load" });
    const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    expect(href, "the shop grid must list a product").toBeTruthy();
    await page.goto(href!, { waitUntil: "load" });

    // Opt in to engraving, the same way the customer does.
    let field = page.locator('input[maxlength="20"]').first();
    if ((await field.count()) === 0) {
      const toggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      await expect(toggle, "product page must offer engraving").toHaveCount(1);
      await toggle.click();
      field = page.locator('input[maxlength="20"]').first();
    }
    await expect(field, "engraving field must appear once opted in").toHaveCount(1);
    await field.scrollIntoViewIfNeeded();
    await field.fill("Amira");

    const bar = page.locator('[data-testid="add-to-cart-mobile"]');

    // PRECONDITION (L-2): both elements are actually on screen. Without this,
    // "they do not overlap" would pass when either is missing entirely — which
    // is the commonest way a layout assertion becomes decoration.
    await expect(field, "precondition: the engraving field must be visible").toBeVisible();
    await expect(bar, "precondition: the mobile purchase bar must be visible").toBeVisible();

    const fieldBox = await field.boundingBox();
    const barBox = await bar.boundingBox();
    expect(fieldBox, "engraving field must have a box").toBeTruthy();
    expect(barBox, "purchase bar must have a box").toBeTruthy();

    expect(
      overlaps(fieldBox!, barBox!),
      `the fixed purchase bar covers the engraving field — the customer cannot read ` +
        `what will be cut into the piece.\n  field: ${JSON.stringify(fieldBox)}\n  bar:   ${JSON.stringify(barBox)}`
    ).toBe(false);
  });

  test("the primary product image is not a blank box", async ({ page }) => {
    // SH-09: the gallery thumbnail "can look empty at mobile size". Measurable:
    // an <img> that rendered has a natural size; one that failed does not.
    await page.goto("/shop", { waitUntil: "load" });
    const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    await page.goto(href!, { waitUntil: "load" });

    const img = page.locator("main img").first();
    await expect(img, "precondition: the product page must show an image").toBeVisible();

    const dims = await img.evaluate((el) => {
      const i = el as HTMLImageElement;
      return { natural: i.naturalWidth, complete: i.complete, rendered: i.getBoundingClientRect().width };
    });

    expect(dims.complete, "the product image must finish loading").toBe(true);
    expect(dims.natural, "a natural width of 0 means the image failed — a blank box").toBeGreaterThan(0);
    expect(dims.rendered, "the image must occupy real space").toBeGreaterThan(0);
  });
});
