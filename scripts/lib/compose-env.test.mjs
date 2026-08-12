import { describe, it, expect } from "vitest";
import { escapeComposeEnvValue } from "./compose-env.mjs";

/**
 * Regression test for a real production incident, 2026-08-12.
 *
 * `setup-admin-users.mjs` wrote ADMIN_USERS into a Compose `.env` correctly —
 * 383 characters, both operators, salt and hash the right length. The container
 * then received 254. One operator could sign in and the other got a 401.
 *
 * The credential format is `email:<salt>$<hash>`, and `$` starts a variable
 * reference in Compose. `$<hash>` was read as the name of a variable that does
 * not exist and expanded to nothing, so the second hash was deleted in transit.
 *
 * What makes this worth a test rather than a comment is that it is INTERMITTENT.
 * A variable name cannot begin with a digit, so a hash starting with 0-9 is left
 * alone and works. Hex hashes start with a letter about 37% of the time. The
 * first operator's hash began with a digit; the second's did not. Run the same
 * script twice with the same input and it can succeed, then fail, with a
 * different salt.
 */
describe("escapeComposeEnvValue", () => {
  it("doubles a dollar sign, which is how Compose spells a literal one", () => {
    expect(escapeComposeEnvValue("salt$hash")).toBe("salt$$hash");
  });

  it("escapes the exact shape that was eaten in production", () => {
    // A hash beginning with a letter — the case that failed. Before the fix this
    // reached the container as "a@b.com:" plus nothing at all.
    const salt = "f".repeat(32);
    const hash = "abc" + "0".repeat(125); // 128 chars, letter first
    const entry = `a@b.com:${salt}$${hash}`;

    const escaped = escapeComposeEnvValue(entry);

    expect(escaped).toContain(`${salt}$$${hash}`);
    // The hash must still be there in full. Asserting only "it changed" would
    // pass on a function that deleted it, which is the bug being fixed.
    expect(escaped).toContain(hash);
    expect(escaped.length).toBe(entry.length + 1);
  });

  it("escapes every operator in a multi-entry value, not just the first", () => {
    const value = "a@b.com:s1$h1,c@d.com:s2$h2";
    expect(escapeComposeEnvValue(value)).toBe("a@b.com:s1$$h1,c@d.com:s2$$h2");
  });

  it("leaves a value with no dollar sign exactly as it was", () => {
    // Most secrets have no `$`. Escaping must be a no-op for them, or this fix
    // silently corrupts every other variable it touches.
    const plain = "sk_live_0123456789abcdef-_=+/";
    expect(escapeComposeEnvValue(plain)).toBe(plain);
  });

  it("is idempotent in the sense that it never drops characters", () => {
    const v = "$$a$b$";
    const out = escapeComposeEnvValue(v);
    expect(out.replace(/\$\$/g, "$")).toBe(v);
  });
});
