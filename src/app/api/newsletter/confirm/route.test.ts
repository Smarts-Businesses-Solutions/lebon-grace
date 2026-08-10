import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Double opt-in, and the two properties that make it safe rather than merely
 * functional (NS-01).
 *
 * Subscribing used to store whatever address was typed, so anyone could
 * subscribe anyone — a stranger's address, a competitor's, an ex-partner's — and
 * the only remedy was an unsubscribe link the victim could not use until the
 * mail had already arrived.
 */

const m = vi.hoisted(() => ({
  confirm: vi.fn(async (_t: string) => true),
  rateLimit: vi.fn(() => null as unknown),
}));

vi.mock("@/lib/store", () => ({ subscribers: { confirm: m.confirm } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://shop.lebon-grace.com" }));

import { GET } from "./route";

const get = (qs: string) =>
  new NextRequest(`https://shop.lebon-grace.com/api/newsletter/confirm${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockReturnValue(null);
  m.confirm.mockResolvedValue(true);
});

describe("GET /api/newsletter/confirm", () => {
  it("confirms a valid token and sends the subscriber somewhere human", async () => {
    const res = await GET(get("?token=abc-123"));
    expect(m.confirm).toHaveBeenCalledWith("abc-123");
    expect(res.status, "a mail client follows redirects, not JSON").toBe(303);
    expect(res.headers.get("location")).toContain("newsletter=confirmed");
  });

  it("answers an unknown token EXACTLY as it answers a used one", async () => {
    // The security property. If these differed, the endpoint would be an oracle
    // for which tokens once existed. For a genuine subscriber who clicked twice,
    // "already confirmed" and "confirmed" mean the same thing anyway.
    m.confirm.mockResolvedValue(false);
    const unknown = await GET(get("?token=never-existed"));
    m.confirm.mockResolvedValue(false);
    const used = await GET(get("?token=already-burned"));

    expect(unknown.status).toBe(used.status);
    expect(unknown.headers.get("location")).toBe(used.headers.get("location"));
    expect(unknown.headers.get("location")).toContain("newsletter=invalid");
  });

  it("PRECONDITION: a valid token is answered DIFFERENTLY", async () => {
    // Without this, an endpoint that always said "invalid" would satisfy the
    // assertion above while confirming nobody.
    const ok = await GET(get("?token=abc-123"));
    m.confirm.mockResolvedValue(false);
    const bad = await GET(get("?token=nope"));
    expect(ok.headers.get("location")).not.toBe(bad.headers.get("location"));
  });

  it("does not treat a missing token as a confirmation", async () => {
    m.confirm.mockResolvedValue(false);
    const res = await GET(get(""));
    expect(res.headers.get("location")).toContain("newsletter=invalid");
  });

  it("survives a database failure without claiming success", async () => {
    m.confirm.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(get("?token=abc-123"));
    err.mockRestore();
    expect(res.headers.get("location")).toContain("newsletter=error");
    expect(res.headers.get("location")).not.toContain("confirmed");
  });

  it("is rate limited, so a stolen token list cannot be ground through", async () => {
    m.rateLimit.mockReturnValue(new Response("rate limited", { status: 429 }));
    const res = await GET(get("?token=abc-123"));
    expect(res.status).toBe(429);
    expect(m.confirm, "a throttled request must not touch the database").not.toHaveBeenCalled();
  });
});
