/**
 * MASTER-QA-PROTOCOL §6 Module E — unhappy paths and failure modes.
 *
 * Every backing service fails eventually. What the protocol asks is that when
 * one does, the app: does not crash, says so clearly, offers a way back, does
 * not fail *silently*, and never leaves a spinner running past 10 seconds.
 *
 * Deterministic by construction. Every failure here is injected with
 * `page.route`, so there is no timing luck and no real service is involved —
 * the protocol's "avoid randomness in CI" is not a style note, it is what keeps
 * a red run meaningful.
 *
 * The most valuable test in this file is the first one, and it was written
 * against a real defect: a failed checkout used to render "Order Confirmed".
 */
import { test, expect, type Page, type Route } from "@playwright/test";

const PRODUCT = { slug: "abc-jigsaw-board", price: 15 };

/** The protocol's hard gate: no busy state may outlive 10 seconds. */
const SPINNER_LIMIT_MS = 10_000;

async function addToCart(page: Page) {
  await page.goto(`/shop/${PRODUCT.slug}`);
  await page.getByTestId("add-to-cart").click();
}

async function fillCheckout(page: Page) {
  await page.fill('input[name="email"]', "buyer@example.com");
  await page.fill('input[name="phone"]', "0501234567");
  await page.fill('input[name="firstName"]', "Amira");
  await page.fill('input[name="lastName"]', "Khan");
  await page.check('input[name="termsAccepted"]');
}

/** Fail a route deterministically. `mode` picks the flavour of failure. */
async function breakRoute(page: Page, url: string, mode: "500" | "abort" | "slow") {
  await page.route(url, async (route: Route) => {
    if (mode === "abort") return route.abort("failed");
    if (mode === "slow") {
      await new Promise((r) => setTimeout(r, 3_000));
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Internal Server Error" }),
    });
  });
}

test.describe("@smoke failure modes — checkout", () => {
  test("REGRESSION: a failed checkout must not claim the order succeeded", async ({ page }) => {
    // The defect this file was written for. Both failure branches used to call
    // clearCart() and setOrderPlaced(true), so a customer whose payment never
    // started saw "Order Confirmed — Your piece is now in the making queue",
    // with a Track Your Order link, an emptied basket, and no charge taken.
    // They would have waited for a puzzle nobody was going to make.
    await breakRoute(page, "**/api/checkout", "500");
    await addToCart(page);
    await page.goto("/cart");
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await fillCheckout(page);
    await page.getByTestId("place-order").click();

    // Said out loud…
    await expect(page.getByTestId("checkout-error")).toBeVisible({ timeout: SPINNER_LIMIT_MS });
    // …and NOT dressed up as success.
    await expect(page.getByText(/order confirmed/i)).toHaveCount(0);
  });

  test("a failed checkout keeps the basket", async ({ page }) => {
    // Clearing it was the other half of the same bug: the customer could not
    // even retry, because the thing they were buying had been thrown away.
    await breakRoute(page, "**/api/checkout", "500");
    await addToCart(page);
    await page.goto("/cart");
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await fillCheckout(page);
    await page.getByTestId("place-order").click();
    await expect(page.getByTestId("checkout-error")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price));
  });

  test("a dropped connection is reported, not swallowed", async ({ page }) => {
    // The `catch` branch — offline, DNS failure, the tunnel down.
    await breakRoute(page, "**/api/checkout", "abort");
    await addToCart(page);
    await page.goto("/cart");
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await fillCheckout(page);
    await page.getByTestId("place-order").click();

    await expect(page.getByTestId("checkout-error")).toBeVisible({ timeout: SPINNER_LIMIT_MS });
    await expect(page.getByText(/order confirmed/i)).toHaveCount(0);
  });

  test("the customer can retry after a failure", async ({ page }) => {
    // "No silent failures" is only half of it; the protocol also asks for a
    // retry path. The button must come back out of its submitting state.
    let attempts = 0;
    await page.route("**/api/checkout", async (route: Route) => {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "/checkout?success=true&session_id=cs_test_retry" }),
      });
    });

    await addToCart(page);
    await page.goto("/cart");
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await fillCheckout(page);
    await page.getByTestId("place-order").click();
    await expect(page.getByTestId("checkout-error")).toBeVisible();

    const button = page.getByTestId("place-order");
    await expect(button, "the button must be usable again after a failure").toBeEnabled();
    await button.click();
    await expect.poll(() => attempts, { timeout: SPINNER_LIMIT_MS }).toBe(2);
  });

  test("a successful return from Stripe confirms the order and empties the basket", async ({ page }) => {
    // The mirror image, and it was missing entirely: Stripe returns the
    // customer to /checkout?success=true and nothing read that parameter, so a
    // PAID order showed the form again with a full basket and no confirmation.
    await addToCart(page);
    await page.goto("/checkout?success=true&session_id=cs_test_paid");

    await expect(page.getByText(/order confirmed/i)).toBeVisible({ timeout: SPINNER_LIMIT_MS });
    await page.goto("/cart");
    await expect(page.getByText(/empty|nothing/i).first()).toBeVisible();
  });
});

test.describe("@smoke failure modes — degraded, not broken", () => {
  test("a product page survives its variants endpoint failing", async ({ page }) => {
    // /api/variants is enrichment. If it 500s the customer should still be able
    // to see the piece and buy it, not meet an error page.
    await breakRoute(page, "**/api/variants**", "500");
    await page.goto(`/shop/${PRODUCT.slug}`);

    await expect(page.getByTestId("add-to-cart")).toBeVisible({ timeout: SPINNER_LIMIT_MS });
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price));
  });

  test("order lookup reports a server failure instead of hanging", async ({ page }) => {
    await breakRoute(page, "**/api/orders**", "500");
    await page.goto("/track");
    await page.getByTestId("track-order-id").fill("3f1c2b8a");
    await page.getByTestId("track-phone").fill("0501234567");
    await page.getByTestId("track-submit").click();

    await expect(page.getByTestId("track-error")).toBeVisible({ timeout: SPINNER_LIMIT_MS });
    // The spinner rule: the button must not still say "Searching…".
    await expect(page.getByTestId("track-submit")).toBeEnabled();
  });

  test("a slow endpoint does not leave a spinner running past the limit", async ({ page }) => {
    // 3s of latency against a 10s gate — deterministic, and it fails loudly if
    // a future change removes the finally-block that clears the busy state.
    await breakRoute(page, "**/api/orders**", "slow");
    await page.goto("/track");
    await page.getByTestId("track-order-id").fill("3f1c2b8a");
    await page.getByTestId("track-phone").fill("0501234567");

    const started = Date.now();
    await page.getByTestId("track-submit").click();
    await expect(page.getByTestId("track-submit")).toBeEnabled({ timeout: SPINNER_LIMIT_MS });
    expect(Date.now() - started).toBeLessThan(SPINNER_LIMIT_MS);
  });
});
