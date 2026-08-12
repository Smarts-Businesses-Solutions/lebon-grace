import { test, expect } from "@playwright/test";

/**
 * The money path, end to end, with a demo card.
 *
 * Every other test in this repo stops at the edge of Stripe: the unit tests
 * feed the webhook synthetic signed events, and the checkout tests assert the
 * session we asked for. Nothing has ever driven a REAL Stripe Checkout session
 * from the browser and watched an order appear at the other end.
 *
 * That gap is where the launch risk lives. A synthetic event proves the handler
 * parses what we hand it; it cannot prove that what Stripe actually sends looks
 * like what we imagined, that the redirect works, that metadata survives the
 * round trip, or that the signing secret matches the endpoint.
 *
 * WHY THIS RUNS AGAINST A LOCAL SERVER, NOT STAGING. Stripe has to POST the
 * webhook somewhere it can reach. cx53's 80/443 are firewalled to Cloudflare and
 * the staging app has no Cloudflare hostname, so Stripe cannot deliver to it at
 * all — verified: its FQDN answers 000 from outside. `stripe listen` solves this
 * by forwarding events from Stripe to a local port.
 *
 * WHY A DEMO CARD CANNOT DO THIS ON THE LIVE SHOP. 4242… is rejected outright in
 * live mode. This proves the whole chain in TEST mode; the residual — that the
 * live keys and live signing secret are correct — is only closed by one real
 * card. The live keys and endpoint have been verified to authenticate.
 *
 * Setup is in scripts/demo-card-run.md. Requires STRIPE_SECRET_KEY (sk_test_…),
 * a running `stripe listen`, and the staging database.
 */

const CARD = "4242424242424242";
const PHONE = "+971500000001";

test.describe("a purchase with a demo card", () => {
  test.skip(
    !process.env.DEMO_CARD_RUN,
    "opt-in: needs a test-mode Stripe key and `stripe listen`. See scripts/demo-card-run.md"
  );

  // Stripe's hosted page, a redirect back, and a webhook round trip. The default
  // 30s is not enough and a flake here reads as a broken money path.
  test.setTimeout(180_000);

  test("card charged, redirected back, and the webhook creates the order", async ({ page, request }) => {
    // ─── put something in the cart ───
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const firstProduct = page.locator('a[href^="/shop/"]').first();
    await firstProduct.waitFor({ state: "visible" });
    await firstProduct.click();

    const addToCart = page.getByRole("button", { name: /add to cart/i });
    await addToCart.waitFor({ state: "visible" });
    await expect(addToCart, "PRECONDITION: the product page is interactive").toBeEnabled();
    await addToCart.click();

    // ─── our own checkout form ───
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    // By placeholder/label, never by index: the first visible input on every
    // page is the header's "Search puzzles" box, which has silently swallowed
    // form input in three earlier specs.
    await page.getByLabel(/name/i).first().fill("Demo Card Buyer");
    await page.getByLabel(/email/i).first().fill("demo-card@example.com");
    await page.getByLabel(/phone/i).first().fill(PHONE);
    await page.getByLabel(/address/i).first().fill("1 Test Street");

    const pay = page.getByRole("button", { name: /pay|checkout|place order/i }).last();
    await expect(pay).toBeEnabled();
    await pay.click();

    // ─── Stripe's hosted page ───
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });

    // Stripe renders its card fields in the top-level document on the hosted
    // page (unlike Elements, which uses iframes), but the layout varies by
    // account and locale, so each field is located by its accessible name.
    await page.getByPlaceholder(/1234 1234/).or(page.getByLabel(/card number/i)).first().fill(CARD);
    await page.getByPlaceholder(/MM ?\/ ?YY/i).or(page.getByLabel(/expiration/i)).first().fill("12/34");
    await page.getByPlaceholder(/CVC/i).or(page.getByLabel(/CVC|security code/i)).first().fill("123");

    const nameOnCard = page.getByLabel(/name on card|cardholder/i);
    if (await nameOnCard.count()) await nameOnCard.first().fill("Demo Card Buyer");

    await page.getByTestId("hosted-payment-submit-button")
      .or(page.getByRole("button", { name: /pay/i }))
      .first()
      .click();

    // ─── back on our success page ───
    await page.waitForURL(/success=true/, { timeout: 90_000 });
    const sessionId = new URL(page.url()).searchParams.get("session_id");
    expect(sessionId, "Stripe must hand the session id back").toMatch(/^cs_/);

    // ─── and the webhook must have written the order ───
    //
    // THIS is the assertion that matters. Everything above proves the customer
    // can pay; only this proves the shop found out. The webhook arrives out of
    // band via `stripe listen`, so poll rather than assume it has landed.
    const rest = process.env.STAGING_REST_URL;
    const key = process.env.STAGING_SERVICE_KEY;
    expect(rest && key, "PRECONDITION: staging database must be configured").toBeTruthy();

    let order: unknown[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await request.get(
        `${rest}/orders?stripe_session_id=eq.${sessionId}&select=id,status,total,customer_phone`,
        { headers: { apikey: key!, Authorization: `Bearer ${key}` } }
      );
      if (res.ok()) {
        order = await res.json();
        if (order.length) break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    expect(order.length, `no order was created for ${sessionId} — the webhook never wrote it`).toBe(1);
    const o = order[0] as { status: string; customer_phone: string };
    // The status every other surface filters on. Writing "paid" here once made
    // new orders invisible in track, admin, operations and metrics at the same
    // time, so assert the exact value rather than merely that one exists.
    expect(o.status).toBe("deposit_paid");
    // Proves OUR form's metadata survived the Stripe round trip, rather than
    // the handler falling back to Stripe's empty customer_details.phone.
    expect(o.customer_phone).toBe(PHONE);
  });
});
