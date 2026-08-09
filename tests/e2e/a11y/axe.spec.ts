/**
 * MASTER-QA-PROTOCOL §4 — accessibility, against the RENDERED DOM.
 *
 * `npm run audit:contrast` already checks colour pairs with the WCAG 2.1
 * arithmetic, but it checks the pairs someone remembered to list. This checks
 * what the browser actually painted, which is a different question — and the
 * first run answered it: 51 failing nodes the static audit could not have seen,
 * because that audit only ever enumerated the ADMIN palette while the storefront
 * used `text-ink-muted` for small text everywhere.
 *
 * Both are kept. The static one is fast, runs without a browser, and catches a
 * bad pair before it ships. This one catches the pair nobody thought to list.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sitemap from "../../fixtures/sitemap.json";

/**
 * WCAG 2.0/2.1 levels A and AA. Deliberately not `best-practice`: those are
 * opinions worth reading, not a release gate, and a gate that mixes rules you
 * must fix with rules you might is one people learn to ignore.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Routes the crawl cannot reach, added explicitly. */
const EXTRA = ["/shop/abc-jigsaw-board"];

const ROUTES = [...sitemap.routes.filter((r: string) => r !== "/admin"), ...EXTRA];

for (const route of ROUTES) {
  test(`${route} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);

    // Entrance animations fade opacity in, and axe samples whatever is on
    // screen at that instant — a paragraph mid-fade measured #857e75 rather
    // than its settled #6f685e and failed on a colour the design never uses.
    // Freezing animation makes the result about the design, not the timing.
    await page.addStyleTag({
      content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}`,
    });

    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    // Failure message names the rule, the ratio and the element, so a red run
    // is actionable without opening the trace.
    const detail = violations
      .flatMap((v) =>
        v.nodes.map(
          (n) =>
            `[${v.impact}] ${v.id} — ${(n.any[0]?.message || n.all[0]?.message || "").replace(/\s+/g, " ")}\n      ${n.html.replace(/\s+/g, " ").slice(0, 120)}`
        )
      )
      .join("\n\n");

    expect(detail, `accessibility violations on ${route}`).toBe("");
  });
}

test("/admin login screen has no WCAG A/AA violations", async ({ page }) => {
  // Separated because everything past the password prompt needs a session; the
  // prompt itself is still a public page and is exactly where a stuck or
  // unlabelled control would strand someone.
  await page.goto("/admin");
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}`,
  });
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.impact} ${v.id}`).join(", "), "violations on /admin").toBe("");
});
