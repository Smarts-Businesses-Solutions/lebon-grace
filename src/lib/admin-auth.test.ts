import { describe, it, expect, beforeEach, vi } from "vitest";
import { scryptSync, randomBytes } from "crypto";

/**
 * Named operators, and the properties that make the audit trail trustworthy
 * rather than merely populated (AD-02).
 *
 * The trail shipped in B-42 records what changed and when. It could not record
 * who, because one shared password means there is no who. These tests pin the
 * three things that must hold once there is:
 *
 *   1. a wrong password never authenticates, and a valid one for the WRONG
 *      account never authenticates either;
 *   2. the operator's name survives the round trip into the session cookie and
 *      back out, because that is the only path by which an action gets
 *      attributed;
 *   3. a token minted before this change still works — shipping an auth change
 *      that signs everyone out is how a shop ends up with no one able to reach
 *      /admin.
 *
 * Env is read at module load, so every test re-imports with the env it needs.
 */

const SECRET = "test-session-secret-not-a-real-one";

function entry(email: string, password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `${email}:${salt}$${hash}`;
}

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v ?? "");
  return import("./admin-auth");
}

const ALICE = entry("wanresionne@gmail.com", "correct-horse-battery");
const BOB = entry("smarts.businesses.solutions@gmail.com", "another-long-passphrase");

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyOperator", () => {
  it("accepts the right password and returns WHO logged in", async () => {
    const { verifyOperator } = await load({ ADMIN_USERS: `${ALICE},${BOB}` });
    expect(verifyOperator("wanresionne@gmail.com", "correct-horse-battery")).toBe("wanresionne@gmail.com");
    expect(verifyOperator("smarts.businesses.solutions@gmail.com", "another-long-passphrase")).toBe(
      "smarts.businesses.solutions@gmail.com"
    );
  });

  it("refuses one operator's password used against another's account", async () => {
    // The failure that a naive "does this password match ANY entry" check would
    // wave through — and which would then attribute the action to the wrong
    // person, which is worse than attributing it to nobody.
    const { verifyOperator } = await load({ ADMIN_USERS: `${ALICE},${BOB}` });
    expect(verifyOperator("wanresionne@gmail.com", "another-long-passphrase")).toBeNull();
  });

  it("refuses a wrong password, an unknown address, and an empty one", async () => {
    const { verifyOperator } = await load({ ADMIN_USERS: ALICE });
    expect(verifyOperator("wanresionne@gmail.com", "wrong")).toBeNull();
    expect(verifyOperator("stranger@example.com", "correct-horse-battery")).toBeNull();
    expect(verifyOperator("", "")).toBeNull();
  });

  it("ignores case and surrounding spaces in the address", async () => {
    // Typed by a human into a login form, sometimes autocapitalised by a phone.
    const { verifyOperator } = await load({ ADMIN_USERS: ALICE });
    expect(verifyOperator("  WanResionne@Gmail.com ", "correct-horse-battery")).toBe("wanresionne@gmail.com");
  });

  it("denies everyone when ADMIN_USERS is unset or malformed", async () => {
    // Misconfiguration must fail closed. An entry with no `$` separator is not
    // an operator with an empty password — it is garbage, and garbage does not
    // open the door.
    const none = await load({ ADMIN_USERS: "" });
    expect(none.verifyOperator("wanresionne@gmail.com", "correct-horse-battery")).toBeNull();
    expect(none.hasNamedOperators()).toBe(false);

    const junk = await load({ ADMIN_USERS: "wanresionne@gmail.com:no-separator-here" });
    expect(junk.verifyOperator("wanresionne@gmail.com", "")).toBeNull();
    expect(junk.verifyOperator("wanresionne@gmail.com", "no-separator-here")).toBeNull();
  });

  it("denies everyone when ADMIN_SESSION_SECRET is missing", async () => {
    vi.resetModules();
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("ADMIN_USERS", ALICE);
    const { verifyOperator } = await import("./admin-auth");
    expect(verifyOperator("wanresionne@gmail.com", "correct-horse-battery")).toBeNull();
  });
});

describe("session token", () => {
  it("carries the operator through the cookie and back", async () => {
    const { makeSessionToken, sessionActor } = await load({ ADMIN_USERS: ALICE });
    const token = makeSessionToken("wanresionne@gmail.com");
    expect(sessionActor(token)).toBe("wanresionne@gmail.com");
  });

  it("still accepts a token minted before named operators existed", async () => {
    // PRECONDITION for calling this safe to deploy: an operator already logged
    // in must not be signed out by shipping it. "" — genuine session, no name —
    // is the honest answer, and distinguishable from null (no session).
    const { makeSessionToken, sessionActor, isValidSessionToken } = await load({ ADMIN_USERS: "" });
    const legacy = makeSessionToken();
    expect(isValidSessionToken(legacy)).toBe(true);
    expect(sessionActor(legacy)).toBe("");
  });

  it("rejects a token whose operator was edited after signing", async () => {
    // The attack this whole scheme has to survive: swap the name in your own
    // valid cookie for someone else's and every action you take is filed under
    // them. The signature covers the name, so the edit invalidates the token.
    const { makeSessionToken, sessionActor } = await load({ ADMIN_USERS: `${ALICE},${BOB}` });
    const token = makeSessionToken("wanresionne@gmail.com");
    const [role, , exp, sig] = token.split(".");
    const forged = `${role}.${Buffer.from("smarts.businesses.solutions@gmail.com").toString("base64url")}.${exp}.${sig}`;
    expect(sessionActor(forged)).toBeNull();
  });

  it("rejects an expired token, a tampered signature and rubbish", async () => {
    const { makeSessionToken, sessionActor, isValidSessionToken } = await load({ ADMIN_USERS: ALICE });
    const token = makeSessionToken("wanresionne@gmail.com");

    const [role, who, , sig] = token.split(".");
    expect(sessionActor(`${role}.${who}.1.${sig}`), "expired").toBeNull();
    expect(sessionActor(`${role}.${who}.${Date.now() + 1000}.${"0".repeat(64)}`), "bad signature").toBeNull();
    expect(sessionActor("garbage")).toBeNull();
    expect(sessionActor("")).toBeNull();
    expect(sessionActor(undefined)).toBeNull();
    expect(isValidSessionToken(token), "PRECONDITION: the untampered token is valid").toBe(true);
  });
});

describe("hasNamedOperators", () => {
  it("is true only when at least one usable entry is configured", async () => {
    // Drives whether the login form asks for an e-mail. If it said true with
    // nothing configured, the form would show a field that cannot succeed.
    expect((await load({ ADMIN_USERS: ALICE })).hasNamedOperators()).toBe(true);
    expect((await load({ ADMIN_USERS: "" })).hasNamedOperators()).toBe(false);
    expect((await load({ ADMIN_USERS: "   " })).hasNamedOperators()).toBe(false);
  });
});

describe("hashPassword", () => {
  it("produces a different hash per salt, and matches for the same salt", async () => {
    const { hashPassword, newSalt } = await load({ ADMIN_USERS: "" });
    const s1 = newSalt();
    const s2 = newSalt();
    expect(hashPassword("same-password", s1)).toBe(hashPassword("same-password", s1));
    expect(hashPassword("same-password", s1)).not.toBe(hashPassword("same-password", s2));
    expect(s1).not.toBe(s2);
  });
});
