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
  mayRecover: vi.fn(async (_e: string) => "allow" as string),
  recordRecoverySend: vi.fn(async (_e: string) => undefined),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/cart-recovery-guard", () => ({
  mayRecover: m.mayRecover,
  recordRecoverySend: m.recordRecoverySend,
}));
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

/**
 * SH-06 — this endpoint mails a stranger-supplied address from our domain.
 *
 * The feature is "e-mail me my cart", so the recipient genuinely cannot be
 * verified as theirs: a first-time shopper has no prior relationship to check
 * against. What can be bounded is how often any one address is reachable, and
 * the old control bounded the wrong party — 3 per hour per IP caps one
 * attacker's throughput and does nothing for the victim, because rotating IPs
 * is cheap and each one can mail the same person again.
 *
 * The audit rated it LOW because every e-mail was being refused at the time
 * (B-30). Fixing the sender domain made it live. These tests pin the controls
 * that make it safe now that mail actually leaves the building.
 */
describe("SH-06 — the recipient is protected, not just the sender", () => {
  beforeEach(() => {
    m.mayRecover.mockResolvedValue("allow");
    m.send.mockResolvedValue(ACCEPTED);
  });

  it("checks the RECIPIENT before sending, not only the caller's IP", async () => {
    await POST(post({ email: "someone@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    expect(m.mayRecover, "the recipient cooldown must be consulted").toHaveBeenCalledWith("someone@example.com");
  });

  it("sends nothing to an address inside its cooldown", async () => {
    m.mayRecover.mockResolvedValue("cooldown");
    const res = await POST(post({ email: "victim@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    expect(m.send, "a second mail to the same address must not be sent").not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("sends nothing to a suppressed address", async () => {
    m.mayRecover.mockResolvedValue("suppressed");
    await POST(post({ email: "optedout@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends nothing when the cooldown cannot be checked", async () => {
    // Fails CLOSED, unlike the rest of this codebase's database handling. A
    // missed cart-recovery mail costs one sale; a send we could not check costs
    // somebody else's inbox.
    m.mayRecover.mockResolvedValue("unavailable");
    await POST(post({ email: "someone@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    expect(m.send).not.toHaveBeenCalled();
  });

  it("answers refused and delivered requests IDENTICALLY", async () => {
    // Otherwise the endpoint is an oracle: a different status or body would
    // tell a stranger whether an address has been mailed recently, or has opted
    // out — which is information about a person, from an endpoint that requires
    // no authentication at all. Same reasoning as the newsletter confirm
    // endpoint (B-43).
    const body = { email: "someone@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] };

    m.mayRecover.mockResolvedValue("allow");
    const allowed = await POST(post(body));
    const allowedBody = await allowed.json();

    m.mayRecover.mockResolvedValue("cooldown");
    const refused = await POST(post(body));
    const refusedBody = await refused.json();

    m.mayRecover.mockResolvedValue("suppressed");
    const suppressed = await POST(post(body));

    expect(refused.status).toBe(allowed.status);
    expect(suppressed.status).toBe(allowed.status);
    expect(refusedBody).toEqual(allowedBody);
  });

  it("records the send so the next request is refused", async () => {
    await POST(post({ email: "someone@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    expect(m.recordRecoverySend).toHaveBeenCalledWith("someone@example.com");
  });

  it("does NOT record a send that never happened", async () => {
    // PRECONDITION for the test above: recording unconditionally would extend
    // the cooldown on every refused attempt, letting an attacker keep a real
    // shopper permanently locked out of their own cart mail.
    m.send.mockResolvedValue(REFUSAL);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(post({ email: "someone@example.com", items: [{ product: { slug: "abc-jigsaw-board" }, quantity: 1 }] }));
    err.mockRestore();
    expect(m.recordRecoverySend).not.toHaveBeenCalled();
  });
});
