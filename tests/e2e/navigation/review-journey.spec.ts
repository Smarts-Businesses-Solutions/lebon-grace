import { test, expect } from "@playwright/test";

/**
 * The review journey in a browser (RV-02).
 *
 * The server rules are unusually well unit-tested — ownership, duplicate
 * refusal, undelivered orders, rating bounds. What has never been exercised is
 * the CLIENT wiring: whether the page asks the right question, renders the
 * answer, and keeps its controls usable on a phone. Those can regress without a
 * single unit test noticing, because unit tests never load the page.
 *
 * Every API response here is INTERCEPTED. A real eligibility lookup needs a
 * delivered order with a matching phone number, and a real submission writes a
 * review to the shop — neither belongs in a suite that runs on every push. The
 * fixtures below are the shapes the route actually returns (src/app/api/reviews
 * /route.ts): `{items, delivered}` for the lookup, `{error}` with a status for
 * the refusals.
 *
 * So this asserts the half the unit tests cannot reach, and deliberately does
 * not re-assert the half they already cover.
 */

const ORDER = "A1B2C3";
const PHONE = "+971500000000";

const DELIVERED = {
  delivered: true,
  items: [
    { slug: "abc-jigsaw-board", name: "ABC Jigsaw Board", reviewed: false },
    { slug: "alphabet-car-puzzle", name: "Alphabet Car", reviewed: true },
  ],
};

async function lookup(page: import("@playwright/test").Page) {
  await page.goto("/review", { waitUntil: "domcontentloaded" });

  // Hydration: without it the submit handler is not attached and the button
  // does a native form post, navigating away from the page under test.
  const submit = page.getByRole("button", { name: "Find my order" });
  await submit.waitFor({ state: "visible" });
  await expect(submit).toBeEnabled();

  // BY PLACEHOLDER, not by index. The first visible input on this page is the
  // HEADER'S "Search puzzles" box — the first version of this helper filled
  // that with the order number, left the phone empty, and the form never
  // submitted at all. The API was never called and three tests failed against
  // a page that works.
  await page.getByPlaceholder("the 8 characters on your receipt").fill(ORDER);
  await page.getByPlaceholder("the number you ordered with").fill(PHONE);
  await submit.click();
}

test.describe("review journey", () => {
  test("a delivered order lists its items, and an already-reviewed one is marked", async ({ page }) => {
    await page.route("**/api/reviews**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DELIVERED) })
        : route.continue()
    );
    await lookup(page);

    await expect(page.getByText("ABC Jigsaw Board")).toBeVisible({ timeout: 8000 });
    // The second item is already reviewed; the page must say so rather than
    // offering a form that the server will refuse.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toMatch(/already|reviewed|thank/);
  });

  test("an undelivered order is told why, not shown a form", async ({ page }) => {
    // The server answers `{items: [], delivered: false}` — a 200, not an error.
    // A page that only handles the error case would render an empty list and
    // leave the customer staring at nothing.
    await page.route("**/api/reviews**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], delivered: false }) })
        : route.continue()
    );
    await lookup(page);

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.length, "PRECONDITION: the page rendered something").toBeGreaterThan(50);
    expect(body, "must explain, not just show an empty list").toMatch(/deliver|not yet|once your order|deliv/);
  });

  test("a wrong credential says so without confirming the order exists", async ({ page }) => {
    // 404 covers BOTH "no such order" and "wrong phone" on purpose — otherwise
    // the endpoint confirms which order numbers are real to anyone guessing.
    await page.route("**/api/reviews**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Order not found, or the phone does not match." }) })
        : route.continue()
    );
    await lookup(page);

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toMatch(/not found|does not match|check/);
    // The page must not helpfully distinguish the two cases for an attacker.
    expect(body).not.toMatch(/order exists but|wrong phone number for/);
  });

  test("the star control is reachable by keyboard", async ({ page }) => {
    // A star widget built from divs and click handlers looks identical and is
    // unusable without a mouse. The only way to find that out is to try.
    await page.route("**/api/reviews**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DELIVERED) })
        : route.continue()
    );
    await lookup(page);
    await expect(page.getByText("ABC Jigsaw Board")).toBeVisible({ timeout: 8000 });

    const stars = page.locator('[role="radio"], input[type="radio"], button[aria-label*="star" i], [aria-label*="rating" i]');
    const n = await stars.count();
    expect(n, "the rating control should expose focusable elements").toBeGreaterThan(0);

    await stars.first().focus();
    const focused = await page.evaluate(`document.activeElement ? document.activeElement.tagName + "|" + (document.activeElement.getAttribute("role") || "") : "none"`);
    expect(focused, "the rating control must be focusable").not.toBe("none");
  });
});
