import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { ThrottleState } from "@/lib/login-throttle";

/**
 * Logging in, and the two things that must not break while adding names to it
 * (AD-02).
 *
 * The shop takes live payments. An auth change that locks the operator out of
 * /admin is not a bug to fix next sprint — it is an outage during whatever
 * incident sent them there. So the shared password keeps working until it is
 * deliberately removed from the environment, and both routes to a session are
 * pinned here.
 *
 * The second property is quieter and matters more: a wrong e-mail and a wrong
 * password must be indistinguishable from outside. If they are not, this
 * endpoint tells a stranger which addresses are operators, which is the list you
 * would want before trying passwords.
 */

const m = vi.hoisted(() => ({
  verifyPassword: vi.fn((_p: string) => false),
  verifyOperator: vi.fn((_e: string, _p: string) => null as string | null),
  hasNamedOperators: vi.fn(() => true),
  makeSessionToken: vi.fn((actor?: string) => `admin.${actor ?? ""}.token`),
  requireAdmin: vi.fn(() => false),
  rateLimit: vi.fn(() => null as unknown),
  clientIp: vi.fn(() => "1.2.3.4"),
  // Typed against the REAL ThrottleState rather than inferred from this
  // literal. Inference narrowed it to `{blocked: boolean}`, which then accepted
  // a `retryAfter` field that does not exist on the real thing — a mock quietly
  // describing a different function than the one it stands in for.
  checkLoginThrottle: vi.fn(
    async (_ip: string): Promise<ThrottleState> => ({ blocked: false, failures: 0, retryAfterSeconds: 0 })
  ),
  recordLoginAttempt: vi.fn(async () => undefined),
  throttledResponse: vi.fn(() => new Response("throttled", { status: 429 })),
}));

vi.mock("@/lib/admin-auth", () => ({
  verifyPassword: m.verifyPassword,
  verifyOperator: m.verifyOperator,
  hasNamedOperators: m.hasNamedOperators,
  makeSessionToken: m.makeSessionToken,
  requireAdmin: m.requireAdmin,
  ADMIN_COOKIE: "lg_admin",
  ADMIN_COOKIE_MAX_AGE: 43200,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit, clientIp: m.clientIp }));
vi.mock("@/lib/login-throttle", () => ({
  checkLoginThrottle: m.checkLoginThrottle,
  recordLoginAttempt: m.recordLoginAttempt,
  throttledResponse: m.throttledResponse,
}));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockReturnValue(null);
  m.checkLoginThrottle.mockResolvedValue({ blocked: false, failures: 0, retryAfterSeconds: 0 });
  m.verifyPassword.mockReturnValue(false);
  m.verifyOperator.mockReturnValue(null);
  m.hasNamedOperators.mockReturnValue(true);
});

describe("POST /api/admin/login — named operator", () => {
  it("mints a session that carries who logged in", async () => {
    m.verifyOperator.mockReturnValue("wanresionne@gmail.com");
    const res = await POST(post({ email: "wanresionne@gmail.com", password: "right" }));

    expect(res.status).toBe(200);
    expect(m.makeSessionToken).toHaveBeenCalledWith("wanresionne@gmail.com");
    expect(res.headers.get("set-cookie")).toContain("lg_admin=");
    expect(res.headers.get("set-cookie"), "the cookie must not be readable by page JS").toContain("HttpOnly");
  });

  it("does not fall back to the shared password once the operator matched", async () => {
    m.verifyOperator.mockReturnValue("wanresionne@gmail.com");
    await POST(post({ email: "wanresionne@gmail.com", password: "right" }));
    expect(m.verifyPassword, "short-circuited — a named login is already proven").not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/login — the shared password still works", () => {
  it("accepts it when no e-mail is supplied", async () => {
    // The property that makes this change safe to deploy: shipping named logins
    // must not lock anyone out before ADMIN_USERS is configured.
    m.verifyPassword.mockReturnValue(true);
    const res = await POST(post({ password: "the-shared-one" }));

    expect(res.status).toBe(200);
    expect(m.makeSessionToken).toHaveBeenCalledWith(undefined);
  });

  it("accepts it even when an e-mail is supplied that is not an operator", async () => {
    m.verifyOperator.mockReturnValue(null);
    m.verifyPassword.mockReturnValue(true);
    const res = await POST(post({ email: "stranger@example.com", password: "the-shared-one" }));
    expect(res.status).toBe(200);
    // Unattributed, because it genuinely is — the shared password proves nobody
    // in particular, and the address typed alongside it proves nothing at all.
    expect(m.makeSessionToken).toHaveBeenCalledWith(undefined);
  });
});

describe("POST /api/admin/login — failure", () => {
  it("answers a wrong e-mail EXACTLY as it answers a wrong password", async () => {
    const wrongEmail = await POST(post({ email: "nobody@example.com", password: "right" }));
    const wrongPassword = await POST(post({ email: "wanresionne@gmail.com", password: "wrong" }));

    expect(wrongEmail.status).toBe(wrongPassword.status);
    expect(await wrongEmail.json()).toEqual(await wrongPassword.json());
    expect(wrongEmail.status).toBe(401);
  });

  it("PRECONDITION: a correct credential is answered DIFFERENTLY", async () => {
    // Without this, an endpoint that rejected everything would satisfy the
    // assertion above while letting nobody in.
    m.verifyOperator.mockReturnValue("wanresionne@gmail.com");
    const ok = await POST(post({ email: "wanresionne@gmail.com", password: "right" }));
    expect(ok.status).toBe(200);
  });

  it("sets no cookie and counts the failure", async () => {
    const res = await POST(post({ email: "nobody@example.com", password: "wrong" }));
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(m.recordLoginAttempt).toHaveBeenCalledWith("1.2.3.4", false);
  });

  it("is throttled before any credential is checked", async () => {
    m.checkLoginThrottle.mockResolvedValue({ blocked: true, failures: 5, retryAfterSeconds: 900 });
    const res = await POST(post({ email: "wanresionne@gmail.com", password: "right" }));
    expect(res.status).toBe(429);
    expect(m.verifyOperator, "a blocked request must not reach the hash").not.toHaveBeenCalled();
    expect(m.verifyPassword).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/login", () => {
  it("tells the form whether to ask for an e-mail", async () => {
    // Asking for one before ADMIN_USERS is configured would present a field
    // that cannot succeed — the surest way to convince someone they are locked
    // out of their own shop.
    m.hasNamedOperators.mockReturnValue(false);
    expect(await (await GET(post({}))).json()).toMatchObject({ namedLogins: false });

    m.hasNamedOperators.mockReturnValue(true);
    expect(await (await GET(post({}))).json()).toMatchObject({ namedLogins: true });
  });

  it("reports the session state without leaking anything else", async () => {
    m.requireAdmin.mockReturnValue(true);
    const body = await (await GET(post({}))).json();
    expect(body.authenticated).toBe(true);
    expect(Object.keys(body).sort()).toEqual(["authenticated", "namedLogins"]);
  });
});
