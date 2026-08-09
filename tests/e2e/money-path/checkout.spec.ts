/**
 * MASTER-QA-PROTOCOL §6 Module C — user action coverage, money path only.
 *
 * Add to cart → cart arithmetic → checkout → the payload that would have been
 * charged. Everything a customer does between wanting a puzzle and paying for
 * one, driven through a real browser.
 *
 * ── The hard constraint ──────────────────────────────────────────────────────
 *
 * The checkout endpoint creates a REAL Stripe Checkout Session. This account is
 * live. A suite that runs on every push must never reach it, so every test here
 * intercepts the request at the browser and fulfils it with a stub. Nothing
 * leaves the machine.
 *
 * That is not a compromise — it is the more useful assertion. What matters on
 * this path is *what the client asks to be charged*: slugs, quantities,
 * delivery method, engraving. Those are asserted directly on the intercepted
 * payload. The server's refusal to trust that payload is already covered by
 * `src/app/api/checkout/route.test.ts` (A-4), which pins that catalogue prices
 * win over anything the client sends.
 *
 * Deliberately NOT covered: Stripe's hosted page, and the webhook. The first is
 * not ours to test; the second has no browser surface and is unit-tested with
 * both idempotency layers pinned.
 */
import { test, expect, type Page, type Route } from "@playwright/test";

/** AED 15 flat across the range, so the arithmetic below is stable. */
const PRODUCT = { slug: "abc-jigsaw-board", price: 15 };

// src/lib/cart-context.tsx, pinned by its unit test.
const UAE_DELIVERY = 20;
const FREE_DELIVERY_OVER = 150;

interface CheckoutPayload {
  items: Array<{ slug?: string; quantity: number; personalisation?: string }>;
  shipping: number;
  deliveryMethod: string;
  emirate?: string;
  customer?: { email?: string; phone?: string; name?: string };
}

/**
 * Stub /api/checkout and capture what the client sent.
 *
 * Returns a getter rather than the value: the request has not happened yet when
 * this is called, and a test that read it too early would silently assert on
 * `null` and pass.
 */
function interceptCheckout(page: Page) {
  let captured: CheckoutPayload | null = null;
  let calls = 0;
  page.route("**/api/checkout", async (route: Route) => {
    calls += 1;
    captured = JSON.parse(route.request().postData() || "null");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      // A URL the browser can actually navigate to, so the redirect is
      // observable without leaving the site under test.
      body: JSON.stringify({ url: "/checkout?success=true&session_id=cs_test_stubbed" }),
    });
  });
  return { payload: () => captured, calls: () => calls };
}

/**
 * Fill the checkout form.
 *
 * `building` and `termsAccepted` are easy to miss and both block submission —
 * checkout/page.tsx carries a comment about a real incident where "validation
 * failed on two fields that were not on screen". `building` is required only
 * for delivery; the terms checkbox always is.
 */
async function fillCheckout(page: Page, { delivery }: { delivery: boolean }) {
  await page.fill('input[name="email"]', "buyer@example.com");
  await page.fill('input[name="phone"]', "0501234567");
  await page.fill('input[name="firstName"]', "Amira");
  await page.fill('input[name="lastName"]', "Khan");
  if (delivery) {
    await page.fill('input[name="address"]', "12 Test Street");
    await page.fill('input[name="building"]', "Villa 4");
  }
  await page.check('input[name="termsAccepted"]');
}

/** Choose delivery on the cart page. The cart defaults to pickup, not delivery. */
async function chooseDelivery(page: Page) {
  await page.getByRole("button", { name: /deliver to me/i }).first().click();
}

/** Add `qty` of the product to the cart, starting from its product page. */
async function addToCart(page: Page, qty = 1) {
  await page.goto(`/shop/${PRODUCT.slug}`);
  const add = page.getByTestId("add-to-cart");
  await expect(add, "the product page must offer an add-to-cart control").toBeVisible();
  for (let i = 0; i < qty; i++) await add.click();
}

test.describe("@smoke money path — cart", () => {
  test("a puzzle added from its product page reaches the cart at catalogue price", async ({ page }) => {
    await addToCart(page);
    await page.goto("/cart");

    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price));
    await expect(page.getByText(/Proceed to Checkout/i)).toBeVisible();
  });

  test("the cart opens on collection, which is free", async ({ page }) => {
    // Worth pinning explicitly: the default is `pickup`, not delivery
    // (cart-context.tsx:118). Every assertion about a delivery charge has to
    // select delivery first, and a silent flip of this default would change
    // what customers are quoted before they touch anything.
    await addToCart(page);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-shipping")).toHaveText(/free/i);
  });

  test("delivery is charged under the free threshold", async ({ page }) => {
    await addToCart(page);
    await page.goto("/cart");
    await chooseDelivery(page);
    await expect(page.getByTestId("cart-shipping")).toContainText(String(UAE_DELIVERY));
  });

  test("delivery becomes free exactly at the threshold", async ({ page }) => {
    // The boundary, not a value comfortably past it: AED 15 x 10 = 150, which
    // is where "free over 150" is either inclusive or off by one product.
    const qty = FREE_DELIVERY_OVER / PRODUCT.price;
    await addToCart(page, qty);
    await page.goto("/cart");
    await chooseDelivery(page);

    await expect(page.getByTestId("cart-subtotal")).toContainText(String(FREE_DELIVERY_OVER));
    await expect(page.getByTestId("cart-shipping")).toHaveText(/free/i);
    await expect(page.getByTestId("cart-total")).toContainText(String(FREE_DELIVERY_OVER));
  });

  test("switching to collection removes the delivery charge", async ({ page }) => {
    await addToCart(page);
    await page.goto("/cart");
    await chooseDelivery(page);
    await expect(page.getByTestId("cart-shipping")).toContainText(String(UAE_DELIVERY));

    await page.getByRole("button", { name: /pick up/i }).first().click();
    await expect(page.getByTestId("cart-shipping")).toHaveText(/free/i);
  });

  test("the cart survives a reload", async ({ page }) => {
    // It lives in localStorage; a customer who refreshes mid-decision must not
    // lose it. This is also the hydration path that cart-context's
    // set-state-in-effect suppression exists for.
    await addToCart(page);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price));

    await page.reload();
    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price));
  });

  test("REGRESSION: the delivery choice survives a reload", async ({ page }) => {
    // It used to live only in React state while the cart itself was persisted,
    // so choosing "Deliver to me" and then refreshing — or opening /checkout
    // directly — silently reverted to pickup. /checkout has no toggle of its
    // own, so the address fields vanished and the order was quoted with free
    // collection. Found by this suite; fixed in cart-context.
    await addToCart(page);
    await page.goto("/cart");
    await chooseDelivery(page);
    await expect(page.getByTestId("cart-shipping")).toContainText(String(UAE_DELIVERY));

    await page.reload();
    await expect(page.getByTestId("cart-shipping")).toContainText(String(UAE_DELIVERY));
  });

  test("increasing quantity increases the subtotal", async ({ page }) => {
    await addToCart(page);
    await page.goto("/cart");
    await page.getByTestId("cart-qty-inc").first().click();
    await expect(page.getByTestId("cart-subtotal")).toContainText(String(PRODUCT.price * 2));
  });
});

test.describe("@smoke money path — checkout", () => {
  test("an empty cart cannot reach payment", async ({ page }) => {
    const checkout = interceptCheckout(page);
    await page.goto("/checkout");
    await expect(page.getByText(/cart is empty|nothing in your cart|no items/i).first()).toBeVisible();
    expect(checkout.calls(), "an empty cart must not create a Stripe session").toBe(0);
  });

  test("submitting sends exactly what the customer chose", async ({ page }) => {
    const checkout = interceptCheckout(page);
    await addToCart(page, 2);
    await page.goto("/cart");
    await chooseDelivery(page);
    // Clicked, not navigated to: this is the path a customer actually takes.
    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout/);

    await fillCheckout(page, { delivery: true });
    await page.getByTestId("place-order").click();
    await expect.poll(() => checkout.calls(), { timeout: 10_000 }).toBe(1);

    const sent = checkout.payload();
    expect(sent, "the checkout request body").not.toBeNull();
    expect(sent!.items).toHaveLength(1);
    expect(sent!.items[0].slug).toBe(PRODUCT.slug);
    expect(sent!.items[0].quantity).toBe(2);
    expect(sent!.deliveryMethod).toBe("delivery");
    expect(sent!.shipping).toBe(UAE_DELIVERY);
    expect(sent!.customer?.phone).toBe("0501234567");
  });

  test("choosing collection sends no delivery charge", async ({ page }) => {
    const checkout = interceptCheckout(page);
    await addToCart(page);
    await page.goto("/cart");
    await page.getByRole("button", { name: /pick up/i }).first().click();

    await page.goto("/checkout");
    await fillCheckout(page, { delivery: false });
    await page.getByTestId("place-order").click();

    await expect.poll(() => checkout.calls(), { timeout: 10_000 }).toBe(1);
    expect(checkout.payload()!.deliveryMethod).toBe("pickup");
    expect(checkout.payload()!.shipping).toBe(0);
  });
});

test.describe("@smoke money path — order lookup", () => {
  test("a stranger's order id and a wrong phone are refused", async ({ page }) => {
    // The whole authorisation model for guest orders. There are no accounts, so
    // this pair IS the credential — and S-6 was a live hole in exactly this
    // lookup. Asserting the refusal renders, not merely that nothing appears.
    await page.goto("/track");
    // Test ids, not input[type=text]: the header search box is also a text
    // input, so a type selector matches two elements and fills the wrong one.
    await page.getByTestId("track-order-id").fill("3f1c2b8a");
    await page.getByTestId("track-phone").fill("0500000000");
    await page.getByTestId("track-submit").click();

    // Asserts the refusal is SHOWN, not the exact wording. The endpoint answers
    // 404 normally and 429 once this IP has spent its hourly budget (10/hr,
    // A-21) — both are correct refusals, and pinning one message would make
    // this fail depending on how often the suite had run that hour.
    const refusal = page.getByTestId("track-error");
    await expect(refusal).toBeVisible({ timeout: 15_000 });

    // Paired with the above so it is not a bare absence check: the refusal
    // rendered, AND no order was disclosed alongside it.
    await expect(page.getByText(/tracking number|order id\s*#/i)).toHaveCount(0);
  });

  test("a single-digit phone is refused, not treated as a match", async ({ page }) => {
    // R-1. The phone comparison was `ca.endsWith(cb.slice(-8))`, and slice(-8)
    // of a one-character string is that character — so "7" matched any number
    // ending in 7. Exactly one digit matches, so ten attempts defeated the
    // phone half of the credential, against a limit of ten an hour.
    //
    // The unit tests in src/lib/phone.test.ts pin the comparison itself; this
    // pins that the shipped page does not accept it either.
    await page.goto("/track");
    await page.getByTestId("track-order-id").fill("3f1c2b8a");
    await page.getByTestId("track-phone").fill("7");
    await page.getByTestId("track-submit").click();

    await expect(page.getByTestId("track-error")).toBeVisible({ timeout: 15_000 });
    // Paired with the refusal so this is not a bare absence check.
    await expect(page.getByText(/tracking number|order id\s*#/i)).toHaveCount(0);
  });
});

test.describe("@smoke money path — the phone is part of the credential", () => {
  test("checkout refuses a phone too short to look the order up with", async ({ page }) => {
    // R-2. The only phone check lived on the client and counted CHARACTERS
    // (`form.phone.length < 10`), so "----------" passed it. A stored phone
    // that cannot be compared is an order the customer can never reach: both
    // /track and /account check it, and there is no account to fall back on.
    //
    // Asserts the request is never made, which is stronger than asserting a
    // message: the guard exists to stop the order being created at all.
    let checkoutCalled = false;
    await page.route("**/api/checkout", async (route) => {
      checkoutCalled = true;
      await route.abort();
    });

    await addToCart(page);
    await page.goto("/checkout");
    await fillCheckout(page, { delivery: false });
    // 12 CHARACTERS but only 6 DIGITS — chosen so this test discriminates.
    // "4567" would be rejected by the old rule too (4 < 10) and the test would
    // pass without the fix, which is no test at all. This value sails through
    // `form.phone.length < 10` and is caught only by counting digits.
    await page.fill('input[name="phone"]', "(05) 0-1 2-3");
    await page.getByRole("button", { name: /pay|place order|continue/i }).first().click();

    // Precondition for the absence assertion below: the form is still here,
    // i.e. we did not simply navigate away and observe nothing.
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    expect(checkoutCalled, "a too-short phone must not reach /api/checkout").toBe(false);
  });
});
