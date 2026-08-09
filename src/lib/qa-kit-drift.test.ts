import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, relative, join, sep } from "node:path";

/**
 * The E2E harness must live INSIDE this repository, and its vendored copy must
 * not drift from the shared kit.
 *
 * `playwright.config.ts` imported `../ops/qa/playwright.base.config` and
 * `tests/e2e/navigation/smoke.spec.ts` imported `../../../../ops/qa/smoke-suite`
 * — both OUTSIDE this repo, into a sibling directory that exists only on the
 * operator's workstation. Locally they resolve; a clone does not. The entire
 * E2E suite had therefore never been runnable anywhere but one machine.
 *
 * Both were found one CI round apart, which is the point of the third test
 * below: fixing instances one at a time is not fixing the class. That test
 * resolves every relative import in the harness and fails if any of them lands
 * outside the repository root, so the next one is caught here in a second
 * rather than six minutes into a pipeline (L-8: fix the layer that makes the
 * failure impossible).
 *
 * Vendoring buys portability and costs the risk of silent divergence, so the
 * drift check spends the difference. It SKIPS rather than fails when the shared
 * kit is unreachable: in CI it is absent by definition, and a test that went red
 * there would make every run red for a condition that is correct.
 *
 * Line endings are normalised — this repo checks out CRLF on Windows while the
 * kit is LF, and a raw comparison would report drift on every line.
 */

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const VENDORED_DIR = join(REPO_ROOT, "ops", "qa");
// aprojects/ops/qa — one level above the repo root.
const SHARED_DIR = resolve(REPO_ROOT, "..", "ops", "qa");

const norm = (s: string) => s.replace(/\r\n/g, "\n");
const vendoredFiles = () =>
  existsSync(VENDORED_DIR) ? readdirSync(VENDORED_DIR).filter((f) => f.endsWith(".ts")) : [];

describe("vendored QA kit", () => {
  it("is present in the repo, so a clone can run its own E2E suite", () => {
    // Precondition. Without it "no drift" below passes happily on a repo that
    // vendors nothing at all — the absence-proves-nothing trap (L-2).
    const files = vendoredFiles();
    expect(files.length, `ops/qa must contain the vendored kit; found ${files.length} .ts files`)
      .toBeGreaterThanOrEqual(3);
    // The three the harness actually imports.
    for (const required of ["playwright.base.config.ts", "guards.ts", "smoke-suite.ts"]) {
      expect(files, `ops/qa/${required} must be committed`).toContain(required);
    }
  });

  it("matches the shared kit file for file, when the shared kit is reachable", (ctx) => {
    if (!existsSync(SHARED_DIR)) {
      ctx.skip(); // CI, or any clone without the sibling workspace. Correct, not broken.
      return;
    }
    for (const f of vendoredFiles()) {
      const sharedPath = join(SHARED_DIR, f);
      if (!existsSync(sharedPath)) continue; // vendored-only file; nothing to compare against
      const vendored = norm(readFileSync(join(VENDORED_DIR, f), "utf8"));
      const shared = norm(readFileSync(sharedPath, "utf8"));
      expect(
        vendored === shared,
        `ops/qa/${f} has drifted from ${sharedPath}.\n` +
          `Copy the shared kit down (or port the change up), then re-run.\n` +
          `vendored=${vendored.length} chars, shared=${shared.length} chars.`
      ).toBe(true);
    }
  });

  it("has no import anywhere in the harness that escapes the repository", () => {
    // The actual invariant. Two separate escapes shipped before this existed,
    // and each was found by a different CI failure six minutes apart.
    const roots = [join(REPO_ROOT, "tests"), VENDORED_DIR];
    const files: string[] = [join(REPO_ROOT, "playwright.config.ts")];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith(".ts")) files.push(p);
      }
    };
    roots.forEach(walk);

    // Precondition: we are actually looking at files. A walk that found nothing
    // would report "no escapes" just as cheerfully.
    expect(files.length, "expected to scan the E2E harness").toBeGreaterThan(3);

    const offences: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Only real import/export statements — a `../../../../ops/qa/...` inside a
      // comment is documentation, and both kit files carry exactly that.
      const re = /^\s*(?:import|export)[^"']*["'](\.[^"']+)["']/gm;
      for (const m of src.matchAll(re)) {
        const target = resolve(dirname(file), m[1]);
        const rel = relative(REPO_ROOT, target);
        if (rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
          offences.push(`${relative(REPO_ROOT, file)} imports "${m[1]}" -> outside the repo`);
        }
      }
    }

    expect(
      offences,
      `These imports resolve outside the repository, so they work only on a machine ` +
        `that happens to have the sibling directory. Vendor the dependency into ops/qa ` +
        `instead:\n  ${offences.join("\n  ")}`
    ).toEqual([]);
  });
});
