import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import manifest from "./manifest";

/**
 * A web app manifest fails quietly by design.
 *
 * Point it at an icon that does not exist and the browser installs the app with
 * a blank square. Point a shortcut at a route that was renamed and the user
 * gets a 404 from their own home screen. Nothing throws, nothing logs, and the
 * build is green. So the things asserted here are the ones with a file or a
 * route on the other end of them.
 */

const m = manifest();
const PUBLIC = path.join(process.cwd(), "public");
const APP = path.join(process.cwd(), "src", "app");

describe("the icons", () => {
  it("all exist in public/", () => {
    // Asserted non-empty first. A `for` over an empty list passes without
    // checking anything, so a manifest that lost its icons entirely would read
    // as a green test rather than a broken install.
    expect(m.icons?.length).toBeGreaterThan(0);

    for (const icon of m.icons ?? []) {
      expect(existsSync(path.join(PUBLIC, icon.src)), `missing ${icon.src}`).toBe(true);
    }
  });

  it("declares a maskable icon, and not the same file as the plain one", () => {
    /*
     * The common mistake is listing one icon twice with both purposes. A
     * launcher masks a maskable icon to its own shape and keeps the middle 80%,
     * so an icon that draws its own rounded corners loses them and gets its
     * content clipped. The two have to be different drawings.
     */
    const any = (m.icons ?? []).filter((i) => i.purpose === "any").map((i) => i.src);
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable").map((i) => i.src);

    expect(maskable.length).toBeGreaterThan(0);
    expect(any.some((src) => maskable.includes(src))).toBe(false);
  });

  it("offers both sizes Android asks for", () => {
    // 192 for the launcher, 512 for the splash screen. Chrome will refuse to
    // treat the app as installable without both.
    const sizes = new Set((m.icons ?? []).map((i) => i.sizes));
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
  });
});

describe("where it opens", () => {
  it("starts inside its own scope", () => {
    // A start_url outside scope makes the app open in a browser tab instead of
    // the standalone window, which looks like the install silently failed.
    expect(m.start_url?.startsWith(m.scope ?? "/")).toBe(true);
  });

  it("tags the start url, so a home screen open is not counted as direct", () => {
    // An installed app sends no referrer. Without this every launch lands in
    // Umami as direct traffic and there is no way to tell anyone installed it.
    expect(m.start_url).toContain("utm_source=pwa");
  });

  it("points every shortcut at a route that exists", () => {
    expect(m.shortcuts?.length).toBeGreaterThan(0);

    for (const s of m.shortcuts ?? []) {
      const route = s.url.split("?")[0].replace(/^\//, "");
      const page = path.join(APP, route, "page.tsx");
      expect(existsSync(page), `${s.url} has no page at ${page}`).toBe(true);
    }
  });
});

describe("the copy a customer sees", () => {
  it("uses no em dashes", () => {
    // House rule for anything a reader sees. The manifest name and description
    // are shown in the install prompt and under the home screen icon, which is
    // about as reader-facing as copy gets.
    const copy = [m.name, m.short_name, m.description, ...(m.shortcuts ?? []).flatMap((s) => [s.name, s.description])];
    for (const line of copy) {
      expect(line ?? "", `em dash in: ${line}`).not.toMatch(/[—–]/);
    }
  });

  it("keeps the short name short enough for a launcher", () => {
    // Android truncates around 12 characters. Longer is not an error, it is a
    // name nobody can read under the icon.
    expect((m.short_name ?? "").length).toBeLessThanOrEqual(12);
  });
});
