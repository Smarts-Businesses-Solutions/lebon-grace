import { test, expect } from "@playwright/test";

/**
 * What the newsletter form promises after you sign up (NS-02).
 *
 * The audit's recommended wording was "No confirmation email or regular
 * schedule yet" — correct when it was written, and wrong now. B-43 added double
 * opt-in, so a confirmation e-mail IS sent and the address is PENDING until the
 * link in it is clicked. Copying the audit's suggestion verbatim would have
 * shipped a fresh lie.
 *
 * The live copy is worse than the audit realised. "You are on the list" is
 * false: nobody is on the list until they confirm. A subscriber who reads it
 * and never opens the e-mail believes they signed up, hears nothing ever, and
 * concludes the shop is dead — which is exactly the impression the message is
 * trying to avoid creating.
 *
 * The API is intercepted rather than called. A real POST would write a pending
 * row and send mail on every CI run, which is the same objection that kept the
 * order lifecycle manual until TR-03.
 */

test.describe("newsletter sign-up sets honest expectations", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/newsletter", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' })
    );
  });

  async function subscribe(page: import("@playwright/test").Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    /*
     * Wait for React to hydrate before touching the form.
     *
     * Without this, Enter reaches a form whose onSubmit handler is not attached
     * yet, the browser does a NATIVE submit, the page navigates away, and the
     * success state never renders — which reads exactly like the copy being
     * wrong. It cost a debugging round: driving the same page by hand with a
     * 1.2s settle produced the right text every time.
     *
     * Waiting on `load` is not an option here: an analytics request never
     * settles locally, so that event never fires (see scripts/adversarial-sweep).
     * The submit button becoming enabled is a hydration signal that comes from
     * the component itself.
     */
    const submit = page.getByRole("button", { name: /join|subscribe|sign up|→/i }).last();
    await submit.waitFor({ state: "visible" });
    await expect(submit).toBeEnabled();

    const email = page.locator('input[type="email"]').last();
    await email.scrollIntoViewIfNeeded();
    await email.fill("someone@example.invalid");
    await submit.click();
    await expect(page.getByText(/almost there|check your inbox/i)).toBeVisible({ timeout: 5000 });
  }

  test("does not claim the subscriber is already on the list", async ({ page }) => {
    await subscribe(page);
    const body = (await page.locator("body").innerText()).toLowerCase();

    expect(body, "PRECONDITION: the success state rendered").toMatch(/inbox|confirm|check your/);
    // The specific falsehood: they are pending, not subscribed.
    expect(body).not.toContain("you are on the list");
  });

  test("tells the subscriber to go and confirm", async ({ page }) => {
    await subscribe(page);
    const body = (await page.locator("body").innerText()).toLowerCase();

    // Without this the double opt-in is a trap: an unconfirmed address never
    // receives anything and the person has no idea why.
    expect(body, "must point at the confirmation e-mail").toMatch(/check your (inbox|e-?mail)/);
    expect(body).toMatch(/confirm/);
  });

  test("sets an expectation about frequency", async ({ page }) => {
    await subscribe(page);
    const body = (await page.locator("body").innerText()).toLowerCase();

    // The original NS-02: an open-ended promise reads as a broken signup to
    // someone waiting for a welcome message that is never coming.
    // NOT /when there is/ — the unfixed copy says "when there is something new",
    // so that alternative made this test pass against the very wording it was
    // written to replace. An assertion that matches the bug is decoration.
    expect(body).toMatch(/only (write|email)|never on a schedule|no schedule/);
  });
});
