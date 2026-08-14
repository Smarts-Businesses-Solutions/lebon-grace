import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A sibling npm project inside this repo must be excluded from the root
 * tsconfig, or it breaks the production build only.
 *
 * This is a real outage, not a hypothetical. remotion-launch/ is its own npm
 * project with its own node_modules, which is gitignored. Its sources import
 * `remotion`, a package the shop has never depended on. `next build` type-checks
 * everything the root tsconfig includes, so it tried to check those files:
 *
 *   remotion-launch/src/Root.tsx: error TS2307: Cannot find module 'remotion'
 *
 * Locally that resolves, because the film workspace's node_modules is sitting
 * right there on disk. In the container it does not exist, so the build dies.
 * Every deploy failed for a day and a half while `npm run build` and `tsc` both
 * passed on the developer machine, which is the worst possible signature: green
 * locally, broken in production, with nothing in between to catch it.
 *
 * The same trap already caught ops/qa once. This test exists so the third one
 * fails here, in a second, instead of in a deploy.
 */

const ROOT = process.cwd();

/** Directories that legitimately contain a package.json we must not police. */
const IGNORED = [
  "node_modules",
  ".next",       // build output, including .next/standalone
  ".claude",     // git worktrees hold a full copy of the repo
  ".git",
];

const findSiblingProjects = (dir: string, depth = 0): string[] => {
  if (depth > 3) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED.includes(entry.name)) continue;
    const child = path.join(dir, entry.name);
    if (fs.existsSync(path.join(child, "package.json"))) {
      out.push(path.relative(ROOT, child).replace(/\\/g, "/"));
      // Do not descend: the whole subtree belongs to that project.
      continue;
    }
    out.push(...findSiblingProjects(child, depth + 1));
  }
  return out;
};

describe("sibling npm projects are excluded from the root tsconfig", () => {
  it("every nested package.json sits under an excluded path", () => {
    /*
     * Read the exclude list textually rather than with JSON.parse.
     *
     * tsconfig allows comments, so parsing means stripping them first, and a
     * naive block-comment strip is actively wrong here: `/**\/` inside a glob
     * like ".next/types/**\/*.ts" opens and closes a comment, so the stripper
     * eats a chunk of real config and JSON.parse then fails on the wreckage.
     * That is exactly what the first version of this test did.
     *
     * Pulling the quoted strings out of the exclude block sidesteps the whole
     * problem and is all this assertion needs.
     */
    const raw = fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8");
    const start = raw.indexOf('"exclude"');
    expect(start, "tsconfig.json has no exclude array").toBeGreaterThan(-1);

    const block = raw.slice(start, raw.indexOf("]", start));
    const exclude = block
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n")
      .match(/"([^"]+)"/g)
      ?.map((s) => s.slice(1, -1))
      .filter((s) => s !== "exclude") ?? [];

    const covered = (project: string) =>
      exclude.some((rule) => {
        const base = rule.replace(/\/\*\*$/, "").replace(/\/\*$/, "").replace(/\/$/, "");
        return project === base || project.startsWith(`${base}/`);
      });

    const unguarded = findSiblingProjects(ROOT).filter((p) => !covered(p));

    expect(
      unguarded,
      `These directories are separate npm projects with their own dependencies,\n` +
      `but the root tsconfig still type-checks them. Their node_modules is not\n` +
      `present in the production image, so \`next build\` will fail there while\n` +
      `passing locally. Add each to "exclude" in tsconfig.json:\n  ${unguarded.join("\n  ")}`,
    ).toEqual([]);
  });
});
