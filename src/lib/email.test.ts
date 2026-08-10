/**
 * Which order statuses email the customer, and what they say.
 *
 * The bug this pins: `buildEmailHTML` ended with
 *     const status = statusMap[action] || statusMap.confirmation;
 * so any action without a template inherited the **confirmation** body —
 * "Order Confirmed! Thank you for your order. We're preparing your items now."
 *
 * Four of the eight statuses the admin dropdown could set had no template
 * (`deposit_paid`, `completed`, `failed`, `refunded`), so all four sent that.
 * Refunding a customer and then telling them their order is confirmed and being
 * prepared was not an edge case — it was the default path.
 *
 * ACTION_PLAN.md A-14.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.hoisted(() => vi.fn(async (_p: { subject: string; html: string; to: string[] }) => ({ id: "e1" })));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

import { sendOrderEmail, isEmailable, sendOperatorOrderAlert } from "./email";

const order = (over: Record<string, unknown> = {}) => ({
  id: "3f1c2b8a-9d4e-4f7a-8b21-0c5d6e7f8a9b",
  customer_name: "A Customer",
  customer_email: "buyer@example.com",
  customer_phone: "+971501234567",
  total: 35,
  deposit_amount: 35,
  cod_amount: 0,
  status: "processing",
  delivery_method: "delivery",
  ...over,
});

/** Subject + body of the most recent send. */
function sent() {
  const last = send.mock.calls.at(-1);
  if (!last) throw new Error("nothing was sent");
  return last[0];
}

beforeEach(() => { vi.clearAllMocks(); });

// Every value the DB CHECK permits (0002_add_constraints.sql), plus the
// `confirmation` action the webhook uses, which is not a status.
const EMAILS = ["confirmation", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"];
const SILENT = ["deposit_paid", "paid", "completed", "failed"];

describe("which actions reach a customer", () => {
  it.each(EMAILS)("%s sends", async (action) => {
    expect(isEmailable(action)).toBe(true);
    await expect(sendOrderEmail(order(), action)).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(SILENT)("%s sends nothing", async (action) => {
    // Silence is the correct output, not a missing feature: the webhook already
    // sent `confirmation` for deposit_paid/paid, `delivered` already thanked
    // them before `completed`, and payment failure is Stripe's conversation.
    expect(isEmailable(action)).toBe(false);
    await expect(sendOrderEmail(order(), action)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("REGRESSION: an unmapped action must not inherit the confirmation body", async () => {
    // The precise old failure. `refunded` had no template and fell through to
    // statusMap.confirmation.
    await sendOrderEmail(order(), "some_status_nobody_wrote_yet");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing when there is no address to send to", async () => {
    await expect(sendOrderEmail(order({ customer_email: "" }), "shipped")).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("what the refund email says", () => {
  it("does not tell a refunded customer their order is confirmed", async () => {
    await sendOrderEmail(order({ total: 35 }), "refunded");
    const { subject, html } = sent();
    expect(subject).toContain("Refund issued");
    expect(html).not.toContain("Order Confirmed");
    expect(html).not.toContain("preparing your items");
  });

  it("names the amount refunded", async () => {
    await sendOrderEmail(order({ total: 35 }), "refunded");
    expect(sent().html).toContain("AED 35.00");
  });

  it("does not quote the no-refunds policy at someone who was refunded", async () => {
    // `cancelled` says "all sales are final" — correct there, a contradiction
    // here, since a refund has already been issued.
    await sendOrderEmail(order(), "refunded");
    expect(sent().html).not.toContain("all sales are final");
  });
});

describe("templates still say the right thing", () => {
  it("puts the tracking number in the shipped email when there is one", async () => {
    await sendOrderEmail(order({ tracking_number: "TRK123" }), "shipped");
    expect(sent().html).toContain("TRK123");
  });

  it("promises tracking later when there is none", async () => {
    await sendOrderEmail(order(), "shipped");
    expect(sent().html).toContain("tracking details soon");
  });

  it("only asks for cash on delivery when cash is actually due", async () => {
    await sendOrderEmail(order({ cod_amount: 0 }), "out_for_delivery");
    expect(sent().html).not.toContain("ready for the courier");
  });
});

/**
 * The operator alert has to carry a way to actually reach the customer.
 *
 * WhatsApp is this shop's normal channel — the site has a floating WhatsApp
 * button and the contact page leads with it — but customer WhatsApp messages
 * do not send: WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set,
 * and obtaining them needs a Meta Business account.
 *
 * `notifyWhatsApp()` already handles that by returning a manual `wa.me` link…
 * and then `console.log`ging it. Both callers discard the return value, so the
 * link goes to a server console nobody reads. The customer gets no message and
 * the operator is never told — which is B-20's shape exactly, the defect this
 * very alert was written to fix.
 *
 * So the alert carries the link. Until the API is configured the operator taps
 * it and messages the customer in one action; once it IS configured the alert
 * says so and the link is merely a convenience.
 */
describe("the operator alert can reach the customer", () => {
  const OPERATOR_ORDER = { ...order({ status: "confirmation" }), customer_phone: "0501234567" };

  beforeEach(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("includes a wa.me link addressed to the customer's number", async () => {
    await sendOperatorOrderAlert(OPERATOR_ORDER, []);
    const { html } = sent();
    // 0501234567 normalises to 971501234567 — the same rule the tracker uses.
    expect(html).toContain("https://wa.me/971501234567");
  });

  it("says plainly that automatic WhatsApp is NOT configured", async () => {
    await sendOperatorOrderAlert(OPERATOR_ORDER, []);
    expect(sent().html).toMatch(/not configured|message them yourself/i);
  });

  it("stops saying that once the API credentials exist", async () => {
    // Precondition for the assertion above: the wording is driven by the
    // environment, not hardcoded — otherwise it would still nag after setup.
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
    await sendOperatorOrderAlert(OPERATOR_ORDER, []);
    expect(sent().html).not.toMatch(/not configured/i);
  });

  it("still sends the alert when the customer left no phone", async () => {
    // No link is possible, but the order alert itself must not be lost.
    await sendOperatorOrderAlert({ ...OPERATOR_ORDER, customer_phone: "" }, []);
    expect(send).toHaveBeenCalled();
    expect(sent().html).not.toContain("wa.me/971");
  });
});
