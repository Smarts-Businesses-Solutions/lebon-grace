import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The contact number is configuration, not source.
 *
 * This repository is PUBLIC on GitHub. Keeping the number out of the served
 * HTML while committing it to public source protects nothing: GitHub code
 * search is itself a harvesting channel. So the number reaches the app through
 * the environment only, and these tests hold that line.
 */

const load = async () => {
  vi.resetModules();
  return import("./route");
};

const req = () => new Request("http://localhost/api/contact/reveal") as never;

describe("GET /api/contact/reveal", () => {
  const saved = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...saved }; });

  it("serves the number configured in the environment", async () => {
    process.env.CONTACT_WHATSAPP = "971528399804";
    process.env.CONTACT_PHONE_DISPLAY = "+971 52 839 9804";

    const { GET } = await load();
    const body = await (await GET(req())).json();

    expect(body.phone).toBe("+971 52 839 9804");
    expect(body.whatsapp).toContain("wa.me/971528399804");
  });

  it("OMITS phone and whatsapp when unconfigured rather than inventing one", async () => {
    delete process.env.CONTACT_WHATSAPP;
    delete process.env.CONTACT_PHONE_DISPLAY;

    const { GET } = await load();
    const res = await GET(req());
    const body = await res.json();

    // The endpoint must still answer. A missing number degrades the contact
    // options; it does not take the shop down.
    expect(res.status).toBe(200);
    expect(body.email).toBeTruthy();

    // Absent, not null. `href="null"` is a broken link that looks deliberate.
    expect("phone" in body).toBe(false);
    expect("whatsapp" in body).toBe(false);
  });

  it("never lands in a search index", async () => {
    const { GET } = await load();
    const res = await GET(req());
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("no contact number is committed to this public repo", () => {
  /**
   * The regression this exists for is someone reintroducing a literal, which is
   * exactly what happened before: the number was a default in contact.ts, a
   * hardcoded wa.me link in the cart-recovery email, and a retired number left
   * in a comment. All three read as harmless in review.
   *
   * Test fixtures are exempt. They use reserved-looking numbers on purpose and
   * a test needs a value to assert against.
   */
  const SRC = path.join(process.cwd(), "src");

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });

  it("has no UAE mobile number anywhere in src/, comments included", () => {
    // 971 followed by 8 or 9 digits, which covers every UAE mobile format.
    const PATTERN = /971\d{8,9}/g;

    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      for (const hit of text.match(PATTERN) ?? []) {
        offenders.push(`${path.relative(process.cwd(), file)}: ${hit}`);
      }
    }

    expect(
      offenders,
      `A phone number is committed to source. This repo is public.\n` +
      `Move it to CONTACT_WHATSAPP in the environment instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
