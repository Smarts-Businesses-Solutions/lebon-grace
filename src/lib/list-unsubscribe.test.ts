import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn(async (_p: { headers?: Record<string, string> }) => ({ data: { id: "m" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("./app-url", () => ({ getAppUrl: () => "https://shop.lebon-grace.com" }));

import { unsubscribeHeaders, sendOrderEmail } from "./email";
import { readUnsubscribeToken } from "./unsubscribe-token";

/**
 * RFC 8058, and where it must NOT appear.
 *
 * Gmail and Yahoo require one-click unsubscribe from bulk senders, and both
 * headers are needed together: List-Unsubscribe alone is the old convention,
 * and it is List-Unsubscribe-Post that makes the native button appear. Without
 * it recipients reach for "report spam", and complaints are what damage a
 * sending domain — including deliverability of order confirmations.
 */
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_SESSION_SECRET = "secret-for-list-unsub";
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM_ADDRESS = "orders@lebon-grace.com";
});

describe("unsubscribeHeaders", () => {
  it("emits both headers, not just the first", () => {
    const h = unsubscribeHeaders("buyer@example.com");
    expect(h["List-Unsubscribe"]).toBeTruthy();
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("points at a URL carrying a token that resolves to the recipient", () => {
    const h = unsubscribeHeaders("Buyer@Example.com");
    const url = h["List-Unsubscribe"].match(/<(https:[^>]+)>/)![1];
    const token = new URL(url).searchParams.get("token");
    expect(readUnsubscribeToken(token)).toBe("buyer@example.com");
  });

  it("offers a mailto fallback as well as the URL", () => {
    // Some clients only support mailto. The RFC allows both in one header.
    expect(unsubscribeHeaders("a@b.com")["List-Unsubscribe"]).toContain("mailto:");
  });

  it("emits nothing rather than a broken link when unconfigured", () => {
    delete process.env.ADMIN_SESSION_SECRET;
    expect(unsubscribeHeaders("a@b.com")).toEqual({});
  });
});

describe("transactional mail must NOT carry it", () => {
  it("an order confirmation has no unsubscribe header", async () => {
    // You cannot unsubscribe from a receipt. Offering it teaches recipients
    // the button does nothing, and risks them opting out of mail they need.
    await sendOrderEmail({
      id: "ord_1", customer_name: "B", customer_email: "b@example.com",
      customer_phone: "+971500000000", total: 2, deposit_amount: 2, cod_amount: 0,
      status: "deposit_paid", created_at: new Date().toISOString(),
    } as never, "confirmation");

    expect(send).toHaveBeenCalled();
    const headers = send.mock.calls.at(-1)![0].headers || {};
    expect(headers["List-Unsubscribe"]).toBeUndefined();
  });
});
