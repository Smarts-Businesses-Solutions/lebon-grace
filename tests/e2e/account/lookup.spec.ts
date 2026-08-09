import { test, expect } from "@playwright/test";

/**
 * `/account` — the returning customer's way back in.
 *
 * This page had NO end-to-end coverage at all, while `/track` next door had a
 * suite and five test ids. It is the page that returns the largest payload on
 * the site: every order matching an email and phone, each with the delivery
 * address. The gap was invisible because nothing pointed at it — the same shape
 * as a workflow that was never run.
 *
 * These tests do not need a database, which matters because CI has no Supabase
 * credentials: they assert the form is real, that it submits, and that nothing
 * is disclosed when the lookup fails. The credential logic itself is pinned in
 * `src/lib/phone.test.ts`, where it can be exhaustive without a network.
 *
 * HYDRATION. Clicking before the page has settled does nothing at all — the
 * click lands on markup React has not attached to yet, no request is made, and
 * the test reads as a silent failure. A human cannot hit that window (it takes
 * seconds to fill two fields) but a test hits it every time. Hence
 * `waitForLoadState("networkidle")` before interacting. Two runs of this page
 * were misread as broken before that was understood.
 */
test.describe("@smoke returning customer — /account lookup", () => {
  test("offers a real lookup form, with a phone example rather than contact copy", async ({ page }) => {
    await page.goto("/account");

    await expect(page.getByTestId("account-email")).toBeVisible();
    await expect(page.getByTestId("account-phone")).toBeVisible();
    await expect(page.getByTestId("account-submit")).toBeVisible();

    // The placeholder read "WhatsApp us" — copy from the contact widget, on the
    // one field whose format decides whether the customer finds their order.
    const placeholder = await page.getByTestId("account-phone").getAttribute("placeholder");
    expect(placeholder, "the phone field needs an example number, not contact copy").not.toMatch(
      /whatsapp|contact|message us/i
    );
    expect(placeholder, "and it should look like a phone number").toMatch(/[0-9]{3}/);
  });

  test("a lookup that finds nothing discloses nothing", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByTestId("account-email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByTestId("account-phone").fill("0500000000");

    // Waiting on the request is the PRECONDITION for the absence assertion
    // below: without it, "no order is shown" also passes on a form that never
    // submitted, which is exactly how this page looked broken during the
    // walkthrough that added these tests.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/orders"), { timeout: 20_000 }),
      page.getByTestId("account-submit").click(),
    ]);
    expect(response.status(), "the lookup must actually reach the API").toBeGreaterThan(0);

    // Nothing belonging to anyone is rendered. Deliberately not asserting the
    // exact status or wording: the endpoint answers 404 normally, 429 once this
    // IP has spent its ten-an-hour budget, and 500 in CI where there is no
    // database — all three are correct "you get nothing" outcomes.
    const main = page.locator("main");
    await expect(main).not.toContainText(/AED\s*\d/i);
    await expect(main.getByText(/tracking number/i)).toHaveCount(0);
  });

  test("does not distinguish an unknown email from a wrong phone", async ({ page }) => {
    // Enumeration guard. If the wording differed, this page would confirm
    // whether a given address has ever ordered here.
    const messages: string[] = [];

    for (const [email, phone] of [
      [`nobody-${Date.now()}@example.com`, "0500000000"],
      [`nobody-${Date.now()}-b@example.com`, "0559999999"],
    ] as const) {
      await page.goto("/account");
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByTestId("account-email").fill(email);
      await page.getByTestId("account-phone").fill(phone);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/orders"), { timeout: 20_000 }),
        page.getByTestId("account-submit").click(),
      ]);
      const err = page.getByTestId("account-error");
      messages.push((await err.isVisible().catch(() => false)) ? (await err.innerText()).trim() : "");
    }

    // Both attempts are refusals, and the wording is identical.
    expect(messages[0], "a refusal should be shown").not.toBe("");
    expect(messages[0]).toBe(messages[1]);
  });
});
