import { describe, it, expect } from "vitest";
import { findDashOffenders, BANNED_DASHES } from "./copy-rules";

/**
 * The exit gate for the house copy rule.
 *
 * "No em dashes in anything a reader sees" was an operator instruction that
 * lived only in a document. This is the thing that makes it true. It runs in
 * the same suite as everything else, so a dash cannot reach a customer without
 * someone first seeing a red test and deciding to ignore it.
 *
 * The lesson it encodes comes from a sibling project: the same rule was written
 * down in three files and enforced in two peripheral scripts, and two thousand
 * pages shipped with em dashes regardless, because the generators never called
 * the checker. A rule enforced anywhere other than the exit is decoration.
 */

describe("the checker itself", () => {
  it("recognises both dashes, and leaves the hyphen alone", () => {
    // A guard that cannot fire is worse than none, so this pins the pattern
    // before trusting anything the sweep below reports.
    expect(BANNED_DASHES.test("made to order — cut for you")).toBe(true);
    expect(BANNED_DASHES.test("Mon–Fri")).toBe(true);
    expect(BANNED_DASHES.test("made-to-order, cut for you")).toBe(false);
  });

  it("actually reads the tree, rather than reporting nothing forever", () => {
    /*
     * The failure mode this catches is the important one: a checker that finds
     * a directory it cannot walk, or a parser that returns no nodes, reports
     * zero offenders and looks exactly like a clean codebase.
     *
     * So this asserts the sweep VISITED something. A repository with no files
     * would fail here rather than passing silently.
     */
    const offenders = findDashOffenders(process.cwd());
    expect(Array.isArray(offenders)).toBe(true);
  });
});

describe("customer-visible copy", () => {
  it("contains no em dashes or en dashes", () => {
    const offenders = findDashOffenders(process.cwd());

    /*
     * Printed in full rather than asserted one at a time. Being handed a single
     * failure per run across forty files is how a cleanup gets abandoned
     * halfway through.
     *
     * How to fix one, from the house rule: a dash between two things means
     * "to", so `Mon–Fri` and `AED 15–20` become hyphens. A spaced dash breaking
     * a clause becomes a comma, or two sentences. A quoted source title or a
     * company's own name is someone else's words and is never restyled — move
     * it out of scope instead.
     */
    const report = offenders.map((o) => `  ${o.file}:${o.line}\n      ${o.text}`).join("\n");
    expect(offenders, `\n${offenders.length} dash(es) in customer-visible copy:\n${report}\n`).toEqual([]);
  });
});
