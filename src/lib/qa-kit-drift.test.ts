import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The vendored QA kit must not drift from the shared one.
 *
 * `playwright.config.ts` used to import `../ops/qa/playwright.base.config` — a
 * path OUTSIDE this repository, into a sibling directory that exists only on the
 * operator's workstation. Locally that resolves; a clone does not, and CI died
 * with `Cannot find module '../ops/qa/playwright.base.config'` the first time it
 * got as far as the Playwright step.
 *
 * That made the entire E2E suite unrunnable anywhere but one machine, and it
 * went unnoticed because no project in this estate had ever run Playwright in
 * CI — vouchnexus's pipeline, the only green one, is typecheck + unit.
 *
 * The kit is now vendored at ops/qa/. Vendoring buys portability and costs the
 * risk of silent divergence, so this test spends the difference: when the shared
 * copy is reachable it must match byte for byte.
 *
 * Deliberately SKIPS rather than fails when the shared kit is absent. In CI it
 * is absent by definition, and a test that fails there would make every run red
 * for a condition that is correct. Skipping is honest; the assertion only has
 * meaning where both files exist.
 *
 * Line endings are normalised before comparing: this repo checks out CRLF on
 * Windows while the shared kit is LF, and a whole-file comparison would
 * otherwise report drift on every single line. mirrortales hit exactly this and
 * pinned its vendored kit to LF; normalising here needs no .gitattributes to be
 * remembered.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const VENDORED = new URL("../../ops/qa/playwright.base.config.ts", import.meta.url);
// aprojects/ops/qa — one level above the repo root.
const SHARED = new URL("../../../ops/qa/playwright.base.config.ts", import.meta.url);

const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("vendored QA kit", () => {
  it("is present in the repo, so a clone can run its own E2E suite", () => {
    // The precondition. Without it, "no drift" below would pass happily on a
    // repo that vendors nothing at all — the exact absence-proves-nothing trap
    // that voided two findings on 2026-08-09.
    expect(
      existsSync(VENDORED),
      "ops/qa/playwright.base.config.ts must be committed — playwright.config.ts imports it"
    ).toBe(true);
  });

  it("matches the shared kit, when the shared kit is reachable", (ctx) => {
    if (!existsSync(SHARED)) {
      ctx.skip(); // CI, or any clone without the sibling workspace. Correct, not broken.
      return;
    }
    const vendored = norm(readFileSync(VENDORED, "utf8"));
    const shared = norm(readFileSync(SHARED, "utf8"));

    expect(
      vendored === shared,
      `ops/qa/playwright.base.config.ts has drifted from ${fileURLToPath(SHARED)}.\n` +
        `Copy the shared kit over the vendored one (or port the change back), then re-run.\n` +
        `vendored=${vendored.length} chars, shared=${shared.length} chars.`
    ).toBe(true);
  });

  it("still exports makeBaseConfig, which playwright.config.ts calls", () => {
    // Cheap shape check: a vendored copy that silently loses its export would
    // otherwise only fail at Playwright load time, which is 20 minutes into CI.
    const src = readFileSync(VENDORED, "utf8");
    expect(src).toMatch(/export\s+(function|const)\s+makeBaseConfig/);
    expect(here).toBeTruthy();
  });
});
