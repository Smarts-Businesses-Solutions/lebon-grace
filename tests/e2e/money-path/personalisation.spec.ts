import { test, expect, type Page } from "@playwright/test";

/**
 * The engraved name must be visible to the customer before they pay.
 *
 * Found walking production as a shopper, 2026-08-09. A name is typed on the
 * product page — free, optional, 20 characters — and then never shown to the
 * customer again. Not in the cart, not in the checkout Order Summary, not in
 * the confirmation email, not on the tracking page. It IS stored correctly and
 * the workshop's cutting queue DOES display it, so the only person who never
 * sees it is the one who typed it.
 *
 * That matters because of what the product page itself says two lines below the
 * field: "We engrave exactly what you type, so please check the spelling.
 * Personalised pieces cannot be returned unless faulty." The customer is told
 * to check a value the shop then hides from them, on the one item they can
 * never send back.
 *
 * Deliberately NOT tested here: editing the engraving in the cart. Cart lines
 * are keyed `slug::personalisation`, so an editable field changes the line's
 * identity on every keystroke — remounting the row and losing focus — and
 * introduces a merge case when the edited name collides with an existing line.
 * Showing the value removes the real risk; editing it is a separate change with
 * its own design.
 */

const ENGRAVING = "Amira";

async function addEngravedItem(page: Page) {
  await page.goto("/shop", { waitUntil: "load" });
  const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
  expect(href, "the shop grid must list a product").toBeTruthy();
  await page.goto(href!, { waitUntil: "load" });

  // The field is revealed by an opt-in control; tolerate either order.
  let field = page.locator('input[maxlength="20"]').first();
  if ((await field.count()) === 0) {
    const toggle = page.locator('input[type="checkbox"], [role="switch"]').first();
    await expect(toggle, "product page must offer engraving").toHaveCount(1);
    await toggle.click();
    field = page.locator('input[maxlength="20"]').first();
  }
  await expect(field, "engraving field must appear once opted in").toHaveCount(1);
  await field.fill(ENGRAVING);

  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.waitForTimeout(800);
  return href!;
}

test.describe("@money the engraved name is shown back to the customer", () => {
  test("the cart shows what will be engraved", async ({ page }) => {
    await addEngravedItem(page);
    await page.goto("/cart", { waitUntil: "load" });

    // Precondition: the line is actually in the cart. Without this, "Amira is
    // absent" would also pass on an empty cart.
    await expect(
      page.locator('[data-testid="cart-qty-inc"]').first(),
      "precondition: the engraved item must be in the cart"
    ).toBeVisible();

    const shown = page.locator('[data-testid="cart-engraving"]');
    await expect(
      shown,
      `the cart must show the engraving "${ENGRAVING}" — it is cut irreversibly into the piece`
    ).toBeVisible();
    await expect(shown).toContainText(ENGRAVING);
  });

  test("the checkout order summary shows what will be engraved", async ({ page }) => {
    await addEngravedItem(page);
    await page.goto("/checkout", { waitUntil: "load" });

    // Precondition: the Order Summary rendered at all.
    await expect(
      page.getByText(/order summary/i),
      "precondition: the checkout order summary must render"
    ).toBeVisible();

    const shown = page.locator('[data-testid="checkout-engraving"]');
    await expect(
      shown,
      `the last screen before payment must show the engraving "${ENGRAVING}"`
    ).toBeVisible();
    await expect(shown).toContainText(ENGRAVING);
  });

  test("an item with no engraving does not claim one", async ({ page }) => {
    // The mirror case: showing "Engraving:" on every line, engraved or not,
    // would be its own defect.
    await page.goto("/shop", { waitUntil: "load" });
    const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    await page.goto(href!, { waitUntil: "load" });
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await page.goto("/cart", { waitUntil: "load" });

    await expect(
      page.locator('[data-testid="cart-qty-inc"]').first(),
      "precondition: the plain item must be in the cart"
    ).toBeVisible();
    // Scoped to the marker, NOT /engrav/i over the page: the footer carries
    // "with a name engraved free" on every page, so a page-wide regex matches
    // even when no line is personalised. First draft did exactly that.
    await expect(page.locator('[data-testid="cart-engraving"]')).toHaveCount(0);
  });
});

/**
 * "Buy now" is the other way out of the product page, and it dropped everything
 * the customer had configured.
 *
 * `Add to cart` builds the line from the current selection — the engraved name,
 * and the chosen variant's name/price/image. `Buy now` called
 * `addItem(rawProduct, quantity)` with neither. So a customer who typed a name
 * and took the faster-looking path paid for a personalised piece and would have
 * received a blank one, with nothing on the page to tell them (SH-01).
 *
 * Exercised through the SAME assertion as the Add-to-cart path: whatever route
 * the customer takes, the checkout summary must show what will be cut.
 */
test.describe("@money Buy now carries the configuration", () => {
  test("the engraving survives Buy now", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "load" });
    const href = await page.locator('a[href^="/shop/"]').first().getAttribute("href");
    expect(href, "the shop grid must list a product").toBeTruthy();
    await page.goto(href!, { waitUntil: "load" });

    let field = page.locator('input[maxlength="20"]').first();
    if ((await field.count()) === 0) {
      const toggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      await expect(toggle, "product page must offer engraving").toHaveCount(1);
      await toggle.click();
      field = page.locator('input[maxlength="20"]').first();
    }
    await expect(field, "engraving field must appear once opted in").toHaveCount(1);
    await field.fill(ENGRAVING);

    // The whole point: this path, not "Add to cart".
    await page.getByRole("link", { name: /buy now/i }).first().click();
    await page.waitForURL(/\/checkout/, { timeout: 15000 });

    // Precondition (L-2): the summary rendered at all. Same locator the
    // Add-to-cart test uses — invented test-ids made the first version of this
    // fail on its own precondition, which proves nothing about the bug.
    await expect(
      page.getByText(/order summary/i),
      "precondition: the checkout order summary must render"
    ).toBeVisible({ timeout: 15000 });

    // The same assertion the Add-to-cart path is held to.
    const shown = page.locator('[data-testid="checkout-engraving"]');
    await expect(
      shown,
      `Buy now must carry the engraving "${ENGRAVING}" — it is cut irreversibly into the piece`
    ).toBeVisible({ timeout: 15000 });
    await expect(shown).toContainText(ENGRAVING);
  });
});
