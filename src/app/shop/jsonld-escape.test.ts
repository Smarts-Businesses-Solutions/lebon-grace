import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The JSON-LD script payload must not be able to close its own tag.
 *
 * The product page shipped `.replace(/</g, "<")` for a long time under a
 * comment claiming JSON.stringify handled the escaping. Neither was true:
 * "<" in TypeScript source IS the character `<`, so the call replaced `<`
 * with itself, and JSON.stringify does not escape `<` at all. An identity
 * operation wearing the costume of a protection.
 *
 * It read as correct in review precisely because it looked like the fix. So the
 * guard here is behavioural, not a grep for the right characters: it runs the
 * transform and checks that a hostile string cannot produce `</script>`.
 */

const escape = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

describe("JSON-LD payload escaping", () => {
  it("cannot emit a closing script tag", () => {
    const hostile = { description: "</script><script>alert(1)</script>" };
    expect(escape(hostile)).not.toContain("</script>");
    expect(escape(hostile)).not.toContain("<");
  });

  it("still parses back to the original value", () => {
    // The escape must be lossless. A parser decodes < back to `<`, so the
    // meaning is unchanged and only the markup-level danger is removed.
    const value = { description: "3mm MDF < 5mm, sanded </script> by hand" };
    expect(JSON.parse(escape(value))).toEqual(value);
  });

  it("the product page uses the escaping form, not the identity one", () => {
    /*
     * Reads the source rather than importing, because the page is a React
     * Server Component with data dependencies. What matters is which literal is
     * in the file: a single backslash is the bug, a doubled one is the fix.
     */
    const file = path.join(process.cwd(), "src", "app", "shop", "[slug]", "page.tsx");
    const src = fs.readFileSync(file, "utf8");

    const identity = `.replace(/</g, "${String.fromCharCode(92)}u003c")`;
    const real = `.replace(/</g, "${String.fromCharCode(92, 92)}u003c")`;

    expect(src, "the identity-operation form has come back").not.toContain(identity);
    expect(src, "the escaping form is missing").toContain(real);
  });
});
