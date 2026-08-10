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
  getByPaymentIntent: vi.fn(async (_pi: string) => null as Record<string, unknown> | null),
  updateOrder: vi.fn(async (_id: string, _u: Record<string, unknown>) => ({ id: "ord_1" })),
  insert: vi.fn(async (_order: Record<string, unknown>) => ({ id: "ord_1" })),
  insertMany: vi.fn(async (_rows: unknown[]) => undefined),
  // Params declared for the same reason as sendOperatorOrderAlert below: a bare
  // vi.fn() infers an empty tuple, so mock.calls[0][1] is a COMPILE error.
  sendOrderEmail: vi.fn(async (_order: Record<string, unknown>, _action?: string) => undefined),
  sendOperatorNotice: vi.fn(async (_subject: string, _html: string) => true),
  // Params declared: a bare vi.fn() infers an empty tuple, so mock.calls[0][0]
  // is a COMPILE error rather than a runtime one.
  sendOperatorOrderAlert: vi.fn(async (_order: Record<string, unknown>, _items?: unknown[]) => true),
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
  orders: { getBySessionId: m.getBySessionId, getByPaymentIntent: m.getByPaymentIntent, update: m.updateOrder, insert: m.insert },
  orderItems: { insertMany: m.insertMany },
}));
// Spread the REAL module and override only what must not fire. `escapeHtml` is
// deliberately left real: stubbing it would make every assertion below pass
// against an alert that escapes nothing. Safe because email.ts constructs its
// Resend client lazily inside mailer(), so importing it sends nothing.
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendOrderEmail: m.sendOrderEmail,
  sendOperatorOrderAlert: m.sendOperatorOrderAlert,
  sendOperatorNotice: m.sendOperatorNotice,
}));
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

  it("tells the OPERATOR a new order arrived, not just the customer", async () => {
    // Nobody told the operator. sendOrderEmail() addresses the customer and
    // notifyWhatsApp() addresses the customer's phone; there was no admin
    // recipient anywhere in src/. The maker found out by opening /admin and
    // looking. .env.example documented ORDER_NOTIFY_EMAIL and no code read it.
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
    // The send is fire-and-forget, deliberately: making the webhook fail on a
    // notification failure would have Stripe retry, and the retry short-circuits
    // on the idempotency check — so the alert would be skipped permanently
    // rather than retried. Give the microtask a turn.
    await new Promise((r) => setTimeout(r, 0));

    expect(
      m.sendOperatorOrderAlert,
      "the operator was never told the order arrived"
    ).toHaveBeenCalledTimes(1);

    // It must carry enough to act on WITHOUT opening /admin — the engraving
    // above all, since that is cut irreversibly.
    const [alertOrder, alertItems] = m.sendOperatorOrderAlert.mock.calls[0];
    expect(alertOrder.customer_name, "the alert must name the customer").toBeTruthy();
    // The engraving travels in the ITEMS argument, not the order — the first
    // draft stringified only the order and reported a false failure.
    expect(
      JSON.stringify(alertItems),
      "the alert must carry the engraving; it is cut irreversibly"
    ).toContain("Amira");
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

/**
 * A refund in the Stripe dashboard has to reach the shop.
 *
 * `checkout.session.completed` was the ONLY event this webhook understood, so a
 * refund left no trace: the order kept its status, the customer's tracker went
 * on showing it progressing, and it stayed in the cutting queue — the workshop
 * could cut a piece for an order that had already been paid back. It depended
 * entirely on the operator remembering to repeat the refund by hand in /admin.
 *
 * Driven with synthetic signed events, so none of this touches Stripe. That is
 * the whole reason it can be tested at all while the shop is on live keys.
 */
function refundedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_test_1",
        payment_intent: "pi_test_1",
        amount: 1500,
        amount_refunded: 1500,
        ...overrides,
      },
    },
  };
}

const REFUNDABLE = {
  id: "ord_1", status: "processing", customer_name: "Amira",
  customer_email: "buyer@example.com", customer_phone: "0501234567",
  total: 15, subtotal: 15, shipping: 0, deposit_amount: 15, cod_amount: 0,
  delivery_method: "pickup",
};

describe("POST /api/stripe-webhook — a refund reaches the order", () => {
  beforeEach(() => {
    m.getByPaymentIntent.mockResolvedValue(REFUNDABLE);
    m.updateOrder.mockResolvedValue({ id: "ord_1" });
  });

  it("moves the order to refunded", async () => {
    m.constructEvent.mockReturnValue(refundedEvent());
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(m.getByPaymentIntent).toHaveBeenCalledWith("pi_test_1");
    expect(m.updateOrder).toHaveBeenCalledWith("ord_1", { status: "refunded" });
  });

  it("tells the customer, using the refunded template", async () => {
    // B-5: four statuses once fell through to "Order Confirmed! We're preparing
    // your items now." Refunding someone and then saying that was the DEFAULT.
    m.constructEvent.mockReturnValue(refundedEvent());
    await POST(post());
    expect(m.sendOrderEmail).toHaveBeenCalled();
    expect(m.sendOrderEmail.mock.calls[0][1]).toBe("refunded");
  });

  it("treats a partial refund as a refund", async () => {
    // One made-to-order piece at one price: a partial refund means a human
    // decided something went wrong, and the customer should see that rather
    // than a progress bar.
    m.constructEvent.mockReturnValue(refundedEvent({ amount_refunded: 500 }));
    await POST(post());
    expect(m.updateOrder).toHaveBeenCalledWith("ord_1", { status: "refunded" });
  });

  it("is idempotent — Stripe retries, and a second partial arrives too", async () => {
    m.getByPaymentIntent.mockResolvedValue({ ...REFUNDABLE, status: "refunded" });
    m.constructEvent.mockReturnValue(refundedEvent());
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(m.updateOrder, "must not re-write or re-email").not.toHaveBeenCalled();
    expect(m.sendOrderEmail).not.toHaveBeenCalled();
  });

  it("still answers 200 when no order matches, rather than making Stripe retry forever", async () => {
    m.getByPaymentIntent.mockResolvedValue(null);
    m.constructEvent.mockReturnValue(refundedEvent());
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(m.updateOrder).not.toHaveBeenCalled();
  });

  it("does not touch orders on an event type it does not handle", async () => {
    // Precondition for the assertions above: the refund branch is selected by
    // event TYPE, so an unrelated event must fall straight through.
    m.constructEvent.mockReturnValue({ type: "payout.paid", data: { object: {} } });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(m.updateOrder).not.toHaveBeenCalled();
    expect(m.getByPaymentIntent).not.toHaveBeenCalled();
  });
});

/**
 * The events this endpoint deliberately does NOT act on.
 *
 * "No handler" and "we decided not to handle it" look identical in code, so the
 * decision is pinned here. Each of these was checked against how the shop is
 * wired rather than waved away:
 *
 *   checkout.session.expired  — the order row is created only in the completed
 *     branch, so an abandoned checkout left no record to update. Cart recovery
 *     is driven from the browser, not from Stripe.
 *   payment_intent.canceled   — `mode: "payment"` with no capture_method means
 *     automatic capture, so a cancelled PI never succeeded and has no order.
 *   payout.*                  — Stripe to bank. Says nothing about an order.
 *
 * If any of those assumptions changes — manual capture especially — these tests
 * still pass, which is why the route comment names the CAUSE. The value here is
 * narrower and real: none of them may quietly mutate an order today.
 */
describe("POST /api/stripe-webhook — events it deliberately ignores", () => {
  for (const type of [
    "checkout.session.expired",
    "payment_intent.canceled",
    "payout.paid",
    "payout.failed",
    "charge.dispute.created",
    "invoice.paid",
  ]) {
    it(`${type} touches no order and still answers 200`, async () => {
      m.constructEvent.mockReturnValue({ type, data: { object: { payment_intent: "pi_test_1" } } });
      const res = await POST(post());
      // 200 on purpose: a non-2xx makes Stripe retry an event forever.
      expect(res.status).toBe(200);
      expect(m.updateOrder).not.toHaveBeenCalled();
      expect(m.insert).not.toHaveBeenCalled();
      expect(m.sendOrderEmail).not.toHaveBeenCalled();
    });
  }

  it("PRECONDITION: a handled event on the same harness DOES act", async () => {
    // Without this the whole block above passes on a webhook that ignores
    // everything, including the two events that matter (L-2).
    m.getByPaymentIntent.mockResolvedValue(REFUNDABLE);
    m.updateOrder.mockResolvedValue({ id: "ord_1" });
    m.constructEvent.mockReturnValue(refundedEvent());
    await POST(post());
    expect(m.updateOrder).toHaveBeenCalledWith("ord_1", { status: "refunded" });
  });
});

/**
 * The two events that reached nobody.
 *
 * A REFUND moved the order and emailed the customer. The operator — whose money
 * had just gone back, and who might be about to cut the piece — was told
 * nothing at all.
 *
 * A PAID ORDER WITH NO LINE ITEMS (B-18) was a console.error, and console.error
 * did not reach GlitchTip: captureConsoleIntegration was never configured, so
 * the comment claiming "console.error so it reaches GlitchTip" was wrong and
 * "loud" meant silent. Both are fixed at the source AND here.
 */
describe("POST /api/stripe-webhook — the operator hears about it", () => {
  it("tells the operator when an order is refunded", async () => {
    m.getByPaymentIntent.mockResolvedValue(REFUNDABLE);
    m.updateOrder.mockResolvedValue({ id: "ord_1" });
    m.constructEvent.mockReturnValue(refundedEvent());
    await POST(post());
    expect(m.sendOperatorNotice, "a refund must reach the operator").toHaveBeenCalled();
    const [subject, html] = m.sendOperatorNotice.mock.calls[0];
    expect(`${subject} ${html}`).toMatch(/refund/i);
    expect(`${subject} ${html}`).toContain("ord_1");
  });

  it("does not re-notify on a repeated refund event", async () => {
    // Stripe retries, and a second partial refund arrives as another event.
    m.getByPaymentIntent.mockResolvedValue({ ...REFUNDABLE, status: "refunded" });
    m.constructEvent.mockReturnValue(refundedEvent());
    await POST(post());
    expect(m.sendOperatorNotice).not.toHaveBeenCalled();
  });

  it("tells the operator when a paid order has NO line items", async () => {
    // The workshop cannot make this. Previously a console.error into the void.
    m.listLineItems.mockRejectedValueOnce(new Error("stripe down"));
    m.constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    expect(m.sendOperatorNotice, "an unmakeable order must reach the operator").toHaveBeenCalled();
    const [subject, html] = m.sendOperatorNotice.mock.calls[0];
    expect(`${subject} ${html}`).toMatch(/no line items|cannot be made|check the stripe/i);
  });

  it("PRECONDITION: a normal order does NOT raise the no-items notice", async () => {
    // Without this, the assertion above would pass on a webhook that shouts
    // about every order — and the first draft of this test DID pass while
    // asserting nothing, because the shared harness defaults listLineItems to
    // `{ data: [] }`. Every "normal" order in this file is an empty one. The
    // notice must therefore be proven silent against a session that actually
    // has something in it.
    m.listLineItems.mockResolvedValue({
      data: [{ description: "Puzzle", quantity: 1, amount_total: 12000, price: { product: { metadata: { slug: "p" } } } }],
    });
    m.constructEvent.mockReturnValue(completedEvent());
    await POST(post());
    const calls = m.sendOperatorNotice.mock.calls.filter(([s, h]) =>
      /no line items/i.test(`${s} ${h}`)
    );
    expect(calls).toEqual([]);
  });
});

it("tells the operator about a refund with NO matching order", async () => {
  // Strictly worse than the refunded case above: money has left the account and
  // the shop cannot even name whose order it was. This was a console.error, in
  // the belief that console.error reached GlitchTip — it did not.
  m.getByPaymentIntent.mockResolvedValue(null);
  m.constructEvent.mockReturnValue(refundedEvent());
  await POST(post());
  expect(m.sendOperatorNotice).toHaveBeenCalled();
  const [subject, html] = m.sendOperatorNotice.mock.calls[0];
  expect(`${subject} ${html}`).toMatch(/no matching order|does not know/i);
});
