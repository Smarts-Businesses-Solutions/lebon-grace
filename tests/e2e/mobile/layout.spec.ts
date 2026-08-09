/**
 * MASTER-QA-PROTOCOL §2.3 — mobile viewport runs.
 *
 * The other suites run under all three projects and pass identically on each,
 * which is worth knowing but proves nothing *about mobile*. This file tests the
 * things that only exist below the `lg` breakpoint, and the geometry that only
 * goes wrong on a small screen.
 *
 * `test.skip` on desktop rather than a separate config: one suite, and the
 * skips document which behaviours are mobile-only instead of hiding them in a
 * projects array.
 */
import { test, expect, type Page } from "@playwright/test";

const PRODUCT = "abc-jigsaw-board";

/**
 * The minimum comfortable tap target. WCAG 2.5.5 asks for 44×44 CSS px, and
 * it is the figure both Apple and Android publish.
 */
const MIN_TAP_PX = 44;

/** Skip on the desktop project — every assertion here is about a small screen. */
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "mobile viewports only");
});

/** Do two rectangles overlap at all? */
function overlaps(a: { x: number; y: number; width: number; height: number },
                  b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x
      && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe("@smoke mobile — the sticky buy bar", () => {
  test("exists on a product page and is reachable without scrolling", async ({ page }) => {
    // It is `lg:hidden fixed bottom-0`, so it has no desktop equivalent at all.
    await page.goto(`/shop/${PRODUCT}`);
    const bar = page.getByTestId("add-to-cart-mobile");
    await expect(bar).toBeVisible();

    const box = await bar.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, "the sticky bar must have a box").not.toBeNull();
    expect(box!.y, "it is pinned to the bottom, so it must be on screen").toBeLessThan(viewport.height);
  });

  test("the sticky bar actually adds to the cart", async ({ page }) => {
    // The desktop button is separately covered; this is the control a phone
    // user actually reaches, and nothing had ever exercised it.
    await page.goto(`/shop/${PRODUCT}`);
    await page.getByTestId("add-to-cart-mobile").click();
    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toContainText("15");
  });

  test("REGRESSION: the WhatsApp float must not sit on top of it", async ({ page }) => {
    // This happened. WhatsAppButton.tsx:43-48 records it: the float was
    // `z-50 bottom-6` while the buy bar is `z-40 bottom-0`, so on every product
    // page the green circle landed squarely on Add to cart and swallowed the
    // tap. Fixed by moving the float to `bottom-24` below `lg`.
    //
    // Asserted geometrically rather than by class name, so it stays true if
    // either element is restyled.
    await page.goto(`/shop/${PRODUCT}`);

    const bar = page.getByTestId("add-to-cart-mobile");
    const float = page.locator('a[href*="wa.me"], button[aria-label*="WhatsApp" i]').first();

    // Precondition: both must be on screen, or "they do not overlap" is
    // trivially true and the test asserts nothing.
    await expect(bar, "precondition: the buy bar renders").toBeVisible();
    await expect(float, "precondition: the WhatsApp float renders").toBeVisible();

    const barBox = await bar.boundingBox();
    const floatBox = await float.boundingBox();
    expect(barBox && floatBox, "both need measurable boxes").toBeTruthy();
    expect(
      overlaps(barBox!, floatBox!),
      "the WhatsApp float overlaps the Add to cart button — it will eat the tap"
    ).toBe(false);
  });

  test("the buy bar is not covered by anything else either", async ({ page }) => {
    // Broader than the float: whatever is on top at the button's centre point
    // must BE the button, or a tap never reaches it.
    await page.goto(`/shop/${PRODUCT}`);
    const bar = page.getByTestId("add-to-cart-mobile");
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;

    const isSelf = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('[data-testid="add-to-cart-mobile"]');
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

    expect(isSelf, "something else is on top of the Add to cart button").toBe(true);
  });
});

test.describe("@smoke mobile — layout integrity", () => {
  const ROUTES = ["/", "/shop", `/shop/${PRODUCT}`, "/cart", "/checkout", "/track"];

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      // Horizontal overflow is the classic small-screen defect: one element a
      // few pixels too wide and the whole page rocks left-to-right. Invisible
      // at 1920px, obvious and awful on a phone.
      await page.goto(route);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // 1px of tolerance for sub-pixel rounding.
      expect(
        overflow.scrollWidth,
        `${route} is ${overflow.scrollWidth - overflow.clientWidth}px wider than the viewport`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test("the mobile menu opens and can navigate", async ({ page }) => {
    // The nav collapses behind a toggle below `lg`; on desktop the links are
    // always visible, so this control is only ever exercised here.
    await page.goto("/");
    await page.getByRole("button", { name: /toggle menu/i }).click();

    const shopLink = page.getByRole("link", { name: /^shop$/i }).first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/);
  });
});

test.describe("@smoke mobile — tap targets on the money path", () => {
  test("the controls a customer must hit are big enough to hit", async ({ page }) => {
    // WCAG 2.5.5. A 30px control is usable with a mouse and a coin-flip with a
    // thumb — and these are the controls between a customer and paying.
    await page.goto(`/shop/${PRODUCT}`);
    await page.getByTestId("add-to-cart-mobile").click();
    await page.goto("/cart");

    const targets: Array<[string, ReturnType<Page["getByTestId"]>]> = [
      ["cart quantity +", page.getByTestId("cart-qty-inc").first()],
    ];

    for (const [label, locator] of targets) {
      await expect(locator, `precondition: ${label} is on screen`).toBeVisible();
      const box = (await locator.boundingBox())!;
      // Reported together so one run tells you every offender, not just the first.
      expect(
        Math.round(Math.min(box.width, box.height)),
        `${label} is ${Math.round(box.width)}×${Math.round(box.height)}px, below the ${MIN_TAP_PX}px minimum`
      ).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
  });
});
