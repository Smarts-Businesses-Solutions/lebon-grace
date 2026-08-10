import { test, expect } from "@playwright/test";

/**
 * Signing in to /admin as a named operator, in a real browser (AD-02).
 *
 * The unit tests pin the credential logic; this pins the part they cannot — that
 * the form the operator actually sees is wired to it. A login route that works
 * perfectly behind a form with no e-mail field is not a working login.
 *
 * Requires a server started with ADMIN_USERS set, which the default suite is
 * not. Run it with:
 *
 *   node scripts/e2e-admin-login.mjs
 *
 * …which starts a throwaway server on its own port with a throwaway operator,
 * so nothing here depends on — or touches — the real credentials.
 *
 * That runner pins it to the desktop project on purpose. The route allows 5
 * login attempts per 15 minutes per IP and every Playwright project runs from
 * 127.0.0.1, so running all three fired 12 logins from one address and the tail
 * of them were throttled — a correct rate limit reading as a broken login. The
 * credential wiring does not vary by viewport, so one project is the honest
 * amount of coverage here.
 */

const EMAIL = "test.operator@example.com";
const PASSWORD = "throwaway-test-password-123";

test.describe("named operator login", () => {
  test("asks for an e-mail once operators are configured", async ({ page }) => {
    await page.goto("/admin");

    const emailField = page.locator('input[type="email"]');
    const passwordField = page.locator('input[type="password"]');

    // Both, and in that order. The precondition matters: a page that failed to
    // render would satisfy "no dashboard visible" just as well as a correct one.
    await expect(passwordField, "PRECONDITION: the login form rendered").toBeVisible();
    await expect(emailField).toBeVisible();
  });

  test("lets the right credentials in", async ({ page }) => {
    await page.goto("/admin");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // The dashboard, not the form.
    await expect(page.locator('input[type="password"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /sign in/i })).toBeHidden();
  });

  test("keeps the wrong ones out, and says nothing useful about why", async ({ page }) => {
    await page.goto("/admin");
    await page.locator('input[type="email"]').fill("stranger@example.com");
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Still on the form.
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // And the message must not reveal WHICH half was wrong — otherwise this
    // page enumerates operator addresses for anyone who asks.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("no such user");
    expect(body).not.toContain("unknown e-mail");
    expect(body).not.toContain("wrong password");
  });

  test("the session cookie is not readable by page scripts", async ({ page, context }) => {
    await page.goto("/admin");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator('input[type="password"]')).toBeHidden({ timeout: 15_000 });

    const cookie = (await context.cookies()).find((c) => c.name === "lg_admin");
    expect(cookie, "PRECONDITION: a session was actually issued").toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);

    // The check that matters: XSS on this page must not be able to steal the
    // session. `document.cookie` is the exact API an injected script would use.
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("lg_admin");
  });
});
