import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The second sender B-30's first fix missed.
 *
 * Like /api/contact, this called `mailer().emails.send` directly, so a refusal
 * resolved normally and the route answered 200. Unlike /api/contact, nobody was
 * waiting on it — which is precisely why it could stay broken indefinitely
 * without anyone noticing.
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
// The SDK, not @/lib/email — `deliver` uses the module-internal mailer().
vi.mock("resend", () => ({ Resend: class { emails = { send: m.send }; } }));

import { POST } from "./route";

const post = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/cart-recovery", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const good = {
  email: "buyer@example.com",
  // Shape matters: the route reads `item.product.slug` and resolves name+price
  // from the catalog itself, so the caller controls only slug and quantity.
  items: [{ product: { slug: "alphabet-learning-board" }, quantity: 1 }],
  total: 15,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockReturnValue(null);
  m.send.mockResolvedValue(ACCEPTED);
});

describe("POST /api/cart-recovery — a refused send is not a sent email", () => {
  it("answers 500 when the provider REFUSES the message", async () => {
    m.send.mockResolvedValue(REFUSAL);
    const res = await POST(post(good));
    expect(res.status).toBe(500);
  });

  it("PRECONDITION: answers 200 when the provider accepts it", async () => {
    const res = await POST(post(good));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("names the provider's reason in the log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.send.mockResolvedValue(REFUSAL);
    await POST(post(good));
    expect(err.mock.calls.flat().map(String).join(" ")).toContain("not verified");
    err.mockRestore();
  });
});

/**
 * SH-07: the recovery e-mail quoted a price the shop does not charge.
 *
 *     Pay only 50% now — AED {total/2}
 *
 * The 50%-deposit-plus-cash-on-delivery model was removed; checkout charges the
 * full amount ("Full payment at checkout" in /api/checkout). So this e-mail
 * invited a customer back with a figure half what they would actually be asked
 * for — a false price in marketing copy, not merely stale wording.
 */
describe("POST /api/cart-recovery — the price it quotes is the price charged", () => {
  it("does not promise a deposit or a part payment", async () => {
    await POST(post(good));
    const { html } = m.send.mock.calls[0][0] as { html: string };
    expect(html, "the deposit model was removed; checkout charges in full").not.toMatch(/50%|pay only|deposit/i);
  });

  it("PRECONDITION: it still states the cart total", async () => {
    // Without this, deleting the whole price block would satisfy the assertion
    // above while making the e-mail useless.
    await POST(post(good));
    const { html } = m.send.mock.calls[0][0] as { html: string };
    expect(html).toMatch(/AED\s*15\.00/);
  });
});
