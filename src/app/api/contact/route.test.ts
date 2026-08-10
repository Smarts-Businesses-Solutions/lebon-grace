import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * A refused enquiry must not be reported as sent.
 *
 * This route already intended that — it returns 500 and its comment says "Do
 * not claim success on failure". It could not *detect* failure, because
 * `Resend.emails.send` resolves `{data, error}` instead of throwing, so the
 * catch only ever fired on a network fault (B-30).
 *
 * That mattered more here than anywhere else in the app. The contact form is
 * how a customer reaches a shop they have not bought from yet: a silent refusal
 * returns "thanks, we'll be in touch" and the enquiry is gone, with nobody on
 * either end aware of it.
 *
 * B-30's fix routed the three senders in `lib/email.ts` through `deliver()` and
 * missed this route and cart-recovery, which call the SDK directly. These tests
 * exist so that cannot happen quietly again — and they are the first tests this
 * route has ever had (EN-05).
 */

const REFUSAL = {
  data: null,
  error: { message: "The lebon-grace.com domain is not verified", statusCode: 403, name: "validation_error" },
};
const ACCEPTED = { data: { id: "e_1" }, error: null };

const m = vi.hoisted(() => ({
  send: vi.fn(async (_p: Record<string, unknown>) => ({ data: { id: "e_1" }, error: null }) as unknown),
  rateLimit: vi.fn(() => null as unknown),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/contact", () => ({ CONTACT: { email: "care@lebon-grace.com" } }));

/*
 * Mock the SDK, not `@/lib/email`.
 *
 * `deliver` calls the module-internal `mailer()`, so overriding the EXPORTED
 * `mailer` changes nothing it can see — the first version of this test did
 * that, the real client ran, `new Resend(undefined)` threw, and every case came
 * back 500 including the one that should have passed. Replacing `resend` itself
 * leaves the whole of lib/email real, which is the point: what is under test is
 * `deliver` reading `{data, error}`.
 */
vi.mock("resend", () => ({ Resend: class { emails = { send: m.send }; } }));

import { POST } from "./route";

const post = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const good = { name: "A Customer", email: "buyer@example.com", subject: "Hello", message: "Do you ship to Sharjah?" };

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockReturnValue(null);
  m.send.mockResolvedValue(ACCEPTED);
});

describe("POST /api/contact — a refused send is not a sent enquiry", () => {
  it("answers 500 when the provider REFUSES the message", async () => {
    m.send.mockResolvedValue(REFUSAL);
    const res = await POST(post(good));
    expect(res.status, "a refused enquiry must not be reported as sent").toBe(500);
    const body = await res.json();
    expect(body.success).toBeUndefined();
    expect(body.error).toBeTruthy();
  });

  it("PRECONDITION: answers 200 when the provider accepts it", async () => {
    // Without this, a route that always 500s would satisfy the assertion above.
    const res = await POST(post(good));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("still swallows the honeypot with a cheerful 200 and no send", async () => {
    // A bot that learns it was caught retries differently. This must not change.
    const res = await POST(post({ ...good, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("names the provider's reason in the log, so the fix is obvious", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.send.mockResolvedValue(REFUSAL);
    await POST(post(good));
    expect(err.mock.calls.flat().map(String).join(" ")).toContain("not verified");
    err.mockRestore();
  });
});
