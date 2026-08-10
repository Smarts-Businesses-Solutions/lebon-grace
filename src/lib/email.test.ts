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

/*
 * The mock must have the SDK's REAL return shape.
 *
 * It used to resolve `{ id: "e1" }` — the shape of `data`, not of the response.
 * The real SDK resolves `{data, error}` and never throws on an API refusal, so
 * a mock shaped like this cannot express a rejected send, and no test could
 * have caught that every send path returned true regardless. The harness
 * modelled the library as the code wished it worked.
 */
type SendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { message: string; statusCode: number; name: string } };
const send = vi.hoisted(() =>
  vi.fn(async (_p: { subject: string; html: string; to: string[] }): Promise<SendResult> => ({
    data: { id: "e1" },
    error: null,
  }))
);
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

import { sendOrderEmail, isEmailable, sendOperatorOrderAlert, sendOperatorNotice, esc } from "./email";

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

/**
 * Events that reach the operator, rather than a console nobody reads.
 *
 * Two things happen on this platform that the operator was never told about:
 *
 *   A REFUND. charge.refunded moves the order and emails the CUSTOMER. The
 *   operator — the person whose money just went back, and who may be about to
 *   cut the piece — got nothing.
 *
 *   A PAID ORDER WITH NO LINE ITEMS (B-18). The workshop cannot make it. It
 *   was a console.error, and console.error did not reach GlitchTip because
 *   captureConsoleIntegration was never configured — so "loud" meant silent.
 *
 * Both go through one small notice function rather than another bespoke
 * template, because the next such event should cost one line, not a new
 * mail-shaped thing to keep in step.
 */
describe("sendOperatorNotice", () => {
  beforeEach(() => { delete process.env.ORDER_NOTIFY_EMAIL; });

  it("sends to ORDER_NOTIFY_EMAIL when set", async () => {
    process.env.ORDER_NOTIFY_EMAIL = "workshop@example.com";
    await sendOperatorNotice("Something happened", "<p>details</p>");
    expect(sent().to).toEqual(["workshop@example.com"]);
  });

  it("falls back to the contact address, so a notice is never dropped for want of config", async () => {
    await sendOperatorNotice("Something happened", "<p>details</p>");
    expect(sent().to.length).toBe(1);
    expect(sent().to[0]).toContain("@");
  });

  it("carries the subject and body through", async () => {
    await sendOperatorNotice("Order refunded", "<p>AED 35 went back</p>");
    expect(sent().subject).toContain("Order refunded");
    expect(sent().html).toContain("AED 35 went back");
  });

  it("returns false rather than throwing when sending fails", async () => {
    // The callers are fire-and-forget inside a Stripe webhook. Throwing here
    // would fail the webhook, Stripe would retry, and the idempotency check
    // would then skip the real work — so this must never throw.
    send.mockRejectedValueOnce(new Error("smtp down"));
    await expect(sendOperatorNotice("x", "<p>y</p>")).resolves.toBe(false);
  });
});

/**
 * A review comment and a customer name are typed by strangers, and both now
 * travel into an HTML e-mail the operator opens. Escaping them is not
 * paranoia about a "customer XSS": it is that an unescaped `<` silently eats
 * the rest of the sentence, so the one alert written to be read carefully is
 * also the one that can arrive mangled.
 */
describe("esc", () => {
  it("neutralises the characters that break out of text", () => {
    expect(esc(`<script>alert(1)</script>`)).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(esc(`" & '`)).toBe("&quot; &amp; &#39;");
  });

  it("escapes the ampersand FIRST", () => {
    // &lt; must not become &amp;lt;. Getting the order wrong double-escapes
    // every entity and is invisible until someone reads a mangled alert.
    expect(esc("&lt;")).toBe("&amp;lt;");
  });

  it("leaves ordinary text alone", () => {
    expect(esc("Lovely piece, thank you!")).toBe("Lovely piece, thank you!");
  });
});

/**
 * Resend does NOT throw when it rejects a send.
 *
 * `emails.send()` resolves to `{ data, error }` — the SDK's own type is
 * `{data: T, error: null} | {error: ErrorResponse, data: null}`. So
 * `await send(...)` followed by `return true` reports success for every
 * API-level rejection, and only a network failure ever reaches the catch.
 *
 * This was not hypothetical. Production held an unverified sending domain, so
 * EVERY email this shop ever attempted came back
 *   403 "The lebon-grace.com domain is not verified"
 * and every send path returned true. Order confirmations, status updates and
 * operator alerts had never been delivered, on a shop taking live payments,
 * and nothing anywhere said so — the failure was reported as success.
 */
describe("a rejected send is a failure, not a success", () => {
  const rejection = {
    data: null,
    error: { message: "The lebon-grace.com domain is not verified", statusCode: 403, name: "validation_error" },
  };

  it("sendOperatorNotice resolves FALSE when Resend rejects it", async () => {
    send.mockResolvedValueOnce(rejection);
    await expect(sendOperatorNotice("subject", "<p>body</p>")).resolves.toBe(false);
  });

  it("names the reason, so the fix is obvious from the log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValueOnce(rejection);
    await sendOperatorNotice("subject", "<p>body</p>");
    expect(err.mock.calls.flat().join(" ")).toContain("not verified");
    err.mockRestore();
  });

  it("sendOrderEmail resolves FALSE when Resend rejects it", async () => {
    send.mockResolvedValueOnce(rejection);
    await expect(sendOrderEmail(order(), "confirmation")).resolves.toBe(false);
  });

  it("sendOperatorOrderAlert resolves FALSE when Resend rejects it", async () => {
    send.mockResolvedValueOnce(rejection);
    await expect(sendOperatorOrderAlert(order(), [])).resolves.toBe(false);
  });

  it("PRECONDITION: all three still resolve TRUE on a clean send", async () => {
    // Without this the assertions above would pass on a mailer that always
    // reports failure.
    send.mockResolvedValue({ data: { id: "e_1" }, error: null });
    await expect(sendOperatorNotice("s", "<p>b</p>")).resolves.toBe(true);
    await expect(sendOrderEmail(order(), "confirmation")).resolves.toBe(true);
    await expect(sendOperatorOrderAlert(order(), [])).resolves.toBe(true);
  });
});

/**
 * Nothing outside this module may call the SDK directly.
 *
 * B-30's fix routed the three senders in `lib/email.ts` through `deliver()` and
 * left `/api/contact` and `/api/cart-recovery` calling
 * `mailer().emails.send(...)` themselves — so both kept answering 200 to a
 * refused send, in the very session that fixed exactly that bug elsewhere.
 *
 * Finding the stragglers by reading is how they were missed the first time.
 * This makes a new one fail the build instead: the failure arrives when the code
 * is written, not months later when someone wonders why no mail arrives.
 */
describe("every sender goes through deliver()", () => {
  it("no file outside lib/email.ts calls emails.send directly", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    // Resolved from THIS file, not from cwd. A cwd-relative "src" silently
    // walked nothing under vitest, so the guard passed with a known offender
    // sitting in the tree — a guard that cannot fail is decoration (P-001).
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        const rel = p.split("\\").join("/");
        if (rel.endsWith("lib/email.ts")) continue; // the one legitimate site
        if (/emails\s*\.\s*send\s*\(/.test(readFileSync(p, "utf8"))) {
          offenders.push(rel.replace(SRC.split("\\").join("/"), "src"));
        }
      }
    };
    walk(SRC);

    expect(
      offenders,
      `these call the Resend SDK directly, so a refusal reads as success — use deliver() from @/lib/email:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});
