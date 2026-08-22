import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unsubscribe has to stop BOTH kinds of mail, not one of them.
 *
 * The cart recovery e-mail is promotional mail sent to someone who typed an
 * address at checkout and did not buy. They never subscribed to anything. It
 * carries a one-click unsubscribe, so Gmail and Yahoo show the native
 * Unsubscribe button beside the sender name.
 *
 * Pressing it used to call `subscribers.remove` on a newsletter row that did
 * not exist. That succeeded, changed nothing, and the next abandoned cart
 * mailed them again. `cart_recovery_sends.suppressed` existed and was read by
 * the send guard, but NOTHING IN THE CODEBASE EVER WROTE IT, so the check could
 * only ever return false.
 *
 * These tests exist because that failure is invisible from every direction: the
 * endpoint answered 200, the button looked like it worked, and the only symptom
 * was a stranger receiving mail they had already refused and reaching for
 * "report spam" instead.
 */

const removed = vi.fn();
const suppressed = vi.fn();

vi.mock("@/lib/store", () => ({
  subscribers: { remove: async (e: string) => void removed(e) },
}));

vi.mock("@/lib/cart-recovery-guard", () => ({
  suppressRecovery: async (e: string) => void suppressed(e),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => null }));

const TOKEN_ADDR = "shopper@example.test";
vi.mock("@/lib/unsubscribe-token", () => ({
  readUnsubscribeToken: (t: string) => (t === "good-token" ? TOKEN_ADDR : null),
}));

const { POST } = await import("./route");

const req = (url: string, body: unknown = {}) =>
  ({ nextUrl: new URL(url), json: async () => body }) as never;

const BASE = "https://shop.test/api/newsletter/unsubscribe";

beforeEach(() => vi.clearAllMocks());

describe("the one-click path a mail provider uses", () => {
  it("suppresses cart recovery as well as the newsletter", async () => {
    const res = await POST(req(`${BASE}?token=good-token`));

    expect(res.status).toBe(200);
    expect(removed).toHaveBeenCalledWith(TOKEN_ADDR);
    expect(suppressed, "cart recovery was not suppressed").toHaveBeenCalledWith(TOKEN_ADDR);
  });

  it("still answers 200 when the address was never a subscriber", async () => {
    /*
     * The common case, and the one that was broken. Someone who only ever
     * abandoned a cart has no newsletter row. The suppression must be recorded
     * anyway, which is why suppressRecovery upserts rather than updates.
     */
    removed.mockRejectedValueOnce(new Error("no such subscriber"));

    const res = await POST(req(`${BASE}?token=good-token`));
    expect(res.status).toBe(200);
  });

  it("refuses a token it cannot verify, and suppresses nothing", async () => {
    const res = await POST(req(`${BASE}?token=forged`));

    expect(res.status).toBe(400);
    expect(suppressed).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
  });
});

describe("the form path a person uses", () => {
  it("suppresses cart recovery as well as the newsletter", async () => {
    const res = await POST(req(BASE, { email: "someone@example.test" }));

    expect(res.status).toBe(200);
    expect(suppressed).toHaveBeenCalledWith("someone@example.test");
  });

  it("suppresses nothing for an address it rejects", async () => {
    const res = await POST(req(BASE, { email: "not-an-address" }));

    expect(res.status).toBe(400);
    expect(suppressed).not.toHaveBeenCalled();
  });
});
