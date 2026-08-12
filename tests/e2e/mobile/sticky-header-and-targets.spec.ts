import { test, expect } from "@playwright/test";

/**
 * Two mobile-touch defects that a desktop viewport cannot show you.
 *
 * EN-02 — the sticky header sits over the focused contact field. Measured at
 * 65px of overlap on a 393x852 phone, 0 on desktop. You can type a long
 * enquiry and not see the part you are typing, because the header is on top of
 * it. The audit asked for exactly this assertion.
 *
 * The 20x20 footer icon — found by the adversarial sweep, and the only real
 * finding out of the 1,901 it first reported. WCAG 2.2 SC 2.5.8 puts the
 * minimum target at 24x24 CSS px. Its aria-label is correct; the target is
 * simply too small for a thumb.
 *
 * Both are geometric, so they are asserted geometrically. A screenshot would
 * show them too, but only to someone who looks.
 */

const PHONE = { width: 393, height: 852 };

test.describe("mobile touch and overlap", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("EN-02: the focused message field is not under the sticky header", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" });

    const header = page.locator("header").first();
    const message = page.locator("textarea[name=message]");

    await expect(message, "PRECONDITION: the contact form rendered").toBeVisible();
    await expect(header, "PRECONDITION: the header is present to overlap with").toBeVisible();

    // Focus, then let the browser do whatever scrolling it does on focus. That
    // is the moment the bug appears: the field scrolls up and the sticky header
    // lands on top of it.
    await message.focus();
    // scrollIntoView({block:"start"}) — NOT scrollIntoViewIfNeeded().
    //
    // "IfNeeded" does nothing when the field is already on screen, so the first
    // version of this test passed against the unfixed page and proved nothing.
    // Aligning the element to the top of the viewport is the state the audit
    // measured (65px of overlap) and the state a browser produces when it
    // scrolls a focused field up on a small screen — which is exactly when the
    // sticky header lands on top of it.
    await message.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);

    const h = await header.boundingBox();
    const m = await message.boundingBox();
    expect(h && m, "both elements should have a box").toBeTruthy();

    // The overlap that matters: how far the header reaches past the field's top.
    const overlap = Math.max(0, h!.y + h!.height - m!.y);
    expect(
      overlap,
      `the sticky header covers the top ${Math.round(overlap)}px of the focused message field`
    ).toBeLessThanOrEqual(0);
  });

  test("EN-02: every contact field clears the header when focused", async ({ page }) => {
    // The textarea is the one the audit measured, but the same sticky header
    // sits over any field the browser scrolls to. Fixing only the one that was
    // reported is how the next one gets found in production.
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    const header = page.locator("header").first();
    const h = await header.boundingBox();

    const fields = ["input[name=name]", "input[name=email]", "input[name=phone]", "select[name=subject]"];
    for (const sel of fields) {
      const el = page.locator(sel);
      if (!(await el.count())) continue;
      await el.first().focus();
      await el.first().evaluate((node) => node.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(200);
      const b = await el.first().boundingBox();
      if (!b) continue;
      const overlap = Math.max(0, h!.y + h!.height - b.y);
      expect(overlap, `${sel} is ${Math.round(overlap)}px under the sticky header`).toBeLessThanOrEqual(0);
    }
  });

  test("the footer contact icon is a big enough tap target", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const link = page.getByRole("link", { name: "Contact us" }).first();
    await link.scrollIntoViewIfNeeded();

    const box = await link.boundingBox();
    expect(box, "PRECONDITION: the footer contact link exists").toBeTruthy();

    // WCAG 2.2 SC 2.5.8 — Target Size (Minimum), AA.
    expect(box!.width, `tap target is ${Math.round(box!.width)}px wide`).toBeGreaterThanOrEqual(24);
    expect(box!.height, `tap target is ${Math.round(box!.height)}px tall`).toBeGreaterThanOrEqual(24);
  });
});
