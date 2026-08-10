import { chromium } from "playwright";

const BASE = "https://shop.lebon-grace.com";
const PRODUCT = "/shop/abc-jigsaw-board";
const out = { base: BASE, checks: {}, consoleErrors: [], requestFailures: [] };

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", m => { if (m.type() === "error") out.consoleErrors.push(m.text()); });
page.on("requestfailed", r => out.requestFailures.push({ url: r.url(), failure: r.failure()?.errorText }));

async function reset() {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  // App-router providers stay mounted across navigation; reload to discard their in-memory cart too.
  await page.reload({ waitUntil: "domcontentloaded" });
}
async function product() {
  await page.goto(BASE + PRODUCT, { waitUntil: "domcontentloaded" });
  const add = page.getByTestId("add-to-cart");
  await add.waitFor();
  // Server markup arrives before React handlers; wait for hydration before any shopper action.
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="add-to-cart"]');
    if (!button) return false;
    const key = Object.keys(button).find(k => k.startsWith("__reactProps"));
    const props = key ? button[key] : null;
    return Boolean(props && props.onClick);
  });
}

try {
  // Guide-positive path: optional engraving survives ordinary Add to Cart.
  await reset(); await product();
  await page.locator('label').filter({ hasText: "Engrave a name on it" }).locator('input[type="checkbox"]').check();
  await page.getByPlaceholder("e.g. Amira").waitFor();
  await page.getByPlaceholder("e.g. Amira").fill("Amira");
  await page.getByTestId("add-to-cart").click();
  await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" });
  await page.getByText("Order Summary").waitFor();
  out.checks.normalAddPreservesEngraving = (await page.locator("body").innerText()).includes("Amira");

  // Basket and delivery choice persist across a reload.
  await page.getByRole("button", { name: /deliver to me/i }).first().click();
  const beforeReload = await page.getByTestId("cart-shipping").innerText();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("cart-shipping").waitFor();
  const afterReload = await page.getByTestId("cart-shipping").innerText();
  out.checks.deliveryPersistsReload = { beforeReload, afterReload, pass: /20/.test(beforeReload) && /20/.test(afterReload) };

  // Exact AED 150 boundary is free delivery (10 x AED 15 product).
  await reset(); await product();
  for (let i = 0; i < 10; i++) await page.getByTestId("add-to-cart").click();
  await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /deliver to me/i }).first().click();
  out.checks.freeDeliveryAt150 = {
    subtotal: await page.getByTestId("cart-subtotal").innerText(),
    shipping: await page.getByTestId("cart-shipping").innerText(),
    total: await page.getByTestId("cart-total").innerText()
  };

  // Guide-negative path: Buy now must carry selected engraving. Intercepting prevents any Stripe call.
  await reset(); await product();
  await page.locator('label').filter({ hasText: "Engrave a name on it" }).locator('input[type="checkbox"]').check();
  await page.getByPlaceholder("e.g. Amira").waitFor();
  await page.getByPlaceholder("e.g. Amira").fill("Amira");
  let payload = null;
  await page.route("**/api/checkout", async route => {
    payload = JSON.parse(route.request().postData() || "null");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/checkout?success=true&session_id=cs_test_stubbed" }) });
  });
  await page.getByRole("link", { name: "Buy now" }).click();
  await page.getByRole("heading", { name: "Checkout" }).waitFor();
  const checkoutBody = await page.locator("body").innerText();
  out.checks.buyNowCheckoutSummaryHasEngraving = checkoutBody.includes("Engraving: Amira");
  await page.screenshot({ path: "audits/shopper-2026-08-10/evidence/buy-now-checkout.png", fullPage: true });

  // Empty/invalid checkout must stop before payment-session network invocation.
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" });
  out.checks.emptyCartCheckoutState = (await page.locator("body").innerText()).includes("Nothing to Checkout");

  out.checks.interceptedCheckoutPayload = payload;
} catch (error) {
  out.fatal = String(error?.stack || error);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
