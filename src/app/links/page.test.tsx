import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import path from "node:path";
import LinksPage, { metadata } from "./page";

/**
 * A bio landing page fails in ways nobody notices for weeks.
 *
 * It lives at the end of a link in a profile nobody on the team clicks. A
 * button pointing at a renamed route 404s silently; a lost UTM tag turns every
 * click into unattributed traffic; the page getting indexed quietly competes
 * with the real pages for the same terms. None of that shows up in the shop.
 *
 * So what is pinned here is the four things that would go wrong unseen.
 */

// WhatsAppLink is a client component that fetches the number on click. Mocked
// to a plain button so the page renders to static markup without a DOM, the
// same approach as the design queue tests.
vi.mock("@/components/WhatsAppLink", () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button className={className}>{children}</button>
  ),
}));

const html = renderToStaticMarkup(<LinksPage />);
const APP = path.join(process.cwd(), "src", "app");

/**
 * Every href the page renders.
 *
 * Unescaped first. React writes `&` as `&amp;` in an attribute, so parsing the
 * raw string with `new URL` returns one parameter named `amp;utm_medium` and
 * null for everything after the first `&`. The uniqueness check below then
 * compares three nulls, finds them identical, and reports a real failure for a
 * fake reason.
 */
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

describe("where the buttons go", () => {
  it("points every button at a route that exists", () => {
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const route = href.split("?")[0].replace(/^\//, "");
      expect(existsSync(path.join(APP, route, "page.tsx")), `${href} has no page`).toBe(true);
    }
  });

  it("tags every button, so a tap is attributable to this page", () => {
    /*
     * The tags are the entire reason this is a first-party page rather than a
     * Linktree. X wraps outbound links in t.co and the referrer arrives blank,
     * so an untagged button is a click nobody can account for.
     */
    for (const href of hrefs) {
      expect(href, `${href} carries no source`).toContain("utm_source=links");
      expect(href, `${href} carries no content tag`).toContain("utm_content=");
    }
  });

  it("gives each button its own content tag, or the report says nothing", () => {
    // Two buttons sharing a tag is the same as having no tags: the whole point
    // is learning which one people press.
    const contents = hrefs.map((h) => new URL(h, "https://x.test").searchParams.get("utm_content"));
    expect(new Set(contents).size).toBe(contents.length);
  });
});

describe("what the page must not do", () => {
  it("stays out of the index", () => {
    // A doorway page with no content of its own, whose every destination is
    // already indexed on its own page. Letting it rank competes with them.
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("never puts the phone number in the markup", () => {
    /*
     * This is the single most scraped URL the shop will have: a link sitting
     * in a public profile. The number is fetched on click from
     * /api/contact/reveal and must not appear here in any form.
     */
    const digits = html.replace(/\D/g, "");
    expect(digits).not.toContain("528399804");
    expect(html).not.toContain("wa.me");
  });

  it("uses no em dashes, like every other reader-facing page", () => {
    expect(html).not.toMatch(/[—–]/);
  });
});
