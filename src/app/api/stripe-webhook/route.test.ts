/**
 * Stripe webhook: signature verification and idempotency.
 *
 * Stripe retries a webhook until it gets a 2xx, so "handle this event twice"
 * is not an edge case — it is normal operation. Without idempotency a retry
 * creates a second order for one payment, and the workshop cuts two puzzles for
 * a customer who paid for one.
 *
 * There are two layers and they guard different things:
 *   1. getBySessionId  — catches a sequential retry, which is the common case.
 *   2. UNIQUE(stripe_session_id) violation (Postgres 23505) — the backstop for a
 *      true concurrent race, where two deliveries both pass the check in (1)
 *      before either has inserted.
 * A test for (1) alone would pass while (2) was broken, so both are covered.
 *
 * ACTION_PLAN.md A-4.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Declared through vi.hoisted so they exist before the vi.mock factories run.
// A factory that reads a plain top-level const dies in the temporal dead zone —
// the factories below name these directly rather than only inside a deferred
// arrow body, so plain consts would not be initialised in time.
const m = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  listLineItems: vi.fn(async () => ({ data: [] as unknown[] })),
  getBySessionId: vi.fn(async (_id: string) => null as { id: string } | null),
  insert: vi.fn(async (_order: Record<string, unknown>) => ({ id: "ord_1" })),
  insertMany: vi.fn(async (_rows: unknown[]) => undefined),
  sendOrderEmail: vi.fn(async () => undefined),
  notifyWhatsApp: vi.fn(async () => undefined),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    webhooks: { constructEvent: m.constructEvent },
    checkout: { sessions: { listLineItems: m.listLineItems } },
  }),
  stripeMode: () => "test",
}));
vi.mock("@/lib/store", () => ({
  orders: { getBySessionId: m.getBySessionId, insert: m.insert },
  orderItems: { insertMany: m.insertMany },
}));
vi.mock("@/lib/email", () => ({ sendOrderEmail: m.sendOrderEmail }));
vi.mock("@/lib/whatsapp", () => ({ notifyWhatsApp: m.notifyWhatsApp }));

const { constructEvent, insert, getBySessionId } = m;

import { POST } from "./route";

const SESSION_ID = "cs_test_abc123";

/** A checkout.session.completed event as Stripe would deliver it. */
function completedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: SESSION_ID,
        amount_total: 1500,
        payment_intent: "pi_test_1",
        customer_details: { email: "buyer@example.com", name: "From Stripe", phone: "" },
        metadata: {
          total: "15",
          subtotal: "15",
          shipping: "0",
          customer_name: "From Our Form",
          customer_phone: "+971500000000",
          delivery_method: "pickup",
          emirate: "Dubai",
        },
        ...overrides,
      },
    },
  };
}

const post = (body = "{}") =>
  new NextRequest("https://shop.lebon-grace.com/api/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  getBySessionId.mockResolvedValue(null);
  insert.mockResolvedValue({ id: "ord_1" });
  m.listLineItems.mockResolvedValue({ data: [] });
});

describe("POST /api/stripe-webhook — signature", () => {
  it("rejects an unverifiable signature without touching the database", async () => {
    constructEvent.mockImplementation(() => { throw new Error("No signatures found"); });
    const res = await POST(post());
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses to run at all when no signing secret is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(post());
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe-webhook — idempotency", () => {
  it("creates exactly one order for a first delivery", async () => {
    constructEvent.mockReturnValue(completedEvent());
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ received: true });
  });

  it("does not create a second order when Stripe retries", async () => {
    constructEvent.mockReturnValue(completedEvent());
    getBySessionId.mockResolvedValue({ id: "ord_existing" });

    const res = await POST(post());
    expect(insert).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ received: true, duplicate: true });
  });

  it("looks the duplicate up by the STRIPE session id", async () => {
    // Regression: this once compared against the order's own id, so "cs_..."
    // was matched against "ord_..." and never hit — every retry created a
    // duplicate order while appearing to be guarded.
    constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    expect(getBySessionId).toHaveBeenCalledWith(SESSION_ID);
  });

  it("treats a unique-constraint violation as a duplicate, not an error", async () => {
    // The concurrent race: both deliveries pass getBySessionId before either
    // inserts. Returning 500 here would make Stripe retry a payment that did
    // in fact land.
    constructEvent.mockReturnValue(completedEvent());
    insert.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));

    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
  });

  it("still surfaces a genuine database failure", async () => {
    // Only 23505 means "already handled". Anything else must not be swallowed,
    // or a real outage would be reported to Stripe as success and never retried.
    constructEvent.mockReturnValue(completedEvent());
    insert.mockRejectedValue(Object.assign(new Error("connection refused"), { code: "08006" }));
    await expect(POST(post())).rejects.toThrow("connection refused");
  });

  it("ignores event types it does not handle", async () => {
    constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe-webhook — order contents", () => {
  it("prefers the phone from our own form over Stripe's empty field", async () => {
    // Both /track and /account gate on phone. session.customer_details.phone is
    // only populated when phone_number_collection is enabled, which it is not,
    // so trusting it stored an empty phone on every order and locked customers
    // out of their own order lookup.
    constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    expect(insert.mock.calls[0][0]).toMatchObject({
      customer_phone: "+971500000000",
      customer_name: "From Our Form",
      stripe_session_id: SESSION_ID,
    });
  });

  it("writes a status every other surface recognises", async () => {
    // This wrote "paid", which is in none of STATUS_INDEX, PIPELINE_STAGES, the
    // admin dropdown or the metrics buckets — so a new order lit no step on the
    // customer's tracking timeline and appeared in no column of the production
    // queue. Pinned against the same list the DB CHECK uses
    // (supabase/migrations/0002_add_constraints.sql).
    constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    expect(insert.mock.calls[0][0]).toMatchObject({ status: "deposit_paid" });
  });

  it("stores the engraved name as its own field, not only inside the label", async () => {
    // The workshop queue reads this to know what to cut into the wood (A-15,
    // migration 0004). It used to exist only inside product_name as
    // "Board (engraved: Amira)", so reading it back meant parsing that sentence
    // — which breaks on a name containing a bracket, silently, after the piece
    // has been cut.
    constructEvent.mockReturnValue(completedEvent());
    m.listLineItems.mockResolvedValue({
      data: [{
        description: "ABC Jigsaw Board",
        quantity: 1,
        amount_total: 1500,
        price: { product: { metadata: { slug: "abc-jigsaw-board", personalisation: "Amira" }, images: [] } },
      }],
    });

    await POST(post());
    const rows = m.insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      personalisation: "Amira",
      product_name: "ABC Jigsaw Board (engraved: Amira)",
    });
  });

  it("stores null, not an empty string, for a plain piece", async () => {
    constructEvent.mockReturnValue(completedEvent());
    m.listLineItems.mockResolvedValue({
      data: [{
        description: "ABC Jigsaw Board",
        quantity: 1,
        amount_total: 1500,
        price: { product: { metadata: { slug: "abc-jigsaw-board" }, images: [] } },
      }],
    });

    await POST(post());
    const rows = m.insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].personalisation).toBeNull();
  });

  it("shouts when a paid order ends up with nothing to make", async () => {
    // Production carries a real order from 2026-06-28 sitting in the cutting
    // queue with ZERO line items. That one predates item-writing, but the code
    // path that produces the state is still live and still silent:
    // `if (items.length > 0)` has no else, so an order can be created, paid
    // for, and queued with nothing for the workshop to cut — and nothing says
    // so. Same family as B-7, where paid orders were invisible to the queue.
    //
    // The webhook must still return 200: the customer HAS paid, and failing
    // here would make Stripe retry forever. The requirement is that it is
    // loud, not that it fails.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    constructEvent.mockReturnValue(completedEvent());
    m.listLineItems.mockResolvedValue({ data: [] });

    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(m.insertMany).not.toHaveBeenCalled();

    const shouted = err.mock.calls.some((c) =>
      String(c[0] ?? "").toLowerCase().includes("no line items")
    );
    expect(
      shouted,
      "a paid order with no items must be logged as an error, or nobody finds out until a customer asks where their puzzle is"
    ).toBe(true);
    err.mockRestore();
  });

  it("records the amount actually charged, not a doubled deposit", async () => {
    // Stripe collects the full amount now; the old 50% deposit model doubled
    // amount_total to reconstruct the order value.
    constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    expect(insert.mock.calls[0][0]).toMatchObject({ total: 15, deposit_amount: 15, cod_amount: 0 });
  });
});
