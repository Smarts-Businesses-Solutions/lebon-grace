import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * A guard against documents that quietly go on giving instructions for a system
 * that no longer exists.
 *
 * This repository is PUBLIC, and its markdown is the first thing anyone reads,
 * including whoever picks the project up next. SESSION_RESUME.md opened with
 * "Read this FIRST in any new session" and then described a Hostinger app, a
 * JSON file store and a PHP proxy, none of which had existed for six weeks.
 * Following it would have sent someone to deploy to a dead platform.
 *
 * WHY A TEST AND NOT A CLEANUP. This was cleaned up once already: a commit on
 * 2026-08-10 titled "flag the two files that would mislead a reader" bannered
 * exactly two of the nine that needed it. That is the same failure the copy
 * rule had — the fix reaches the files someone happened to open, and the rest
 * keep their instructions. So the rule lives where every path goes through it.
 *
 * It does NOT ask for the documents to be rewritten. The Hostinger guides are
 * an accurate record of a decision that was real at the time, and falsifying
 * them to match today would destroy the only account of why the project moved.
 * All it asks is that a superseded document says so at the top.
 */

/**
 * Things that stopped being true. A file may talk about them all it likes, as
 * long as it admits it is history.
 */
const DEAD = /hostinger|\.data\/store\.json/i;

/** How far in the banner must appear. Below the fold is not a warning. */
const BANNER_LINES = 12;
const BANNER = /superseded|obsolete|historic|no longer (used|current)|do not (deploy|resume)/i;

/**
 * Files that discuss the dead platform in order to say it is dead.
 *
 * README's mentions are the sentence "Not Vercel, not Supabase cloud, not
 * Hostinger" and a paragraph explaining what replaced it, which is exactly the
 * behaviour this test wants and would be absurd to demand a banner for.
 */
const NEGATIVE_BY_DESIGN = new Set([
  "README.md", // "Not Vercel, not Supabase cloud, not Hostinger", plus what replaced it
  "DECISIONS.md",
  "CLAUDE.md",
  "ACTION_PLAN.md", // names the scripts/archive/ftp-deploy/ folder the cruft went into
  "CODEBASE_AUDIT.md", // the audit that IDENTIFIED the stale Hostinger docs as a problem
  "PROGRESS.md", // "the move off Vercel/Hostinger onto the Hetzner estate"
  "whatnext.md", // its Hostinger blocks each carry their own dead/superseded marker
  // Section 20 recounts SESSION_RESUME.md pointing at a Hostinger app that had
  // not existed for six weeks. Teaching that the platform is dead is the
  // opposite of instructing someone to deploy to it.
  "FOR-EVARISTE.md",
]);

/*
 * An allowlist rather than a cleverer regex, deliberately.
 *
 * The signal worth catching is a document presenting dead-platform work as
 * something to DO, and no pattern separates that from a document explaining
 * that the platform is dead — the words are the same. Trying would buy false
 * negatives, which is the expensive direction for a guard.
 *
 * So each entry here is a person having looked and decided, recorded in the
 * place the next person will read. Adding a file to this list is cheap and
 * visible in review; that is the point.
 */

const ROOT = process.cwd();

describe("documents that describe a dead platform", () => {
  /*
   * TRACKED files, not whatever happens to be in the directory.
   *
   * The first version of this read the working directory, and the difference
   * matters more than it looks: HOSTINGER_*.md and SESSION_RESUME.md are in
   * .gitignore, so they exist on the operator's machine and in no clone. A
   * directory listing therefore checks a different set of files on every
   * machine, and checks the fewest of all in CI — where a fresh clone has none
   * of them. The guard would have been quietest exactly where it needed to
   * speak up.
   */
  const docs = execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && !f.includes("/") && !NEGATIVE_BY_DESIGN.has(f));

  it("finds documents at all, rather than passing on an empty directory", () => {
    // The whole check is "no file is in a bad state". A glob that matched
    // nothing would satisfy that perfectly while testing nothing.
    expect(docs.length).toBeGreaterThan(5);
  });

  it("each say so within the first few lines", () => {
    const offenders: string[] = [];

    for (const file of docs) {
      const body = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (!DEAD.test(body)) continue;

      const top = body.split(/\r?\n/).slice(0, BANNER_LINES).join("\n");
      if (!BANNER.test(top)) offenders.push(file);
    }

    expect(
      offenders,
      `\nThese mention Hostinger or the old JSON store with no warning in the first ${BANNER_LINES} lines:\n` +
        offenders.map((f) => `  ${f}`).join("\n") +
        `\n\nAdd a banner saying it is superseded and what replaced it. Do not rewrite ` +
        `the body: it is the record of why the project moved.\n`,
    ).toEqual([]);
  });
});
